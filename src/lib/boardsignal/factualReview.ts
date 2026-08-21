import { Chess } from "chess.js";
import type { BoardSignalAccount } from "./account";
import type { BoardSignalDesk, DeskCandidate, DeskSignal } from "./types";

const DAY_MS = 86_400_000;
export const FACTUAL_REVIEW_SCHEMA_VERSION = "boardsignal-factual-review-v1" as const;
export const MAX_FACTUAL_REVIEW_CANDIDATES = 8;

export type FactualReviewFacts = Pick<BoardSignalDesk,
  | "source"
  | "provenance"
  | "player"
  | "period"
  | "episodeKey"
  | "cadence"
  | "games"
  | "wins"
  | "losses"
  | "draws"
  | "score"
  | "headline"
  | "summary"
  | "longestWinStreak"
  | "longestLossStreak"
  | "sessions"
  | "sessionDetails"
  | "checkmateWins"
  | "timeoutLosses"
  | "resignationLosses"
  | "primaryPool"
  | "days"
  | "pools"
  | "openings"
  | "colorRecords"
  | "gameLength"
  | "terminations"
  | "clockEvidence"
  | "strengths"
  | "opponentBands"
  | "validation"
  | "caveats"
>;

export type FactualReviewDraft = {
  schemaVersion: typeof FACTUAL_REVIEW_SCHEMA_VERSION;
  status: "engine_pending";
  deskKey: string;
  periodEnd: string;
  facts: FactualReviewFacts;
  retryCandidates: DeskCandidate[];
  createdAt: string;
  updatedAt: string;
};

export type FactualReviewOwner = Pick<BoardSignalAccount, "uid" | "chessCom">;

