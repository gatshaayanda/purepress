import type { BoardSignalDesk, DeskPool } from "./types";

export type SignalFamilyKey =
  | "passed_pawn_conversion"
  | "winning_run"
  | "checkmate_finish"
  | "rating_climb"
  | "opponent_band"
  | "pool_divergence"
  | "narrow_sample"
  | "loss_run"
  | "playable_resignation"
  | "clock_conversion"
  | "queen_safety"
  | "king_safety"
  | "forcing_reply"
  | "material_conversion"
  | "general_decision";

export type DeskSignalFamilies = {
  greenFamily?: SignalFamilyKey;
  amberFamily?: SignalFamilyKey;
  redFamily?: SignalFamilyKey;
  blueFamily?: SignalFamilyKey;
};

export type DeskSummaryPool = {
  pool: string;
  games: number;
  wins?: number;
  draws?: number;
  losses?: number;
  scorePct?: number;
  ratingStart?: number;
  ratingEnd?: number;
  ratingDelta?: number;
  ratingHigh?: number;
  ratingLow?: number;
};

export type DeskSummary = {
  deskKey: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  scorePct: number;
  pools: DeskSummaryPool[];
  longestWinRun: number;
  longestLossRun: number;
  whiteScorePct?: number;
  blackScorePct?: number;
  sessions?: number;
  medianGameLength?: number;
  terminationDistributions?: Array<{ type: string; games: number }>;
  openingFamilies?: Array<{ name: string; games: number }>;
  signalFamilies: DeskSignalFamilies;
  previousBlue?: { title: string; copy: string };
  previousAmber?: { title: string; copy: string };
};

export type PersonalRecords = {
  desksCompleted: number;
  personalBestWinRun: number;
  largestPoolSpecificRatingClimb: Partial<Record<string, number>>;
  bestUniverseFinish?: { rank: number; denominator: number; category: string };
};

export type RetentionResult<T> = {
  retained: T[];
  removed: T[];
};

export type ProgressSeries = {
  pool: string;
  points: Array<{
    deskKey: string;
    periodLabel: string;
    games: number;
    scorePct?: number;
    ratingDelta?: number;
  }>;
};

export type RecurringPattern = {
  family: SignalFamilyKey;
  status: "repeated" | "not-repeated";
  appearances: number;
  desksCompared: number;
  message: string;
};

export type CurrentEpisodePool = {
  pool: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  ratingStart?: number;
  ratingEnd?: number;
  ratingDelta?: number;
};

export type CurrentEpisodeSummary = {
  status: "forming";
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  checkedAt: string;
  daysComplete: number;
  daysRemaining: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  currentWinRun: number;
  currentLossRun: number;
  sessions: number;
  pools: CurrentEpisodePool[];
  nextDeskDueAt: string;
};

export type BoardSignalNotificationEventType =
  | "desk_ready"
  | "episode_started"
  | "episode_progress"
  | "blue_reminder_available"
  | "amber_watch_available"
  | "universe_achievement"
  | "universe_top3"
  | "inactive_episode";

export type BoardSignalEventHook = {
  type: BoardSignalNotificationEventType;
  occurredAt: string;
  deskKey?: string;
  data?: Record<string, string | number | boolean>;
};

export type SafePublicCoverage = {
  chessPlayerId: string;
  username: string;
  avatar?: string;
  periodEnd: string;
  periodLabel: string;
  headline: string;
  visibility: {
    publicPlayerPage: boolean;
    universeCoverage: boolean;
  };
  positiveFacts: {
    games: number;
    wins: number;
    draws: number;
    scorePct?: number;
    longestWinRun?: number;
    checkmateWins?: number;
    positiveRatingMovements: Array<{ pool: string; games: number; delta: number }>;
  };
};

function poolScore(pool: DeskPool) {
  if (pool.games <= 0 || pool.wins === undefined || pool.draws === undefined) return undefined;
  return Number((((pool.wins + pool.draws / 2) / pool.games) * 100).toFixed(1));
}

function supported(signal: BoardSignalDesk["signals"]["blue"]) {
  return signal.status !== "withheld" && Boolean(signal.title.trim());
}

