import type { DeskRegressionFixture } from "./types";

export const edwardFixture = {
  source: "fixture",
  verified: true,
  id: "edward-resignation-guard",
  username: "edward",
  period: { start: "unavailable", end: "unavailable" },
  expected: { resignationCount: 52 },
  invariants: [
    "The factual resignation count may be displayed.",
    "The count must never automatically become a premature-resignation diagnosis.",
    "Repeated playable engine evaluations are required for resignation guidance.",
  ],
} satisfies DeskRegressionFixture;

