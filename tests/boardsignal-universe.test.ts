import assert from "node:assert/strict";
import test from "node:test";
import type { BoardSignalDesk } from "../src/lib/boardsignal/types";
import {
  buildDeskReturnLoop,
  buildPlayerUniverseView,
  buildUniverseBoards,
  buildUniverseCategoryGroups,
  deskToUniverseParticipant,
  publicTopThree,
  type UniverseParticipant,
} from "../src/lib/boardsignal/universe";

function participant(
  player: string,
  pools: UniverseParticipant["pools"] = [],
  extra: Partial<UniverseParticipant> = {},
): UniverseParticipant {
  return {
    id: `seed:${player.toLowerCase()}`,
    player,
    source: "seed",
    verified: true,
    periodLabel: "3–9 August 2026",
    periodEnd: "2026-08-09",
    games: 12,
    score: 55,
    pools,
    coverage: { href: `/feed#${player}`, headline: `${player} positive coverage` },
    ...extra,
  };
}

function desk(username = "new-player", source: BoardSignalDesk["source"] = "live"): BoardSignalDesk {
  return {
    source,
    provenance: { verified: true, sourceLabel: "Universe test" },
    player: { requestedUsername: username, username },
    period: { start: "2026-08-03", end: "2026-08-09", label: "3–9 August 2026", isLastActive: false, latestCompletedLabel: "3–9 August 2026" },
    cadence: { anchorStart: "2026-08-03", nextStart: "2026-08-10", nextEnd: "2026-08-16", nextAvailableOn: "2026-08-17" },
    games: 10,
    wins: 7,
    draws: 0,
    losses: 3,
    score: 70,
    headline: "A positive test Desk.",
    summary: "Only public factual metrics enter recognition.",
    longestWinStreak: 4,
    longestLossStreak: 2,
    sessions: 2,
    checkmateWins: 2,
    timeoutLosses: 0,
    resignationLosses: 0,
    primaryPool: "rapid",
    days: [
      { date: "2026-08-03", label: "Mon 3", wins: 1, draws: 0, losses: 1 },
      { date: "2026-08-04", label: "Tue 4", wins: 0, draws: 0, losses: 0 },
      { date: "2026-08-05", label: "Wed 5", wins: 0, draws: 0, losses: 0 },
      { date: "2026-08-06", label: "Thu 6", wins: 0, draws: 0, losses: 0 },
      { date: "2026-08-07", label: "Fri 7", wins: 0, draws: 0, losses: 0 },
      { date: "2026-08-08", label: "Sat 8", wins: 2, draws: 0, losses: 1 },
      { date: "2026-08-09", label: "Sun 9", wins: 4, draws: 0, losses: 1 },
    ],
    pools: [{ pool: "rapid", games: 10, record: "7W · 0D · 3L", firstRecordedRating: 1700, lastRecordedRating: 1760, change: 60, peak: 1760, low: 1690 }],
    openings: [],
    signals: {
      green: { label: "Green · Preserve", title: "Positive fact", copy: "Positive public-safe fact." },
      amber: { label: "Amber · Monitor", title: "AMBER_PRIVATE_SENTINEL", copy: "Awareness only." },
      red: { label: "Red · Fix first", title: "PRIVATE_RED_SECRET", copy: "Never publish this." },
      blue: { label: "Blue · Carry with you", title: "Checks, captures, forcing threats.", copy: "A short ungraded reminder." },
    },
    candidates: [],
    caveats: [],
  };
}

test("rating boards remain pool-separated and enforce minimum games", () => {
  const field = [
    participant("RapidOne", [{ pool: "rapid", games: 12, start: 1000, end: 1030, change: 30 }]),
    participant("BulletOne", [{ pool: "bullet", games: 30, start: 1800, end: 1900, change: 100 }]),
    participant("TinySample", [{ pool: "rapid", games: 2, start: 900, end: 1100, change: 200 }]),
  ];
  const climbBoards = buildUniverseBoards(field).filter((board) => board.categoryId === "rating-climb");
  assert.equal(climbBoards.length, 2);
  assert.deepEqual(climbBoards.find((board) => board.scopeLabel === "Rapid")?.entries.map((item) => item.player), ["RapidOne"]);
  assert.deepEqual(climbBoards.find((board) => board.scopeLabel === "Bullet")?.entries.map((item) => item.player), ["BulletOne"]);
  assert.ok(!JSON.stringify(climbBoards).includes("TinySample"));
});

test("public recognition exposes only a positive top three", () => {
  const field = [
    participant("A", [], { winningRun: 9 }),
    participant("B", [], { winningRun: 8 }),
    participant("C", [], { winningRun: 7 }),
    participant("D", [], { winningRun: 6 }),
  ];
  const board = buildUniverseBoards(field).find((item) => item.categoryId === "winning-run")!;
  assert.deepEqual(publicTopThree(board).map((item) => item.player), ["A", "B", "C"]);
  assert.equal(publicTopThree(board).length, 3);
});

test("all eight achievement categories exist even while an evidence field is forming", () => {
  const groups = buildUniverseCategoryGroups([participant("A", [], { winningRun: 3 })]);
  assert.equal(groups.length, 8);
  assert.ok(groups.some((group) => group.id === "best-upset" && group.boards.length === 0));
});

test("a current LIVE Desk replaces the matching seed only in that player's comparison", () => {
  const current = desk("snoopyissocute", "live");
  const founding = [
    participant("snoopyissocute", [{ pool: "rapid", games: 90, end: 1568 }]),
    participant("Second", [{ pool: "rapid", games: 8, end: 1600 }]),
    participant("Third", [{ pool: "rapid", games: 8, end: 1500 }]),
  ];
  const view = buildPlayerUniverseView(founding, current)!;
  const rapid = view.standings.find((standing) => standing.categoryId === "rapid-rating-leader")!;
  assert.equal(rapid.denominator, 3);
  assert.equal(rapid.rank, 1);
  assert.equal(rapid.label, "PODIUM");
});

test("fixtures never enter recognition and private Signal Board text never enters a Universe participant", () => {
  assert.equal(deskToUniverseParticipant(desk("fixture-player", "fixture")), undefined);
  const publicParticipant = deskToUniverseParticipant(desk("live-player", "live"))!;
  const serialized = JSON.stringify(publicParticipant);
  assert.ok(!serialized.includes("PRIVATE_RED_SECRET"));
  assert.ok(!serialized.includes("AMBER_PRIVATE_SENTINEL"));
});

test("between-Desk return carries supported Blue and Amber, never Red", () => {
  const previous = desk();
  const loop = buildDeskReturnLoop(previous, []);
  assert.equal(loop.previousBlue?.title, "Checks, captures, forcing threats.");
  assert.equal(loop.amberWatch?.title, "AMBER_PRIVATE_SENTINEL");
  assert.equal(loop.nextDeskDueAt, "2026-08-17");
  assert.ok(!JSON.stringify(loop).includes("PRIVATE_RED_SECRET"));

  previous.signals.blue.status = "withheld";
  assert.equal(buildDeskReturnLoop(previous).previousBlue, undefined);
});
