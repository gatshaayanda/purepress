import { betaDesks, type BetaDesk } from "./boardsignal";
import { findSeededDesk } from "./seededDesks";
import type { CompletedReviewHistoryItem, ReviewHistoryPool } from "@/lib/boardsignal/reviewHistory";
import { deriveMomentFact, type UniverseParticipant, type UniversePoolFact } from "@/lib/boardsignal/universe";
import { toDeskSummary } from "@/lib/boardsignal/memory";
import type { BoardSignalDesk } from "@/lib/boardsignal/types";

export type OriginalBetaSourceRichness = "FULL_DESK" | "STRUCTURED_REVIEW" | "NARROW_SEED";

export type OriginalBetaSourceEntry = {
  handle: string;
  normalizedHandle: string;
  stablePlayerId?: number;
  caseId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  games: number;
  record: string;
  scorePct: number;
  format: string;
  headline: string;
  green: string;
  red: string;
  blue: string;
  publicStoryId: string;
  publicStoryHeadline: string;
  sourceRichness: OriginalBetaSourceRichness;
  sourceLabel: string;
  structured: StructuredOriginalBetaFacts;
  canonicalDesk?: BoardSignalDesk;
};

type StructuredOriginalBetaFacts = {
  pools?: ReviewHistoryPool[];
  longestWinRun?: number;
  longestLossRun?: number;
  checkmateWins?: number;
  strongFinish?: { games: number; wins: number; draws: number; losses: number };
  universePools?: UniversePoolFact[];
};

const STRUCTURED: Record<string, StructuredOriginalBetaFacts> = {
  bada_billa: {
    pools: [{ pool: "rapid", games: 8, wins: 5, draws: 1, losses: 2, scorePct: 68.8 }],
    longestWinRun: 4,
    longestLossRun: 1,
    checkmateWins: 2,
    strongFinish: { games: 4, wins: 4, draws: 0, losses: 0 },
  },
  bekzatt1: {
    pools: [
      { pool: "rapid", games: 12, wins: 9, draws: 1, losses: 2, scorePct: 79.2 },
      { pool: "blitz", games: 5, wins: 3, draws: 0, losses: 2, scorePct: 60 },
      { pool: "bullet", games: 1, wins: 1, draws: 0, losses: 0, scorePct: 100 },
    ],
    longestWinRun: 5,
    longestLossRun: 1,
    checkmateWins: 1,
  },
  kylian_mbappe_lottinreal: {
    pools: [
      { pool: "rapid", games: 8, wins: 3, draws: 1, losses: 4, scorePct: 43.8 },
      { pool: "blitz", games: 39, wins: 17, draws: 3, losses: 19, scorePct: 47.4 },
      { pool: "bullet", games: 9, wins: 3, draws: 1, losses: 5, scorePct: 38.9 },
    ],
    longestLossRun: 5,
    checkmateWins: 13,
  },
  mrinbetween23: {
    pools: [{ pool: "blitz", games: 19, wins: 10, draws: 1, losses: 8, scorePct: 55.3, ratingEnd: 2018, ratingHigh: 2039, ratingLow: 1986 }],
    longestWinRun: 5,
    longestLossRun: 6,
  },
  phonkrum: {
    pools: [{ pool: "blitz", games: 4, wins: 1, draws: 0, losses: 3, scorePct: 25 }],
    longestWinRun: 1,
    longestLossRun: 2,
  },
  captainrangade: {
    pools: [
      { pool: "rapid", games: 7, wins: 2, draws: 1, losses: 4, scorePct: 35.7 },
      { pool: "bullet", games: 2, wins: 1, draws: 0, losses: 1, scorePct: 50 },
    ],
    longestWinRun: 1,
    longestLossRun: 2,
    checkmateWins: 3,
  },
  i_pd_i: {
    pools: [{ pool: "rapid", games: 36, wins: 18, draws: 2, losses: 16, scorePct: 52.8, ratingEnd: 487, ratingHigh: 503, ratingLow: 463 }],
    longestWinRun: 4,
    longestLossRun: 4,
    checkmateWins: 6,
    strongFinish: { games: 3, wins: 0, draws: 1, losses: 2 },
  },
  snoopyissocute: {
    pools: [
      { pool: "rapid", games: 90, wins: 44, draws: 4, losses: 42, scorePct: 51.1, ratingEnd: 1568, ratingHigh: 1610, ratingLow: 1542 },
      { pool: "blitz", games: 6, wins: 6, draws: 0, losses: 0, scorePct: 100 },
      { pool: "bullet", games: 2, wins: 1, draws: 0, losses: 1, scorePct: 50 },
    ],
    longestWinRun: 7,
    longestLossRun: 4,
    checkmateWins: 12,
    strongFinish: { games: 17, wins: 6, draws: 0, losses: 11 },
  },
  jefsonfs: {
    pools: [{ pool: "rapid", games: 12, wins: 6, draws: 3, losses: 3, scorePct: 62.5, ratingStart: 1119, ratingEnd: 1146, ratingDelta: 27, ratingHigh: 1146, ratingLow: 1119 }],
    longestWinRun: 2,
    longestLossRun: 1,
    checkmateWins: 2,
  },
  iizorgii: {
    pools: [{ pool: "rapid", games: 89, wins: 39, draws: 3, losses: 47, scorePct: 45.5 }],
    longestWinRun: 6,
    checkmateWins: 15,
  },
  "i-know-kungfu": {
    pools: [
      { pool: "rapid", games: 22, wins: 11, draws: 1, losses: 10, scorePct: 52.3, ratingStart: 652, ratingEnd: 659, ratingDelta: 7, ratingHigh: 705 },
      { pool: "blitz", games: 1, wins: 1, draws: 0, losses: 0, scorePct: 100 },
    ],
    longestWinRun: 5,
    longestLossRun: 4,
    checkmateWins: 4,
  },
  harshhmishra: {
    pools: [{ pool: "bullet", games: 285, wins: 145, draws: 11, losses: 129, scorePct: 52.8, ratingStart: 1886, ratingEnd: 1977, ratingDelta: 91, ratingHigh: 2060 }],
    longestWinRun: 6,
    strongFinish: { games: 82, wins: 39, draws: 5, losses: 38 },
  },
  hxertzzz: {
    pools: [
      { pool: "rapid", games: 12, wins: 4, draws: 1, losses: 7, scorePct: 37.5 },
      { pool: "blitz", games: 1, wins: 0, draws: 0, losses: 1, scorePct: 0 },
      { pool: "bullet", games: 7, wins: 5, draws: 0, losses: 2, scorePct: 71.4 },
    ],
    longestWinRun: 3,
  },
  alexcet8: {},
};

