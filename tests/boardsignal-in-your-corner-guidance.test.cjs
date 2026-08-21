const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const guidanceSource = read("src/lib/boardsignal/activeWeekGuidance.ts");
const processor = read("src/lib/boardsignal/processor.ts");
const route = read("src/app/api/boardsignal/player-room/route.ts");
const playerRoom = read("src/components/BoardSignalPlayerRoom.tsx");
const css = read("src/app/globals.css");

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

function loadGuidanceModule() {
  const compiled = ts.transpileModule(guidanceSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require, console }, { filename: "activeWeekGuidance.js" });
  return module.exports;
}

const guidance = loadGuidanceModule();
const {
  ACTIVE_WEEK_GUIDANCE_CONSTANTS,
  deriveActiveWeekNextGameGuidance,
  withPreviousReviewGuidance,
} = guidance;

const baseFact = (overrides = {}) => ({
  id: "g1:material:1",
  gameId: "g1",
  gameUrl: "https://www.chess.com/game/live/1",
  family: "material_conversion",
  occurredAt: 100,
  opponent: "OpponentOne",
  opponentRating: 1234,
  pool: "rapid",
  moveNumber: 24,
  movePlayed: "Bg5",
  opponentReply: "Qxg5",
  summary: "Bg5 was followed by Qxg5.",
  severity: 70,
  ...overrides,
});

function f4Input(overrides = {}) {
  return {
    gamesConsidered: 35,
    currentLossRun: 0,
    latestGameAt: 300,
    playerKey: "player-a",
    periodStart: "2026-08-10",
    periodEnd: "2026-08-16",
    latestGame: {
      gameId: "g3",
      gameUrl: "https://www.chess.com/game/live/3",
      occurredAt: 300,
      opponent: "NewestOpponent",
      result: "win",
      pool: "rapid",
    },
    evidence: [
      baseFact(),
      baseFact({
        id: "g2:material:2",
        gameId: "g2",
        gameUrl: "https://www.chess.com/game/live/2",
        occurredAt: 200,
        opponent: "OpponentTwo",
        moveNumber: 31,
        movePlayed: "Rd5",
        opponentReply: "Qxd5",
        summary: "Rd5 was followed by Qxd5.",
      }),
    ],
    ...overrides,
  };
}

test("F.4 is anchored to the exact immutable baseline and keeps locked evidence constants unchanged", () => {
  assert.match(guidanceSource, /Patch B\.1 baseline: 0acc31a171f655c15f0cb99137d2c514e4253d76 \(Add full BoardSignal account deletion\)/);
  assert.match(guidanceSource, /69d7928bd0e5302595e0fcb44279cdf5f8f185eb/);
  assert.deepEqual(
    JSON.parse(JSON.stringify(ACTIVE_WEEK_GUIDANCE_CONSTANTS.MIN_DISTINCT_GAMES)),
    { clock_conversion: 1, queen_safety: 1, king_safety: 1, forcing_reply: 2, material_conversion: 2, loss_run: 2 },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(ACTIVE_WEEK_GUIDANCE_CONSTANTS.MIN_WEEK_GAMES)),
    { clock_conversion: 1, queen_safety: 1, king_safety: 1, forcing_reply: 3, material_conversion: 3, loss_run: 2 },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(ACTIVE_WEEK_GUIDANCE_CONSTANTS.ACTIONABILITY)),
    { clock_conversion: 100, queen_safety: 96, king_safety: 94, forcing_reply: 90, material_conversion: 84, loss_run: 68 },
  );
});

