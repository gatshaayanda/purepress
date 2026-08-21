import type { DeskRegressionFixture } from "./types";

export const snoopyFixture = {
  source: "fixture",
  verified: true,
  id: "snoopyissocute-2026-08-02",
  username: "snoopyissocute",
  period: { start: "2026-08-02", end: "2026-08-08" },
  expected: {
    games: 98,
    wins: 51,
    draws: 4,
    losses: 43,
    score: 54.1,
    longestWinStreak: 7,
    longestLossStreak: 4,
    pools: {
      rapid: { games: 90, wins: 44, draws: 4, losses: 42, lastRecordedRating: 1568, peak: 1610, low: 1542 },
      blitz: { games: 6, wins: 6, draws: 0, losses: 0 },
      bullet: { games: 2, wins: 1, draws: 0, losses: 1 },
    },
    rapidOpponentBand1600: { games: 14, wins: 3, draws: 1, losses: 10 },
  },
  invariants: [
    "Never replace established streaks with zero.",
    "Keep Rapid, Blitz and Bullet ratings separate.",
    "A passed-pawn Green requires verified repeated position evidence.",
  ],
} satisfies DeskRegressionFixture;

