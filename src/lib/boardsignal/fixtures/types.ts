export type DeskRegressionFixture = {
  source: "fixture";
  verified: true;
  id: string;
  username: string;
  period: { start: string; end: string };
  expected: Record<string, unknown>;
  invariants: string[];
};