test("the pre-F.4 family choice remains stable for controlled factual fixtures", () => {
  const fixtures = [
    {
      expected: "clock_conversion",
      input: { gamesConsidered: 1, currentLossRun: 0, evidence: [baseFact({ id: "g1:c", gameId: "g1", family: "clock_conversion", severity: 100 })] },
    },
    {
      expected: "queen_safety",
      input: { gamesConsidered: 2, currentLossRun: 0, evidence: [baseFact({ id: "g1:q", gameId: "g1", family: "queen_safety", severity: 90 })] },
    },
    {
      expected: "king_safety",
      input: { gamesConsidered: 2, currentLossRun: 0, evidence: [baseFact({ id: "g1:k", gameId: "g1", family: "king_safety", severity: 90 })] },
    },
    {
      expected: "forcing_reply",
      input: { gamesConsidered: 3, currentLossRun: 0, evidence: [
        baseFact({ id: "g1:f", gameId: "g1", family: "forcing_reply", occurredAt: 100 }),
        baseFact({ id: "g2:f", gameId: "g2", family: "forcing_reply", occurredAt: 200 }),
      ] },
    },
    {
      expected: "material_conversion",
      input: { gamesConsidered: 3, currentLossRun: 0, evidence: [
        baseFact({ id: "g1:m", gameId: "g1", family: "material_conversion", occurredAt: 100 }),
        baseFact({ id: "g2:m", gameId: "g2", family: "material_conversion", occurredAt: 200 }),
      ] },
    },
    {
      expected: "loss_run",
      input: { gamesConsidered: 2, currentLossRun: 2, latestGameAt: 200, evidence: [] },
    },
  ];
  for (const fixture of fixtures) {
    assert.equal(deriveActiveWeekNextGameGuidance(fixture.input).family, fixture.expected);
  }
});

