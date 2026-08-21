import type { DeskRegressionFixture } from "./types";

export const harshhmishraFixture = {
  source: "fixture",
  verified: true,
  id: "harshhmishra-2026-07-30",
  username: "harshhmishra",
  period: { start: "2026-07-30", end: "2026-08-05" },
  expected: { games: 285, wins: 145, draws: 11, losses: 129, ratingChange: 91 },
  invariants: [
    "Extreme game volume must not truncate the factual record.",
    "Timeout counts alone cannot create a time-management diagnosis.",
    "Clock and board evidence must agree before timeout guidance publishes.",
  ],
} satisfies DeskRegressionFixture;

