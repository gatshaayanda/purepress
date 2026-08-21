import type { BoardSignalDesk, DeskEngineResult } from "./types";

export type DeskQualityReport = {
  status: "PASS" | "FAIL";
  codes: string[];
};

const BANNED_PLAYER_COPY = [
  "permanent claim",
  "strongest positive quality supported",
  "first correction selected",
  "not a cross-week task",
  "founder",
  "seeded",
  "beta desk",
];

const DAY_MS = 86_400_000;

function isExactSevenDayPeriod(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime - startTime === 6 * DAY_MS;
}

function timelineMatchesPeriod(desk: BoardSignalDesk) {
  if (desk.days.length !== 7) return false;
  return desk.days.every((day, index) => {
    const expected = new Date(Date.parse(`${desk.period.start}T00:00:00Z`) + index * DAY_MS).toISOString().slice(0, 10);
    return day.date === expected;
  });
}

function ratingEvidenceIsCoherent(desk: BoardSignalDesk) {
  return desk.pools.every((pool) => {
    if (pool.games <= 0) return false;
    const boundariesPresent = pool.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined;
    if (!boundariesPresent) return false;
    if (pool.peak !== undefined && (pool.peak < pool.firstRecordedRating! || pool.peak < pool.lastRecordedRating!)) return false;
    if (pool.low !== undefined && (pool.low > pool.firstRecordedRating! || pool.low > pool.lastRecordedRating!)) return false;
    if (pool.change !== undefined && pool.change !== pool.lastRecordedRating! - pool.firstRecordedRating!) return false;
    if (pool.wins !== undefined && pool.draws !== undefined && pool.losses !== undefined && pool.wins + pool.draws + pool.losses !== pool.games) return false;
    return true;
  });
}

export function validateDeskForPublication(
  desk: BoardSignalDesk,
  engineResults: Record<string, DeskEngineResult> = {},
): DeskQualityReport {
  const codes: string[] = [];
  const signalCopy = Object.values(desk.signals).flatMap((signal) => [signal.title, signal.copy]).join(" ").toLowerCase();
  const poolGames = desk.pools.reduce((sum, pool) => sum + pool.games, 0);
  const timelineGames = desk.days.reduce((sum, day) => sum + day.wins + day.losses + day.draws, 0);

  if (!desk.player.username || !desk.period.start || !desk.period.end) codes.push("IDENTITY_OR_PERIOD_MISSING");
  if (!desk.provenance?.verified) codes.push("PROVENANCE_UNVERIFIED");
  if (!isExactSevenDayPeriod(desk.period.start, desk.period.end)) codes.push("PERIOD_NOT_EXACTLY_SEVEN_DAYS");
  if (desk.games <= 0 || desk.wins + desk.losses + desk.draws !== desk.games) codes.push("RECORD_TOTAL_MISMATCH");
  if (!timelineMatchesPeriod(desk) || timelineGames !== desk.games) codes.push("DAILY_TIMELINE_INCOMPLETE");
  if (!desk.pools.length || poolGames !== desk.games) codes.push("POOL_TOTAL_MISMATCH");
  if (!ratingEvidenceIsCoherent(desk)) codes.push("RATING_EVIDENCE_INCOHERENT");
  if (desk.colorRecords && desk.colorRecords.white.games + desk.colorRecords.black.games !== desk.games) codes.push("COLOR_TOTAL_MISMATCH");
  if (desk.sessionDetails && desk.sessionDetails.reduce((sum, session) => sum + session.games, 0) !== desk.games) codes.push("SESSION_TOTAL_MISMATCH");
  if (desk.validation && desk.validation.gamesReconstructed !== desk.validation.gamesReceived) codes.push("LEGAL_RECONSTRUCTION_INCOMPLETE");
  if (desk.validation?.gamesIncluded !== undefined && desk.validation.gamesIncluded !== desk.games) codes.push("INCLUDED_GAME_TOTAL_MISMATCH");
  if (desk.losses > 0 && !desk.candidates.length) codes.push("POSITION_EVIDENCE_MISSING");
  if (desk.candidates.length > 8) codes.push("POSITION_LIMIT_EXCEEDED");
  if (desk.candidates.some((candidate) => candidate.reconstruction !== "legal" || !candidate.gameUrl || (desk.source === "live" && !(candidate.fenBefore ?? candidate.fen)))) codes.push("POSITION_RECONSTRUCTION_FAILED");
  if (BANNED_PLAYER_COPY.some((phrase) => signalCopy.includes(phrase))) codes.push("INTERNAL_OR_FILLER_COPY_VISIBLE");
  if (!desk.replay && desk.source === "live") codes.push("REPLAY_MISSING");
  if (desk.replay && (!desk.replay.narrative.includes(String(desk.games)) || !desk.replay.narrative.includes(`${desk.wins}W`))) codes.push("REPLAY_FACTS_MISSING");

  if (desk.source === "live") {
    if (desk.sessions === null || desk.checkmateWins === null || desk.timeoutLosses === null || desk.resignationLosses === null) codes.push("LIVE_FACTS_INCOMPLETE");
    const reviewed = desk.candidates.filter((candidate) => engineResults[candidate.id]?.status !== "failed" && engineResults[candidate.id]);
    if (reviewed.length !== desk.candidates.length) codes.push("ENGINE_REVIEW_INCOMPLETE");
    if ((desk.candidates.length && reviewed.length === 0) || ((desk.validation?.engineFailed ?? 0) > 0 && (desk.validation?.engineSucceeded ?? 0) === 0)) codes.push("ENGINE_REVIEW_UNAVAILABLE");
    if (/reviewing|preparing/i.test(`${desk.signals.red.label} ${desk.signals.blue.label}`)) codes.push("SIGNALS_NOT_FINAL");

    const redSupported = desk.signals.red.status !== "withheld";
    const blueSupported = desk.signals.blue.status !== "withheld";
    if (redSupported !== blueSupported) codes.push("RED_BLUE_SUPPORT_MISMATCH");
    if (redSupported) {
      const ids = desk.signals.red.evidenceIds ?? [];
      const evidence = ids.map((id) => desk.candidates.find((candidate) => candidate.id === id)).filter(Boolean);
      const distinctGames = new Set(evidence.map((candidate) => candidate!.gameId ?? candidate!.gameUrl));
      if (ids.length < 2 || evidence.length !== ids.length || distinctGames.size < 2) codes.push("RED_REPEATED_EVIDENCE_MISSING");
      if ((desk.signals.blue.evidenceIds ?? []).join("|") !== ids.join("|")) codes.push("BLUE_NOT_DERIVED_FROM_RED");
    }
  }

  return { status: codes.length ? "FAIL" : "PASS", codes };
}