test("wording is deterministic, seed-driven, and keeps one semantic primary action", () => {
  const input = f4Input();
  const first = deriveActiveWeekNextGameGuidance(input);
  const second = deriveActiveWeekNextGameGuidance(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(first, second);
  assert.equal(first.family, "material_conversion");
  assert.equal(typeof first.primaryAction, "string");
  assert.match(first.primaryAction, /immediate capture/i);
  assert.doesNotMatch(guidanceSource, /Math\.random\s*\(/);
  assert.doesNotMatch(guidanceSource, /Date\.now\s*\(/);

  const signatures = (field, values) => new Set(values.map((value) => {
    const next = JSON.parse(JSON.stringify(input));
    if (field === "playerKey") next.playerKey = value;
    if (field === "latestGameId") next.latestGame.gameId = value;
    if (field === "supportingFactId") next.evidence[1].id = value;
    const result = deriveActiveWeekNextGameGuidance(next);
    return `${result.title}|${result.copy}`;
  }));

  assert.ok(signatures("playerKey", Array.from({ length: 18 }, (_, i) => `player-${i}`)).size > 1, "player identity must participate in wording seed");
  assert.ok(signatures("latestGameId", Array.from({ length: 18 }, (_, i) => `latest-${i}`)).size > 1, "latest game ID must participate in wording seed");
  assert.ok(signatures("supportingFactId", Array.from({ length: 18 }, (_, i) => `fact-${i}`)).size > 1, "newest supporting fact ID must participate in wording seed");
});

test("same family can read differently for controlled players without changing the action", () => {
  const variants = [];
  for (let i = 0; i < 30; i += 1) {
    const result = deriveActiveWeekNextGameGuidance(f4Input({ playerKey: `controlled-player-${i}` }));
    variants.push(result);
  }
  const byCopy = new Map(variants.map((item) => [`${item.title}|${item.copy}`, item]));
  assert.ok(byCopy.size > 1);
  assert.ok(variants.every((item) => item.family === "material_conversion"));
  assert.equal(new Set(variants.map((item) => item.primaryAction)).size, 1);
});

test("evidence count remains distinct-game count and the newest supporting fact keeps private game metadata", () => {
  const result = deriveActiveWeekNextGameGuidance(f4Input({
    evidence: [
      baseFact({ id: "g1:lower", gameId: "g1", occurredAt: 100, severity: 55 }),
      baseFact({ id: "g1:higher", gameId: "g1", occurredAt: 101, severity: 85 }),
      baseFact({ id: "g2:newest", gameId: "g2", occurredAt: 250, severity: 70, opponent: "PlayerB", gameUrl: "https://www.chess.com/game/live/222" }),
    ],
  }));
  assert.equal(result.evidenceCount, 2);
  assert.equal(result.supportingFacts[0].id, "g2:newest");
  assert.equal(result.supportingFacts[0].gameId, "g2");
  assert.equal(result.supportingFacts[0].gameUrl, "https://www.chess.com/game/live/222");
  assert.equal(result.supportingFacts[0].opponent, "PlayerB");
  assert.equal(result.supportingFacts[0].occurredAt, 250);
});

test("previous Review continuity still requires exact stable family match and says how much current evidence exists", () => {
  const current = deriveActiveWeekNextGameGuidance(f4Input());
  const different = withPreviousReviewGuidance(current, {
    title: "Check forcing replies first.",
    copy: "Scan the reply.",
    family: "forcing_reply",
    sourcePeriod: "3–9 August 2026",
  });
  assert.equal(different.reinforcement, undefined);

  const reinforced = withPreviousReviewGuidance(current, {
    title: "Count what comes back.",
    copy: "Check immediate captures.",
    family: "material_conversion",
    sourcePeriod: "3–9 August 2026",
  });
  assert.equal(reinforced.source, "current_week_reinforces_previous_review");
  assert.match(reinforced.reinforcement.copy, /independently added 2 supporting games so far/);
  assert.doesNotMatch(reinforced.reinforcement.copy, /same position|identical position|worsened|permanent weakness/i);
});

test("processor enriches only the already-retrieved current-week path and latestGame is the actual newest game", () => {
  const currentBuilder = section(processor, "export async function buildCurrentEpisodeSummary", null);
  assert.equal((currentBuilder.match(/urls\.map\(fetchGames\)/g) || []).length, 1);
  assert.doesNotMatch(currentBuilder, /Stockfish|stockfish|engineResults|validateDeskForPublication/);
  assert.match(currentBuilder, /const latestGameSource = games\.at\(-1\)/);
  assert.match(currentBuilder, /gameId: gameId\(latestGameSource\)/);
  assert.match(currentBuilder, /opponent: latestResult\.opponent\.username/);
  assert.match(currentBuilder, /result: latestResult\.result/);
  assert.match(currentBuilder, /pool: latestGameSource\.time_class \?\? "other"/);
  assert.match(currentBuilder, /selectedSupport = nextGameGuidance\.source === "current_week"[\s\S]*supportingFacts\.find\(\(fact\) => fact\.gameId === latestGameInput\.gameId\)/);
  assert.match(currentBuilder, /supportsSelectedGuidance: Boolean\(selectedSupport\)/);
  assert.match(currentBuilder, /guidanceEvidence\.push\(\.\.\.activeWeekEvidenceForGame\(game, resolved\.username\)\)/);
});

test("supporting facts carry factual game URL, opponent, time, pool, and legal move/reply metadata", () => {
  const active = section(processor, "function activeWeekEvidenceForGame", "function selectCandidates");
  for (const token of [
    "gameUrl: game.url",
    "occurredAt: game.end_time",
    "opponent: result.opponent.username",
    "opponentRating: result.opponent.rating",
    'pool: game.time_class ?? "other"',
    "moveNumber: candidate.moveNumber",
    "movePlayed: candidate.movePlayed",
    "opponentReply: candidate.opponentReply",
  ]) assert.ok(active.includes(token), `missing ${token}`);
  assert.match(active, /if \(result\.result !== "loss"\) return \[\]/);
});

test("durable forming-week persistence strips both temporary F.4 enrichments while private response keeps them", () => {
  const checkpoint = section(route, "function factualEpisodeCheckpoint", "export async function GET");
  assert.match(checkpoint, /const \{ nextGameGuidance, latestGame, \.\.\.factualEpisode \} = episode/);
  assert.match(checkpoint, /void nextGameGuidance/);
  assert.match(checkpoint, /void latestGame/);
  assert.match(route, /snapshot\.currentEpisode = currentEpisode/);
  assert.match(route, /playerKey: account\.uid/);
});

test("Player Room presents evidence-aware counts, latest game, newest relevant example, and exact Chess.com link", () => {
  const card = section(playerRoom, "function CurrentEpisodeCard", "function ProgressSection");
  assert.match(card, /Seen in \$\{evidenceCount\} of \$\{guidance\.gamesConsidered\}/);
  assert.match(card, /Current run: \$\{evidenceCount\} loss/);
  assert.match(card, /FROM YOUR LAST REVIEW/);
  assert.match(card, /YOUR LAST GAME/);
  assert.match(card, /MOST RECENT EXAMPLE/);
  assert.match(card, /guidance\.supportingFacts\[0\]/);
  assert.match(card, /href=\{mostRecentExample\.gameUrl\}/);
  assert.match(card, /movePlayed\} → \{mostRecentExample\.opponentReply/);
  assert.doesNotMatch(card, /all \$\{guidance\.gamesConsidered\} games support/i);
});

test("latest game is acknowledged without fabricating correction evidence", () => {
  const currentBuilder = section(processor, "export async function buildCurrentEpisodeSummary", null);
  const evidenceBuilder = section(processor, "function activeWeekEvidenceForGame", "function selectCandidates");
  assert.match(evidenceBuilder, /if \(result\.result !== "loss"\) return \[\]/, "wins/draws remain outside correction candidates");
  assert.match(currentBuilder, /supportingSummary: selectedSupport\?\.summary/);
  assert.match(guidanceSource, /didn't add another example|did not add fresh support|added no new example|did not add another example/);
  assert.doesNotMatch(guidanceSource, /New weakness|new weakness|blunder|best move|evaluation swing/i);
});

test("device-local new-game detection is UID+period scoped and first observation stays quiet", () => {
  const card = section(playerRoom, "function CurrentEpisodeCard", "function ProgressSection");
  assert.match(card, /boardsignal:last-current-game:\$\{uid\}:\$\{episode\.periodStart\}/);
  assert.match(card, /if \(!previous \|\| previous === latestGameId\) \{\s*setLiveStatus\("null"\)|if \(!previous \|\| previous === latestGameId\) \{[\s\S]*setLiveStatus\(null\)/);
  assert.match(card, /setLiveStatus\("new"\)/);
  assert.match(card, /NEW GAME SEEN/);
  assert.match(card, /UPDATED AFTER YOUR LAST GAME/);
  assert.match(card, /2600/);
  assert.match(card, /role="status"/);
  assert.match(card, /aria-live="polite"/);
  assert.match(card, /if \(!online \|\| !latestGameId/);
});

test("focus/visibility refresh is quiet, throttled, online-only, and non-overlapping with reconnect refresh", () => {
  const refresh = section(playerRoom, 'window.addEventListener("boardsignal:reconnected"', "// If a live Player Room loses reachability");
  assert.match(playerRoom, /const FOCUS_REFRESH_THROTTLE_MS = 75_000/);
  assert.match(refresh, /connectivity\.online/);
  assert.match(refresh, /window\.addEventListener\("focus", refreshAfterReturn\)/);
  assert.match(refresh, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(refresh, /loadRoom\(user, true\)/);
  assert.match(refresh, /focusRefreshRef\.current \|\| reconnectRefreshRef\.current/);
  assert.doesNotMatch(refresh, /setInterval\s*\(/);
});

test("new-game pulse is finite, text-backed, and disabled under reduced motion", () => {
  assert.match(css, /animation: boardsignal-corner-status-pulse 1\.15s ease-in-out 2/);
  assert.doesNotMatch(css, /boardsignal-corner-status-pulse[^;]*infinite/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.corner-live-status\.is-new\s*\{[\s\S]*animation: none/);
  assert.match(playerRoom, /NEW GAME SEEN/);
});

test("private/public boundary and locked systems remain outside the F.4 delta", () => {
  const lockedBlobShas = {
    "package.json": "95e6b72c781711c23b9b1a173a6c2c16bafb5882",
    "package-lock.json": "0a6af980d8c90f8a877045e323993785806756bf",
    "firestore.rules": "a08d287ecba85bec03ca68db327fb8a92a304b2a",
    "src/lib/boardsignal/server/betaRequests.ts": "a11cf44cb351ac22624a1b5d1aa1d30db0da1e52",
    "src/lib/boardsignal/server/betaAccess.ts": "b2720b7dc543b191e96433a5e3ec553d44932c28",
    "src/lib/boardsignal/playerEntryRecovery.mjs": "74ca0dc9e8b002f07792610454468be09673f959",
    "src/lib/boardsignal/firstReviewGeneration.mjs": "d8d375e1ad421674e27d3ae40c683ae165a503c7",
  };
  const gitBlobSha = (content) => crypto.createHash("sha1").update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest("hex");
  for (const [file, expected] of Object.entries(lockedBlobShas)) {
    assert.equal(gitBlobSha(fs.readFileSync(path.join(root, file))), expected, `${file} changed from F.4 baseline`);
  }
  assert.doesNotMatch([guidanceSource, processor, route, playerRoom].join("\n"), /publicCoverage|publicShareMoments|publicUniverseEvents|Universe\/public share code changed/i);
});

test("changed TS/TSX files have zero isolated-transpile diagnostics", () => {
  for (const file of [
    "src/lib/boardsignal/activeWeekGuidance.ts",
    "src/lib/boardsignal/processor.ts",
    "src/app/api/boardsignal/player-room/route.ts",
    "src/components/BoardSignalPlayerRoom.tsx",
  ]) {
    const result = ts.transpileModule(read(file), {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, `${file}: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("; ")}`);
  }
});
