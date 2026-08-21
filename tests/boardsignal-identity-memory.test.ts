import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createFoundingBetaAccount,
  firebaseUidForChessPlayer,
  getChessComOAuthStatus,
} from "../src/lib/boardsignal/account";
import {
  CHESSCOM_CANONICAL_CALLBACK_URI,
  CHESSCOM_NON_WWW_CALLBACK_URI,
  resolveChessComCallbackUri,
} from "../src/lib/boardsignal/auth/callbackUri";
import {
  buildPoolProgress,
  buildEventHooks,
  buildSafePublicCoverage,
  deriveRecurringPatterns,
  retainLatestFour,
  toDeskSummary,
  type CurrentEpisodeSummary,
  type DeskSummary,
} from "../src/lib/boardsignal/memory";
import { currentAlignedPeriod } from "../src/lib/boardsignal/processor";
import type { BoardSignalDesk } from "../src/lib/boardsignal/types";

function desk(periodStart = "2026-08-03", periodEnd = "2026-08-09"): BoardSignalDesk {
  return {
    source: "live",
    provenance: { verified: true, sourceLabel: "Identity memory test" },
    player: { requestedUsername: "PlayerOne", username: "PlayerOne", playerId: 12345 },
    period: { start: periodStart, end: periodEnd, label: `${periodStart} to ${periodEnd}`, isLastActive: false, latestCompletedLabel: `${periodStart} to ${periodEnd}` },
    episodeKey: `12345:${periodStart}:${periodEnd}`,
    cadence: { anchorStart: "2026-08-03", nextStart: "2026-08-10", nextEnd: "2026-08-16", nextAvailableOn: "2026-08-17" },
    games: 10,
    wins: 6,
    draws: 1,
    losses: 3,
    score: 65,
    headline: "A positive factual week.",
    summary: "A deterministic summary.",
    longestWinStreak: 4,
    longestLossStreak: 2,
    sessions: 3,
    checkmateWins: 2,
    timeoutLosses: 0,
    resignationLosses: 1,
    primaryPool: "rapid",
    days: [
      { date: periodStart, label: "Mon", wins: 2, draws: 0, losses: 1 },
      { date: "2026-08-04", label: "Tue", wins: 1, draws: 0, losses: 1 },
      { date: "2026-08-05", label: "Wed", wins: 1, draws: 0, losses: 0 },
      { date: "2026-08-06", label: "Thu", wins: 0, draws: 1, losses: 0 },
      { date: "2026-08-07", label: "Fri", wins: 1, draws: 0, losses: 1 },
      { date: "2026-08-08", label: "Sat", wins: 0, draws: 0, losses: 0 },
      { date: periodEnd, label: "Sun", wins: 1, draws: 0, losses: 0 },
    ],
    pools: [{ pool: "rapid", games: 10, wins: 6, draws: 1, losses: 3, record: "6W · 1D · 3L", firstRecordedRating: 1500, lastRecordedRating: 1530, change: 30, peak: 1540, low: 1490 }],
    openings: [{ name: "Sicilian", games: 3 }],
    colorRecords: {
      white: { games: 5, wins: 3, draws: 1, losses: 1, record: "3W · 1D · 1L" },
      black: { games: 5, wins: 3, draws: 0, losses: 2, record: "3W · 0D · 2L" },
    },
    gameLength: { averageMoves: 30, medianMoves: 29, shortestMoves: 12, longestMoves: 55 },
    signals: {
      green: { label: "Green", title: "Winning run", copy: "Four straight.", status: "supported" },
      amber: { label: "Amber", title: "PRIVATE_AMBER", copy: "Private awareness.", status: "supported" },
      red: { label: "Red", title: "PRIVATE_RED", copy: "Private weakness.", status: "supported", evidenceIds: ["P01", "P02"] },
      blue: { label: "Blue", title: "Checks, captures, threats.", copy: "Private guidance.", status: "supported", evidenceIds: ["P01", "P02"] },
    },
    candidates: [
      { id: "P01", gameUrl: "https://www.chess.com/game/live/1", opponent: "A", playerColor: "white", result: "loss", reason: "Review", role: "correction", motif: "forcing-reply", reconstruction: "legal" },
      { id: "P02", gameUrl: "https://www.chess.com/game/live/2", opponent: "B", playerColor: "black", result: "loss", reason: "Review", role: "correction", motif: "forcing-reply", reconstruction: "legal" },
    ],
    caveats: [],
  };
}

function summary(index: number, family: DeskSummary["signalFamilies"] = {}): DeskSummary {
  const day = String(index).padStart(2, "0");
  return {
    deskKey: `desk-${index}`,
    periodStart: `2026-07-${day}`,
    periodEnd: `2026-07-${String(index + 6).padStart(2, "0")}`,
    periodLabel: `Desk ${index}`,
    games: 10,
    wins: 5,
    draws: 0,
    losses: 5,
    scorePct: 50,
    pools: [{ pool: "rapid", games: 10, scorePct: 50 + index, ratingDelta: index * 5 }],
    longestWinRun: index,
    longestLossRun: 2,
    signalFamilies: family,
  };
}