const KNOWN_STABLE_PLAYER_IDS: Partial<Record<string, number>> = {
  // F.6 live-player correction: this original beta identity is already an established
  // modern BoardSignal account and must reconcile in place, never via Prepare App Access.
  hxertzzz: 580178460,
};

const CASE_IDS: Record<string, string> = {
  alexcet8: "BS-BETA-001",
  hxertzzz: "BS-BETA-003",
  harshhmishra: "BS-BETA-004",
  "i-know-kungfu": "BS-BETA-005",
  iizorgii: "BS-BETA-006",
  jefsonfs: "BS-BETA-007",
  snoopyissocute: "BS-BETA-008",
  i_pd_i: "BS-BETA-009",
  captainrangade: "BS-BETA-010",
  phonkrum: "BS-BETA-011",
  mrinbetween23: "BS-BETA-012",
  kylian_mbappe_lottinreal: "BS-BETA-013",
  bekzatt1: "BS-BETA-014",
  bada_billa: "BS-BETA-015",
};

function normalized(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function numericScore(value: string) {
  return Number(value.replace("%", ""));
}

function recordParts(record: string) {
  const wins = Number(/(\d+)W/.exec(record)?.[1] ?? 0);
  const draws = Number(/(\d+)D/.exec(record)?.[1] ?? 0);
  const losses = Number(/(\d+)L/.exec(record)?.[1] ?? 0);
  return { wins, draws, losses };
}

function canonicalDeskFor(desk: BetaDesk) {
  const candidate = findSeededDesk(desk.handle);
  return candidate?.provenance.verified
    && candidate.period.start === desk.periodStart
    && candidate.period.end === desk.periodEnd
    ? candidate
    : undefined;
}

export function originalBetaSourceInventory(): OriginalBetaSourceEntry[] {
  return betaDesks.map((desk) => {
    const key = normalized(desk.handle);
    const canonicalDesk = canonicalDeskFor(desk);
    const structured = STRUCTURED[key];
    const sourceRichness: OriginalBetaSourceRichness = canonicalDesk
      ? "FULL_DESK"
      : structured
        ? "STRUCTURED_REVIEW"
        : "NARROW_SEED";
    return {
      handle: desk.handle,
      normalizedHandle: key,
      stablePlayerId: KNOWN_STABLE_PLAYER_IDS[key],
      caseId: CASE_IDS[key] ?? `ORIGINAL-BETA:${key}`,
      period: desk.period,
      periodStart: desk.periodStart,
      periodEnd: desk.periodEnd,
      games: desk.games,
      record: desk.record,
      scorePct: numericScore(desk.score),
      format: desk.format,
      headline: desk.headline,
      green: desk.green,
      red: desk.red,
      blue: desk.blue,
      publicStoryId: desk.publicStory.id,
      publicStoryHeadline: desk.publicStory.headline,
      sourceRichness,
      sourceLabel: canonicalDesk
        ? `${CASE_IDS[key] ?? key} · verified repository canonical Desk`
        : structured
          ? `${CASE_IDS[key] ?? key} · verified original BoardSignal Fact/Replay/Signal/PDF material`
          : `src/data/boardsignal.ts betaDesks · narrow verified seed`,
      structured: structured ?? {},
      canonicalDesk,
    };
  });
}

export function findOriginalBetaSource(handle: string) {
  const key = normalized(handle);
  return originalBetaSourceInventory().find((entry) => entry.normalizedHandle === key);
}

export function originalBetaReviewKey(playerId: number, entry: Pick<OriginalBetaSourceEntry, "periodStart" | "periodEnd">) {
  return `${playerId}:${entry.periodStart}:${entry.periodEnd}`;
}

function historyPools(entry: OriginalBetaSourceEntry): ReviewHistoryPool[] {
  if (entry.canonicalDesk) return toDeskSummary(entry.canonicalDesk).pools;
  if (entry.structured.pools?.length) return entry.structured.pools;
  return [];
}

export function originalBetaHistoryItem(entry: OriginalBetaSourceEntry, playerId: number): CompletedReviewHistoryItem {
  const record = recordParts(entry.record);
  if (entry.canonicalDesk) {
    const summary = toDeskSummary(entry.canonicalDesk);
    return {
      reviewKey: originalBetaReviewKey(playerId, entry),
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      periodLabel: entry.period,
      source: "original_beta",
      sourceRichness: entry.sourceRichness,
      provenanceLabel: entry.sourceLabel,
      games: summary.games,
      wins: summary.wins,
      draws: summary.draws,
      losses: summary.losses,
      scorePct: summary.scorePct,
      format: entry.format,
      headline: entry.canonicalDesk.headline,
      pools: summary.pools,
      longestWinRun: summary.longestWinRun,
      longestLossRun: summary.longestLossRun,
      checkmateWins: entry.canonicalDesk.checkmateWins ?? undefined,
      medianGameLength: summary.medianGameLength,
      blackScorePct: summary.blackScorePct,
      signalFamilies: summary.signalFamilies,
      green: entry.canonicalDesk.signals.green.status === "withheld" ? undefined : { title: entry.canonicalDesk.signals.green.title, copy: entry.canonicalDesk.signals.green.copy },
      red: entry.canonicalDesk.signals.red.status === "withheld" ? undefined : { title: entry.canonicalDesk.signals.red.title, copy: entry.canonicalDesk.signals.red.copy },
      blue: entry.canonicalDesk.signals.blue.status === "withheld" ? undefined : { title: entry.canonicalDesk.signals.blue.title, copy: entry.canonicalDesk.signals.blue.copy },
      publicCoverageHref: `/feed#coverage-${entry.publicStoryId}`,
    };
  }
  return {
    reviewKey: originalBetaReviewKey(playerId, entry),
    periodStart: entry.periodStart,
    periodEnd: entry.periodEnd,
    periodLabel: entry.period,
    source: "original_beta",
    sourceRichness: entry.sourceRichness,
    provenanceLabel: entry.sourceLabel,
    games: entry.games,
    wins: record.wins,
    draws: record.draws,
    losses: record.losses,
    scorePct: entry.scorePct,
    format: entry.format,
    headline: entry.headline,
    pools: historyPools(entry),
    longestWinRun: entry.structured.longestWinRun,
    longestLossRun: entry.structured.longestLossRun,
    checkmateWins: entry.structured.checkmateWins,
    signalFamilies: {},
    green: { title: entry.green, copy: "" },
    red: { title: entry.red, copy: "" },
    blue: { title: "Original Beta Blue", copy: entry.blue },
    publicCoverageHref: `/feed#coverage-${entry.publicStoryId}`,
  };
}

function toUniversePool(pool: ReviewHistoryPool): UniversePoolFact | undefined {
  const normalizedPool = pool.pool.toLowerCase();
  const key = normalizedPool.includes("rapid") || /^\d+\+\d+$/.test(normalizedPool)
    ? "rapid"
    : normalizedPool.includes("blitz")
      ? "blitz"
      : normalizedPool.includes("bullet")
        ? "bullet"
        : undefined;
  if (!key) return undefined;
  return {
    pool: key,
    games: pool.games,
    start: pool.ratingStart,
    end: pool.ratingEnd,
    peak: pool.ratingHigh,
    low: pool.ratingLow,
    change: pool.ratingDelta,
  };
}

export function originalBetaUniverseParticipant(
  entry: OriginalBetaSourceEntry,
  identity: { playerId: number; canonicalUsername: string },
): UniverseParticipant {
  const history = originalBetaHistoryItem(entry, identity.playerId);
  const base: UniverseParticipant = {
    id: `live:${identity.canonicalUsername.toLowerCase()}`,
    stablePlayerId: String(identity.playerId),
    aliases: [entry.handle],
    player: identity.canonicalUsername,
    source: "live",
    verified: true,
    periodLabel: history.periodLabel,
    periodEnd: history.periodEnd,
    games: history.games,
    score: history.scorePct,
    winningRun: history.longestWinRun,
    checkmateWins: history.checkmateWins,
    pools: history.pools.map(toUniversePool).filter((pool): pool is UniversePoolFact => Boolean(pool)),
    strongFinish: entry.structured.strongFinish,
    coverage: {
      href: `/feed#coverage-${entry.publicStoryId}`,
      headline: entry.publicStoryHeadline,
    },
  };
  return { ...base, moment: deriveMomentFact(base) };
}