function isoDayTime(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function recordTotal(wins: number | undefined, draws: number | undefined, losses: number | undefined) {
  return Number(wins ?? NaN) + Number(draws ?? NaN) + Number(losses ?? NaN);
}

function isLegalFen(fen: string | undefined) {
  if (!fen) return false;
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

function deskKeyFor(desk: BoardSignalDesk) {
  return desk.episodeKey ?? `${desk.player.playerId}:${desk.period.start}:${desk.period.end}`;
}

function assertFactual(condition: unknown, message: string, code: string): asserts condition {
  if (!condition) throw Object.assign(new Error(message), { status: 422, code });
}

export function validateFactualReviewInput(owner: FactualReviewOwner, desk: BoardSignalDesk) {
  assertFactual(desk.source === "live", "Only LIVE BoardSignal weeks can be stored as factual reviews.", "FACTUAL_REVIEW_NOT_LIVE");
  assertFactual(desk.provenance?.verified === true, "The factual review source is not verified.", "FACTUAL_REVIEW_UNVERIFIED");
  assertFactual(
    desk.player.playerId === owner.chessCom.playerId
      && desk.player.username.toLowerCase() === owner.chessCom.canonicalUsername.toLowerCase(),
    "This factual review does not belong to the authenticated Chess.com player.",
    "FACTUAL_REVIEW_OWNER_MISMATCH",
  );

  const start = isoDayTime(desk.period.start);
  const end = isoDayTime(desk.period.end);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  assertFactual(Number.isFinite(start) && Number.isFinite(end) && end - start === 6 * DAY_MS, "The factual review period must be exactly seven days.", "FACTUAL_REVIEW_PERIOD_INVALID");
  assertFactual(end < today, "Only a completed seven-day period can be stored as a factual review.", "FACTUAL_REVIEW_PERIOD_OPEN");

  assertFactual(desk.games > 0 && desk.wins + desk.draws + desk.losses === desk.games, "The factual review record totals are inconsistent.", "FACTUAL_REVIEW_RECORD_MISMATCH");
  assertFactual(desk.days.length === 7, "The factual review must contain all seven chronology days.", "FACTUAL_REVIEW_TIMELINE_INCOMPLETE");
  const seenDays = new Set<string>();
  let timelineGames = 0;
  desk.days.forEach((day, index) => {
    const expected = new Date(start + index * DAY_MS).toISOString().slice(0, 10);
    assertFactual(day.date === expected && !seenDays.has(day.date), "The factual review chronology is not coherent.", "FACTUAL_REVIEW_TIMELINE_INCOHERENT");
    seenDays.add(day.date);
    const total = day.wins + day.draws + day.losses;
    if (day.games !== undefined) assertFactual(day.games === total, "A factual review day has inconsistent game totals.", "FACTUAL_REVIEW_DAY_MISMATCH");
    timelineGames += total;
  });
  assertFactual(timelineGames === desk.games, "The factual review chronology does not match the episode game count.", "FACTUAL_REVIEW_TIMELINE_TOTAL_MISMATCH");

  assertFactual(desk.pools.length > 0 && desk.pools.reduce((sum, pool) => sum + pool.games, 0) === desk.games, "The factual review pool totals do not match the episode.", "FACTUAL_REVIEW_POOL_MISMATCH");
  for (const pool of desk.pools) {
    assertFactual(pool.games > 0 && recordTotal(pool.wins, pool.draws, pool.losses) === pool.games, "A factual review pool has inconsistent record totals.", "FACTUAL_REVIEW_POOL_RECORD_MISMATCH");
    assertFactual(pool.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined, "A factual review pool is missing rating boundaries.", "FACTUAL_REVIEW_RATING_BOUNDARY_MISSING");
    if (pool.change !== undefined) assertFactual(pool.change === pool.lastRecordedRating - pool.firstRecordedRating, "A factual review rating change is inconsistent.", "FACTUAL_REVIEW_RATING_CHANGE_MISMATCH");
    if (pool.peak !== undefined) assertFactual(pool.peak >= pool.firstRecordedRating && pool.peak >= pool.lastRecordedRating, "A factual review rating peak is inconsistent.", "FACTUAL_REVIEW_RATING_PEAK_MISMATCH");
    if (pool.low !== undefined) assertFactual(pool.low <= pool.firstRecordedRating && pool.low <= pool.lastRecordedRating, "A factual review rating low is inconsistent.", "FACTUAL_REVIEW_RATING_LOW_MISMATCH");
  }

  if (desk.colorRecords) assertFactual(desk.colorRecords.white.games + desk.colorRecords.black.games === desk.games, "The factual review colour totals do not match the episode.", "FACTUAL_REVIEW_COLOR_MISMATCH");
  if (desk.sessionDetails) assertFactual(desk.sessionDetails.reduce((sum, session) => sum + session.games, 0) === desk.games, "The factual review session totals do not match the episode.", "FACTUAL_REVIEW_SESSION_MISMATCH");

  const validation = desk.validation;
  assertFactual(Boolean(validation), "The factual review is missing reconstruction validation metadata.", "FACTUAL_REVIEW_VALIDATION_MISSING");
  assertFactual(validation!.gamesReceived === desk.games, "The factual review received-game total is inconsistent.", "FACTUAL_REVIEW_RECEIVED_MISMATCH");
  if (validation!.gamesIncluded !== undefined) assertFactual(validation!.gamesIncluded === desk.games, "The factual review included-game total is inconsistent.", "FACTUAL_REVIEW_INCLUDED_MISMATCH");
  assertFactual(validation!.gamesReconstructed === desk.games, "Legal reconstruction must succeed before a factual review is stored.", "FACTUAL_REVIEW_RECONSTRUCTION_INCOMPLETE");
  assertFactual(validation!.candidatePositions === desk.candidates.length, "The factual review candidate count is inconsistent.", "FACTUAL_REVIEW_CANDIDATE_MISMATCH");
  assertFactual(desk.candidates.length <= MAX_FACTUAL_REVIEW_CANDIDATES, "The factual review exceeds the existing position limit.", "FACTUAL_REVIEW_POSITION_LIMIT");

  const candidateIds = new Set<string>();
  for (const candidate of desk.candidates) {
    assertFactual(!candidateIds.has(candidate.id), "The factual review contains duplicate candidate IDs.", "FACTUAL_REVIEW_DUPLICATE_CANDIDATE");
    candidateIds.add(candidate.id);
    const before = candidate.fenBefore ?? candidate.fen;
    assertFactual(candidate.reconstruction === "legal" && Boolean(candidate.gameUrl) && isLegalFen(before), "A factual-review retry position is not legally reconstructable.", "FACTUAL_REVIEW_POSITION_INVALID");
    if (candidate.fenAfter) assertFactual(isLegalFen(candidate.fenAfter), "A factual-review retry position has an invalid after-position FEN.", "FACTUAL_REVIEW_AFTER_POSITION_INVALID");
  }

  return { deskKey: deskKeyFor(desk), periodEnd: desk.period.end };
}

export function createFactualReviewDraft(owner: FactualReviewOwner, desk: BoardSignalDesk, now = new Date().toISOString()): FactualReviewDraft {
  const { deskKey, periodEnd } = validateFactualReviewInput(owner, desk);
  const facts: FactualReviewFacts = {
    source: desk.source,
    provenance: desk.provenance,
    player: desk.player,
    period: desk.period,
    episodeKey: desk.episodeKey,
    cadence: desk.cadence,
    games: desk.games,
    wins: desk.wins,
    losses: desk.losses,
    draws: desk.draws,
    score: desk.score,
    headline: `${desk.games} games completed in this seven-day review.`,
    summary: `${desk.wins}W · ${desk.draws}D · ${desk.losses}L for a ${desk.score.toFixed(1)}% score. Position-based guidance is not complete yet.`,
    longestWinStreak: desk.longestWinStreak,
    longestLossStreak: desk.longestLossStreak,
    sessions: desk.sessions,
    sessionDetails: desk.sessionDetails,
    checkmateWins: desk.checkmateWins,
    timeoutLosses: desk.timeoutLosses,
    resignationLosses: desk.resignationLosses,
    primaryPool: desk.primaryPool,
    days: desk.days,
    pools: desk.pools,
    openings: desk.openings,
    colorRecords: desk.colorRecords,
    gameLength: desk.gameLength,
    terminations: desk.terminations,
    clockEvidence: desk.clockEvidence,
    strengths: desk.strengths,
    opponentBands: desk.opponentBands,
    validation: desk.validation,
    caveats: [
      "Ratings stay separated by Chess.com time class; recorded boundaries are factual game ratings.",
      "Position-based guidance remains withheld until the existing engine and publication checks pass.",
      ...(desk.period.isLastActive ? ["This is an older last-active period and is not presented as current form."] : []),
    ],
  };
  return {
    schemaVersion: FACTUAL_REVIEW_SCHEMA_VERSION,
    status: "engine_pending",
    deskKey,
    periodEnd,
    facts,
    retryCandidates: desk.candidates,
    createdAt: now,
    updatedAt: now,
  };
}

function withheld(label: string, title: string): DeskSignal {
  return {
    label,
    title,
    copy: "BoardSignal will only add position-based guidance after the existing evidence checks pass.",
    status: "withheld",
    evidenceIds: [],
  };
}

export function factualReviewToRetryDesk(draft: FactualReviewDraft): BoardSignalDesk {
  return {
    ...draft.facts,
    signals: {
      green: withheld("Green · Pending", "Position review is still finishing."),
      amber: withheld("Amber · Pending", "Position review is still finishing."),
      red: withheld("Red · Reviewing", "No position diagnosis is complete yet."),
      blue: withheld("Blue · Preparing", "No Focus-next guidance is complete yet."),
    },
    candidates: draft.retryCandidates,
    turningPoint: undefined,
    pocketCard: undefined,
    returnLoop: undefined,
  };
}