test("Chess.com OAuth stays safely disabled until real provider and server configuration exists", () => {
  const status = getChessComOAuthStatus({});
  assert.equal(status.enabled, false);
  assert.match(status.message, /awaiting official provider approval/i);
  assert.ok(status.missing.includes("CHESSCOM_CLIENT_ID"));
});

test("Chess.com callback stays on the canonical route and accepts only registered origin variants", () => {
  assert.equal(resolveChessComCallbackUri(CHESSCOM_CANONICAL_CALLBACK_URI, "production"), CHESSCOM_CANONICAL_CALLBACK_URI);
  assert.equal(resolveChessComCallbackUri(CHESSCOM_NON_WWW_CALLBACK_URI, "production"), CHESSCOM_NON_WWW_CALLBACK_URI);
  assert.equal(resolveChessComCallbackUri("http://localhost:3000/api/auth/chesscom/callback", "development"), "http://localhost:3000/api/auth/chesscom/callback");
  assert.equal(resolveChessComCallbackUri("http://127.0.0.1:3001/api/auth/chesscom/callback", "test"), "http://127.0.0.1:3001/api/auth/chesscom/callback");
  assert.equal(resolveChessComCallbackUri("http://localhost:3000/api/auth/chesscom/callback", "production"), undefined);
  assert.equal(resolveChessComCallbackUri("https://example.com/api/auth/chesscom/callback", "production"), undefined);
  assert.equal(resolveChessComCallbackUri("https://www.adminhub-global.com/api/auth/chesscom/renamed", "production"), undefined);
  assert.equal(resolveChessComCallbackUri(`${CHESSCOM_CANONICAL_CALLBACK_URI}?next=elsewhere`, "production"), undefined);
});

test("stable Chess.com player ID always maps to the same Firebase uid and founding entitlement", () => {
  assert.equal(firebaseUidForChessPlayer(12345), firebaseUidForChessPlayer(12345));
  const account = createFoundingBetaAccount({ playerId: 12345, canonicalUsername: "PlayerOne" }, new Date("2026-08-11T00:00:00Z"));
  assert.equal(account.uid, "chesscom_12345");
  assert.equal(account.accessTier, "founding_beta");
  assert.equal(account.billingRequired, false);
  assert.equal(account.maxActiveDesks, 4);
});

test("existing public-username LIVE generation remains wired while OAuth is pending", () => {
  const buildPage = readFileSync("src/app/boardsignal/build/[handle]/page.tsx", "utf8");
  const liveRoute = readFileSync("src/app/api/boardsignal/[username]/route.ts", "utf8");
  assert.match(buildPage, /UniversalPlayerDesk/);
  assert.match(liveRoute, /buildLiveDesk/);
});

test("Firestore rules make private users, Desks and evidence owner-only", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.match(rules, /match \/desks\/\{deskKey\}/);
  assert.match(rules, /match \/evidence\/\{positionId\}/);
  assert.match(rules, /match \/publicCoverage\/\{coverageId\}[\s\S]*allow read: if true;[\s\S]*allow write: if isBoardSignalAdmin\(\)/);
});

test("public coverage helper withholds safely when disabled and contains no private Signal Board content when included", () => {
  const privateDesk = desk();
  assert.equal(buildSafePublicCoverage(privateDesk, false), undefined);
  const publicCoverage = buildSafePublicCoverage(privateDesk, true)!;
  const serialized = JSON.stringify(publicCoverage);
  assert.ok(!serialized.includes("PRIVATE_RED"));
  assert.ok(!serialized.includes("PRIVATE_AMBER"));
  assert.ok(!serialized.includes("Checks, captures, threats"));
  assert.ok(!serialized.includes("candidates"));
  assert.notEqual(publicCoverage.headline, privateDesk.headline);
  assert.equal(publicCoverage.visibility.publicPlayerPage, true);
});

test("notification preparation preserves deterministic hooks while account delivery preferences default safely", () => {
  const current: CurrentEpisodeSummary = {
    status: "forming",
    periodStart: "2026-08-10",
    periodEnd: "2026-08-16",
    periodLabel: "10–16 August 2026",
    checkedAt: "2026-08-12T00:00:00.000Z",
    daysComplete: 3,
    daysRemaining: 4,
    games: 2,
    wins: 1,
    draws: 0,
    losses: 1,
    currentWinRun: 0,
    currentLossRun: 1,
    sessions: 1,
    pools: [],
    nextDeskDueAt: "2026-08-17",
  };
  const hooks = buildEventHooks(desk(), current, new Date("2026-08-12T00:00:00.000Z"));
  assert.deepEqual(hooks.map((hook) => hook.type), ["desk_ready", "blue_reminder_available", "amber_watch_available", "episode_progress"]);
  const account = createFoundingBetaAccount({ playerId: 12345, canonicalUsername: "PlayerOne" });
  assert.equal(account.notificationPreferences.email, false);
  assert.equal(account.notificationPreferences.browserPush, false);
});