function familyFromEvidence(
  desk: BoardSignalDesk,
  signal: BoardSignalDesk["signals"]["red"],
): SignalFamilyKey | undefined {
  if (!supported(signal) || !signal.evidenceIds?.length) return undefined;
  const candidates = signal.evidenceIds
    .map((id) => desk.candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is BoardSignalDesk["candidates"][number] => Boolean(candidate));
  const counts = new Map<SignalFamilyKey, number>();
  for (const candidate of candidates) {
    const family: SignalFamilyKey = candidate.kind === "resignation"
      ? "playable_resignation"
      : candidate.kind === "timeout"
        ? "clock_conversion"
        : candidate.motif === "queen-safety"
          ? "queen_safety"
          : candidate.motif === "king-safety"
            ? "king_safety"
            : candidate.motif === "forcing-reply"
              ? "forcing_reply"
              : candidate.motif === "material"
                ? "material_conversion"
                : "general_decision";
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

export function deriveSignalFamilies(desk: BoardSignalDesk): DeskSignalFamilies {
  const bestPool = [...desk.pools]
    .filter((pool) => (pool.change ?? 0) > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const greenFamily: SignalFamilyKey | undefined = (desk.strengths?.passedPawnConversionGames ?? 0) >= 2
    ? "passed_pawn_conversion"
    : desk.longestWinStreak >= 4
      ? "winning_run"
      : (desk.checkmateWins ?? 0) >= 3
        ? "checkmate_finish"
        : bestPool && (bestPool.change ?? 0) >= 20
          ? "rating_climb"
          : undefined;

  const difficultBand = (desk.opponentBands ?? []).some((band) => (
    band.games >= Math.max(8, Math.ceil(desk.games * 0.08)) && band.score <= 35
  ));
  const positivePool = desk.pools.some((pool) => (pool.change ?? 0) > 0);
  const negativePool = desk.pools.some((pool) => (pool.change ?? 0) < 0);
  const amberFamily: SignalFamilyKey | undefined = difficultBand
    ? "opponent_band"
    : positivePool && negativePool
      ? "pool_divergence"
      : desk.games < 8
        ? "narrow_sample"
        : desk.longestLossStreak >= 4
          ? "loss_run"
          : undefined;
  const correctionFamily = familyFromEvidence(desk, desk.signals.red);

  return {
    greenFamily,
    amberFamily,
    redFamily: correctionFamily,
    blueFamily: supported(desk.signals.blue) ? correctionFamily : undefined,
  };
}

export function deskKeyFor(desk: BoardSignalDesk) {
  return desk.episodeKey
    ?? `${desk.player.playerId ?? desk.player.username.toLowerCase()}:${desk.period.start}:${desk.period.end}`;
}

export function toDeskSummary(desk: BoardSignalDesk): DeskSummary {
  const scoreForColor = (record: NonNullable<BoardSignalDesk["colorRecords"]>["white"]) => (
    record.games ? Number((((record.wins + record.draws / 2) / record.games) * 100).toFixed(1)) : undefined
  );
  return {
    deskKey: deskKeyFor(desk),
    periodStart: desk.period.start,
    periodEnd: desk.period.end,
    periodLabel: desk.period.label,
    games: desk.games,
    wins: desk.wins,
    draws: desk.draws,
    losses: desk.losses,
    scorePct: desk.score,
    pools: desk.pools.map((pool) => ({
      pool: pool.pool.toLowerCase(),
      games: pool.games,
      wins: pool.wins,
      draws: pool.draws,
      losses: pool.losses,
      scorePct: poolScore(pool),
      ratingStart: pool.firstRecordedRating,
      ratingEnd: pool.lastRecordedRating,
      ratingDelta: pool.change ?? (pool.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined
        ? pool.lastRecordedRating - pool.firstRecordedRating
        : undefined),
      ratingHigh: pool.peak,
      ratingLow: pool.low,
    })),
    longestWinRun: desk.longestWinStreak,
    longestLossRun: desk.longestLossStreak,
    whiteScorePct: desk.colorRecords ? scoreForColor(desk.colorRecords.white) : undefined,
    blackScorePct: desk.colorRecords ? scoreForColor(desk.colorRecords.black) : undefined,
    sessions: desk.sessions ?? undefined,
    medianGameLength: desk.gameLength?.medianMoves,
    terminationDistributions: desk.terminations,
    openingFamilies: desk.openings.filter((opening) => opening.games >= 3),
    signalFamilies: deriveSignalFamilies(desk),
    previousBlue: supported(desk.signals.blue) ? { title: desk.signals.blue.title, copy: desk.signals.blue.copy } : undefined,
    previousAmber: supported(desk.signals.amber) ? { title: desk.signals.amber.title, copy: desk.signals.amber.copy } : undefined,
  };
}

export function retainLatestFour<T extends { deskKey: string; periodEnd: string }>(
  entries: T[],
): RetentionResult<T> {
  const unique = new Map<string, T>();
  for (const entry of entries) unique.set(entry.deskKey, entry);
  const ordered = [...unique.values()].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  return { retained: ordered.slice(0, 4), removed: ordered.slice(4) };
}

export function updatePersonalRecords(
  records: PersonalRecords | undefined,
  summary: DeskSummary,
): PersonalRecords {
  const next: PersonalRecords = records ?? {
    desksCompleted: 0,
    personalBestWinRun: 0,
    largestPoolSpecificRatingClimb: {},
  };
  const climbs = { ...next.largestPoolSpecificRatingClimb };
  for (const pool of summary.pools) {
    if (pool.ratingDelta === undefined) continue;
    climbs[pool.pool] = Math.max(climbs[pool.pool] ?? Number.NEGATIVE_INFINITY, pool.ratingDelta);
  }
  return {
    ...next,
    desksCompleted: next.desksCompleted + 1,
    personalBestWinRun: Math.max(next.personalBestWinRun, summary.longestWinRun),
    largestPoolSpecificRatingClimb: climbs,
  };
}

export function buildPoolProgress(summaries: DeskSummary[], minimumGames = 3): ProgressSeries[] {
  const chronological = [...summaries].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const poolNames = new Set(chronological.flatMap((summary) => summary.pools.map((pool) => pool.pool)));
  return [...poolNames].sort().flatMap((poolName) => {
    const points = chronological.flatMap((summary) => {
      const pool = summary.pools.find((item) => item.pool === poolName && item.games >= minimumGames);
      return pool ? [{
        deskKey: summary.deskKey,
        periodLabel: summary.periodLabel,
        games: pool.games,
        scorePct: pool.scorePct,
        ratingDelta: pool.ratingDelta,
      }] : [];
    });
    return points.length >= 2 ? [{ pool: poolName, points }] : [];
  });
}

function families(summary: DeskSummary) {
  return Object.values(summary.signalFamilies).filter((family): family is SignalFamilyKey => Boolean(family));
}

export function deriveRecurringPatterns(summaries: DeskSummary[]): RecurringPattern[] {
  const chronological = [...summaries].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).slice(-4);
  if (chronological.length < 2) return [];
  const latest = chronological.at(-1)!;
  const previous = chronological.at(-2)!;
  const allFamilies = new Set(chronological.flatMap(families));
  const output: RecurringPattern[] = [];

  for (const family of allFamilies) {
    const appearances = chronological.filter((summary) => families(summary).includes(family)).length;
    if (appearances >= 2 && families(latest).includes(family)) {
      output.push({
        family,
        status: "repeated",
        appearances,
        desksCompared: chronological.length,
        message: `We've seen this before. This pattern crossed the evidence threshold in ${appearances} of your last ${chronological.length} Reviews.`,
      });
    } else if (families(previous).includes(family) && !families(latest).includes(family)) {
      output.push({
        family,
        status: "not-repeated",
        appearances,
        desksCompared: chronological.length,
        message: "That pattern was not repeated in this episode.",
      });
    }
  }
  return output.sort((a, b) => b.appearances - a.appearances || a.family.localeCompare(b.family));
}

export function buildEventHooks(
  latestDesk: BoardSignalDesk | undefined,
  currentEpisode: CurrentEpisodeSummary | undefined,
  now = new Date(),
): BoardSignalEventHook[] {
  const occurredAt = now.toISOString();
  const hooks: BoardSignalEventHook[] = [];
  if (latestDesk) {
    hooks.push({ type: "desk_ready", occurredAt, deskKey: deskKeyFor(latestDesk) });
    if (supported(latestDesk.signals.blue)) hooks.push({ type: "blue_reminder_available", occurredAt, deskKey: deskKeyFor(latestDesk) });
    if (supported(latestDesk.signals.amber)) hooks.push({ type: "amber_watch_available", occurredAt, deskKey: deskKeyFor(latestDesk) });
  }
  if (currentEpisode) {
    hooks.push({ type: currentEpisode.games ? "episode_progress" : "episode_started", occurredAt, data: { games: currentEpisode.games, daysComplete: currentEpisode.daysComplete } });
    if (currentEpisode.daysRemaining === 0 && currentEpisode.games === 0) hooks.push({ type: "inactive_episode", occurredAt });
  }
  return hooks;
}

export function buildSafePublicCoverage(
  desk: BoardSignalDesk,
  consent: boolean,
  visibility = { publicPlayerPage: true, universeCoverage: true },
): SafePublicCoverage | undefined {
  if (!consent || desk.source === "fixture" || !desk.provenance.verified || !desk.player.playerId) return undefined;
  const positiveRatingMovements = desk.pools.flatMap((pool) => {
    const delta = pool.change ?? (pool.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined
      ? pool.lastRecordedRating - pool.firstRecordedRating
      : undefined);
    return delta !== undefined && delta > 0 ? [{ pool: pool.pool, games: pool.games, delta }] : [];
  });
  const headline = desk.longestWinStreak >= 2
    ? `${desk.longestWinStreak} straight wins formed a positive run.`
    : (desk.checkmateWins ?? 0) > 0
      ? `${desk.checkmateWins} win${desk.checkmateWins === 1 ? "" : "s"} ended in checkmate.`
      : positiveRatingMovements[0]
        ? `${positiveRatingMovements[0].pool} moved +${positiveRatingMovements[0].delta} across the episode.`
        : desk.wins > 0
          ? `${desk.wins} completed win${desk.wins === 1 ? "" : "s"} in the episode.`
          : undefined;
  if (!headline) return undefined;
  return {
    chessPlayerId: String(desk.player.playerId),
    username: desk.player.username,
    avatar: desk.player.avatar,
    periodEnd: desk.period.end,
    periodLabel: desk.period.label,
    headline,
    visibility,
    positiveFacts: {
      games: desk.games,
      wins: desk.wins,
      draws: desk.draws,
      scorePct: desk.score >= 50 ? desk.score : undefined,
      longestWinRun: desk.longestWinStreak >= 2 ? desk.longestWinStreak : undefined,
      checkmateWins: (desk.checkmateWins ?? 0) > 0 ? desk.checkmateWins ?? undefined : undefined,
      positiveRatingMovements,
    },
  };
}
