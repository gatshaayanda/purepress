import type {
  DeskSignalFamilies,
  ProgressSeries,
  RecurringPattern,
  SignalFamilyKey,
  DeskSummary,
} from "./memory";
import type { BoardSignalDesk } from "./types";

export type ReviewHistoryPool = {
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

export type ReviewHistorySignal = {
  title: string;
  copy: string;
};

export type CompletedReviewHistoryItem = {
  reviewKey: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  source: "live" | "original_beta";
  sourceRichness: "LIVE_DESK" | "FULL_DESK" | "STRUCTURED_REVIEW" | "NARROW_SEED";
  provenanceLabel: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  scorePct: number;
  format?: string;
  headline: string;
  pools: ReviewHistoryPool[];
  longestWinRun?: number;
  longestLossRun?: number;
  checkmateWins?: number;
  medianGameLength?: number;
  blackScorePct?: number;
  signalFamilies: DeskSignalFamilies;
  green?: ReviewHistorySignal;
  red?: ReviewHistorySignal;
  blue?: ReviewHistorySignal;
  publicCoverageHref?: string;
};

function supported(signal: BoardSignalDesk["signals"]["blue"]) {
  return signal.status !== "withheld" && Boolean(signal.title.trim());
}

export function liveDeskToReviewHistory(desk: BoardSignalDesk, summary: DeskSummary): CompletedReviewHistoryItem {
  return {
    reviewKey: summary.deskKey,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    periodLabel: summary.periodLabel,
    source: "live",
    sourceRichness: "LIVE_DESK",
    provenanceLabel: desk.provenance.sourceLabel,
    games: summary.games,
    wins: summary.wins,
    draws: summary.draws,
    losses: summary.losses,
    scorePct: summary.scorePct,
    format: desk.primaryPool,
    headline: desk.headline,
    pools: summary.pools,
    longestWinRun: summary.longestWinRun,
    longestLossRun: summary.longestLossRun,
    checkmateWins: desk.checkmateWins ?? undefined,
    medianGameLength: summary.medianGameLength,
    blackScorePct: summary.blackScorePct,
    signalFamilies: summary.signalFamilies,
    green: supported(desk.signals.green) ? { title: desk.signals.green.title, copy: desk.signals.green.copy } : undefined,
    red: supported(desk.signals.red) ? { title: desk.signals.red.title, copy: desk.signals.red.copy } : undefined,
    blue: supported(desk.signals.blue) ? { title: desk.signals.blue.title, copy: desk.signals.blue.copy } : undefined,
  };
}

export function buildReviewProgress(history: CompletedReviewHistoryItem[], minimumGames = 3): ProgressSeries[] {
  const chronological = [...history].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const poolNames = new Set(chronological.flatMap((review) => review.pools.map((pool) => pool.pool.toLowerCase())));
  return [...poolNames].sort().flatMap((poolName) => {
    const points = chronological.flatMap((review) => {
      const pool = review.pools.find((item) => item.pool.toLowerCase() === poolName && item.games >= minimumGames);
      if (!pool) return [];
      if (pool.scorePct === undefined && pool.ratingDelta === undefined) return [];
      return [{
        deskKey: review.reviewKey,
        periodLabel: review.periodLabel,
        games: pool.games,
        scorePct: pool.scorePct,
        ratingDelta: pool.ratingDelta,
      }];
    });
    return points.length >= 2 ? [{ pool: poolName, points }] : [];
  });
}

function families(review: CompletedReviewHistoryItem) {
  return Object.values(review.signalFamilies).filter((family): family is SignalFamilyKey => Boolean(family));
}

export function deriveRecurringPatternsFromReviewHistory(history: CompletedReviewHistoryItem[]): RecurringPattern[] {
  const chronological = [...history].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).slice(-4);
  if (chronological.length < 2) return [];
  const latest = chronological.at(-1)!;
  const previous = chronological.at(-2)!;
  const allFamilies = new Set(chronological.flatMap(families));
  const output: RecurringPattern[] = [];
  for (const family of allFamilies) {
    const appearances = chronological.filter((review) => families(review).includes(family)).length;
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
        message: "This did not reappear as a supported signal in your latest completed Review.",
      });
    }
  }
  return output.sort((a, b) => b.appearances - a.appearances || a.family.localeCompare(b.family));
}