test("Desk 5 retains only the latest four and identifies Desk 1 for heavy deletion", () => {
  const result = retainLatestFour([1, 2, 3, 4, 5].map((index) => summary(index)));
  assert.deepEqual(result.retained.map((item) => item.deskKey), ["desk-5", "desk-4", "desk-3", "desk-2"]);
  assert.deepEqual(result.removed.map((item) => item.deskKey), ["desk-1"]);
  const persistence = readFileSync("src/lib/boardsignal/server/persistence.ts", "utf8");
  assert.match(persistence, /deleteDeskTree/);
  assert.match(persistence, /collection\("evidence"\)/);
});

test("cross-Desk progress never mixes rating pools", () => {
  const first = summary(1);
  first.pools.push({ pool: "blitz", games: 4, scorePct: 75, ratingDelta: 20 });
  const second = summary(2);
  second.pools.push({ pool: "blitz", games: 4, scorePct: 50, ratingDelta: -5 });
  const progress = buildPoolProgress([first, second]);
  assert.deepEqual(progress.map((series) => series.pool), ["blitz", "rapid"]);
  assert.deepEqual(progress.find((series) => series.pool === "rapid")?.points.map((point) => point.ratingDelta), [5, 10]);
  assert.deepEqual(progress.find((series) => series.pool === "blitz")?.points.map((point) => point.ratingDelta), [20, -5]);
});

test("recurrence requires repeated stable family keys and never claims a pattern was fixed", () => {
  const repeated = deriveRecurringPatterns([
    summary(1, { redFamily: "forcing_reply" }),
    summary(2, { redFamily: "forcing_reply" }),
  ]);
  assert.equal(repeated[0].status, "repeated");
  assert.equal(repeated[0].appearances, 2);
  assert.match(repeated[0].message, /2 of your last 2 Reviews/);

  const notRepeated = deriveRecurringPatterns([
    summary(1, { redFamily: "forcing_reply" }),
    summary(2, {}),
  ]);
  assert.equal(notRepeated[0].status, "not-repeated");
  assert.match(notRepeated[0].message, /not repeated/i);
  assert.doesNotMatch(notRepeated[0].message, /fixed|mission|learned/i);
});

test("forming episode is separate factual state and cannot mutate the completed Desk", () => {
  const completed = desk();
  const before = JSON.stringify(completed);
  const period = currentAlignedPeriod("2026-08-03", new Date("2026-08-13T12:00:00Z"));
  const forming: CurrentEpisodeSummary = {
    status: "forming",
    periodStart: period.start.toISOString().slice(0, 10),
    periodEnd: period.end.toISOString().slice(0, 10),
    periodLabel: "10–16 August 2026",
    checkedAt: "2026-08-13T12:00:00.000Z",
    daysComplete: 4,
    daysRemaining: 3,
    games: 7,
    wins: 4,
    draws: 0,
    losses: 3,
    currentWinRun: 1,
    currentLossRun: 0,
    sessions: 2,
    pools: [{ pool: "rapid", games: 7, wins: 4, draws: 0, losses: 3, ratingDelta: 18 }],
    nextDeskDueAt: "2026-08-17",
  };
  assert.equal(JSON.stringify(completed), before);
  assert.equal(forming.status, "forming");
  assert.ok(!JSON.stringify(forming).match(/red|amber|blue|signal/i));
});

test("previous Blue carries only when supported and summary families are stable evidence keys", () => {
  const supported = toDeskSummary(desk());
  assert.equal(supported.previousBlue?.title, "Checks, captures, threats.");
  assert.equal(supported.signalFamilies.redFamily, "forcing_reply");
  assert.equal(supported.signalFamilies.blueFamily, "forcing_reply");
  const withheld = desk();
  withheld.signals.blue.status = "withheld";
  assert.equal(toDeskSummary(withheld).previousBlue, undefined);
});

test("Stockfish 18 worker assets remain byte-for-byte unchanged", () => {
  const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(hash("public/stockfish/stockfish-18-lite-single.js"), "5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391");
  assert.equal(hash("public/stockfish/stockfish-18-lite-single.wasm"), "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1");
  assert.equal(hash("scripts/stockfish-smoke.mjs"), "3c67ee671c4e0859b14160ed2f3c9c977896530ee6ef4d6329e486e751d64164");
});
