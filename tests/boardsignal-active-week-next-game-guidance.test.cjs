const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const guidanceSource = read('src/lib/boardsignal/activeWeekGuidance.ts');
const processor = read('src/lib/boardsignal/processor.ts');
const route = read('src/app/api/boardsignal/player-room/route.ts');
const playerRoom = read('src/components/BoardSignalPlayerRoom.tsx');
const offlineRoom = read('src/components/OfflinePlayerRoom.tsx');

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
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'activeWeekGuidance.js' });
  return module.exports;
}

const {
  deriveActiveWeekNextGameGuidance,
  unavailableActiveWeekGuidance,
  withPreviousReviewGuidance,
} = loadGuidanceModule();

const fact = (overrides = {}) => ({
  id: 'g1:clock',
  gameId: 'g1',
  family: 'clock_conversion',
  occurredAt: 100,
  summary: 'A current-week game ended on time.',
  severity: 100,
  ...overrides,
});

const changedPaths = [
  'src/lib/boardsignal/activeWeekGuidance.ts',
  'src/lib/boardsignal/processor.ts',
  'src/app/api/boardsignal/player-room/route.ts',
  'src/components/BoardSignalPlayerRoom.tsx',
  'src/components/OfflinePlayerRoom.tsx',
  'tests/boardsignal-active-week-next-game-guidance.test.cjs',
];

test('B.1 is anchored to the exact pushed corrected A.2 baseline and extends the forming episode rather than replacing it', () => {
  assert.match(guidanceSource, /Patch B\.1 baseline: 0acc31a171f655c15f0cb99137d2c514e4253d76 \(Add full BoardSignal account deletion\)/);
  assert.match(guidanceSource, /CurrentEpisodeWithNextGameGuidance = CurrentEpisodeSummary & \{/);
  assert.match(guidanceSource, /nextGameGuidance: ActiveWeekNextGameGuidance/);
  assert.match(processor, /Promise<CurrentEpisodeWithNextGameGuidance>/);
  assert.match(processor, /status: "forming"/);
  assert.match(processor, /nextGameGuidance,/);
  assert.match(route, /snapshot\.currentEpisode = currentEpisode/);
  assert.match(route, /factualEpisodeCheckpoint/);
  assert.match(route, /buildPlayerRoomSnapshot\(token, factualCurrentEpisode, progressUnavailable\)/);
});

test('zero games never manufacture current evidence and previous Review guidance is a clearly sourced fallback', () => {
  const empty = deriveActiveWeekNextGameGuidance({ gamesConsidered: 0, currentLossRun: 0, evidence: [] });
  assert.equal(empty.status, 'insufficient_evidence');
  assert.equal(empty.source, 'insufficient_current_evidence');
  assert.equal(empty.reason, 'no_games');
  assert.equal(empty.supportingFacts.length, 0);

  const fallback = withPreviousReviewGuidance(empty, {
    title: 'Check forcing replies first.',
    copy: 'Scan checks and captures before committing.',
    family: 'forcing_reply',
    sourcePeriod: '3–9 August 2026',
  });
  assert.equal(fallback.status, 'fallback_previous_review');
  assert.equal(fallback.source, 'previous_review');
  assert.equal(fallback.title, 'Check forcing replies first.');
  assert.equal(fallback.previousReviewPeriod, '3–9 August 2026');
  assert.equal(fallback.evidenceCount, 0);
  assert.match(playerRoom, /FROM YOUR LAST REVIEW/);
});

test('a single concrete timeout can produce narrow guidance but one ordinary forcing-reply event cannot become recurrence', () => {
  const timeout = deriveActiveWeekNextGameGuidance({ gamesConsidered: 1, currentLossRun: 1, latestGameAt: 100, evidence: [fact()] });
  assert.equal(timeout.status, 'available');
  assert.equal(timeout.source, 'current_week');
  assert.equal(timeout.family, 'clock_conversion');
  assert.equal(timeout.evidenceCount, 1);
  assert.match(timeout.title, /clock/i);
  assert.doesNotMatch(`${timeout.title} ${timeout.copy}`, /pattern|always|weakness|biggest problem|why you are losing/i);

  const concreteBeatsRun = deriveActiveWeekNextGameGuidance({ gamesConsidered: 3, currentLossRun: 3, latestGameAt: 100, evidence: [fact()] });
  assert.equal(concreteBeatsRun.family, 'clock_conversion');

  const oneForcing = deriveActiveWeekNextGameGuidance({
    gamesConsidered: 1,
    currentLossRun: 0,
    evidence: [fact({ id: 'g1:forcing', family: 'forcing_reply', severity: 72 })],
  });
  assert.equal(oneForcing.status, 'insufficient_evidence');
  assert.equal(oneForcing.reason, 'no_supported_fact');

  const twoGameRepeatedForcing = deriveActiveWeekNextGameGuidance({
    gamesConsidered: 2,
    currentLossRun: 0,
    evidence: [
      fact({ id: 'g1:forcing', gameId: 'g1', family: 'forcing_reply', occurredAt: 100, severity: 72 }),
      fact({ id: 'g2:forcing', gameId: 'g2', family: 'forcing_reply', occurredAt: 200, severity: 74 }),
    ],
  });
  assert.equal(twoGameRepeatedForcing.status, 'insufficient_evidence');
  assert.equal(twoGameRepeatedForcing.reason, 'no_supported_fact');
});

test('repeated current evidence becomes eligible deterministically and returns exactly one primary action', () => {
  const input = {
    gamesConsidered: 3,
    currentLossRun: 0,
    latestGameAt: 300,
    evidence: [
      fact({ id: 'g1:f', gameId: 'g1', family: 'forcing_reply', occurredAt: 100, severity: 54, summary: 'Qd2 was followed by ...Qh4+.' }),
      fact({ id: 'g2:f', gameId: 'g2', family: 'forcing_reply', occurredAt: 300, severity: 58, summary: 'Rc1 was followed by ...Bb4+.' }),
    ],
  };
  const first = deriveActiveWeekNextGameGuidance(input);
  const second = deriveActiveWeekNextGameGuidance(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(first, second);
  assert.equal(first.status, 'available');
  assert.equal(first.family, 'forcing_reply');
  assert.equal(first.evidenceCount, 2);
  assert.equal(first.supportingFacts.length, 2);
  assert.equal(typeof first.title, 'string');
  assert.equal(typeof first.copy, 'string');
  assert.ok(!Array.isArray(first.title));
  assert.ok(!Array.isArray(first.copy));
});

test('current-week guidance stays primary; semantic reinforcement requires an actual stable family match, never keywords', () => {
  const current = deriveActiveWeekNextGameGuidance({ gamesConsidered: 4, currentLossRun: 0, evidence: [
    fact({ id: 'g1:q', gameId: 'g1', family: 'queen_safety', occurredAt: 100, severity: 90 }),
  ] });
  const different = withPreviousReviewGuidance(current, {
    title: 'Queen safety in forcing positions',
    copy: 'This text happens to mention queen but belongs to a different family.',
    family: 'forcing_reply',
    sourcePeriod: 'Previous Review',
  });
  assert.equal(different.source, 'current_week');
  assert.equal(different.family, 'queen_safety');
  assert.equal(different.reinforcement, undefined);

  const reinforced = withPreviousReviewGuidance(current, {
    title: 'Watch the queen before committing.',
    copy: 'Scan the reply first.',
    family: 'queen_safety',
    sourcePeriod: 'Previous Review',
  });
  assert.equal(reinforced.source, 'current_week_reinforces_previous_review');
  assert.equal(reinforced.family, 'queen_safety');
  assert.equal(reinforced.reinforcement.label, 'THIS IS STILL SHOWING UP');
  assert.equal(reinforced.title, current.title);
});

test('absence of current support never claims an old issue was fixed and unfinished guidance contains no final-diagnosis language', () => {
  const noSupport = deriveActiveWeekNextGameGuidance({ gamesConsidered: 2, currentLossRun: 0, evidence: [] });
  const serialized = JSON.stringify(noSupport);
  assert.doesNotMatch(serialized, /fixed|solved|improved|main weakness|biggest problem|why you are losing|calculation is weak|struggle under pressure/i);
  assert.doesNotMatch(guidanceSource, /Your main weakness is|Your biggest problem is|This is why you are losing|Your calculation is weak|You struggle under pressure|You fixed this/i);
});

test('guidance is derived from the already-retrieved active-week game set with no Stockfish or second Chess.com retrieval path', () => {
  const currentBuilder = section(processor, 'export async function buildCurrentEpisodeSummary', null);
  assert.match(currentBuilder, /const retrieved = \(await Promise\.all\(urls\.map\(fetchGames\)\)\)\.flat\(\)/);
  assert.match(currentBuilder, /for \(const game of games\)[\s\S]*guidanceEvidence\.push\(\.\.\.activeWeekEvidenceForGame\(game, resolved\.username\)\)/);
  assert.equal((currentBuilder.match(/urls\.map\(fetchGames\)/g) || []).length, 1);
  assert.doesNotMatch(guidanceSource, /fetch\(|Chess\.com|Stockfish|engineResult|quality PASS/i);
  assert.doesNotMatch(currentBuilder, /Stockfish|stockfish|engineResults|validateDeskForPublication/);
  assert.doesNotMatch(route, /api\.chess\.com|games\/archives|fetchGames/);
});

test('guidance failure is enrichment-only and cannot fail the factual CurrentEpisodeSummary', () => {
  const currentBuilder = section(processor, 'export async function buildCurrentEpisodeSummary', null);
  assert.match(currentBuilder, /try \{[\s\S]*deriveActiveWeekNextGameGuidance[\s\S]*\} catch \{[\s\S]*unavailableActiveWeekGuidance/);
  assert.match(currentBuilder, /wins,[\s\S]*draws,[\s\S]*losses,[\s\S]*pools:/);
  const unavailable = unavailableActiveWeekGuidance(5);
  assert.equal(unavailable.status, 'insufficient_evidence');
  assert.equal(unavailable.reason, 'derivation_unavailable');
  assert.equal(unavailable.gamesConsidered, 5);
  assert.match(playerRoom, /Next-game guidance isn't available yet/);
});

test('completed Review and A.1 pending factual-review paths remain separate from B.1 forming guidance', () => {
  const completedBuilder = section(processor, 'export async function buildLiveDesk', 'export function currentAlignedPeriod');
  assert.doesNotMatch(completedBuilder, /nextGameGuidance|deriveActiveWeekNextGameGuidance|guidanceEvidence|withPreviousReviewGuidance/);
  assert.match(playerRoom, /snapshot\.pendingFactualReview \? <UniversalPlayerDesk/);
  assert.match(route, /action\?: "acceptAgreement" \| "saveFactualReview" \| "publishDesk" \| "updatePreferences"/);
  assert.match(route, /savePendingFactualReview/);
  assert.match(route, /publishPrivateDesk/);
  assert.doesNotMatch(guidanceSource, /publishPrivateDesk|factualReview|quality|DeskEngineResult/);
});

test('B.1 stays private, uses existing C.1 classes, adds no dependency, and leaves locked access/deletion/public systems outside the delta', () => {
  const changed = changedPaths.join('\n');
  for (const locked of [
    'firestore.rules', 'package.json', 'package-lock.json', 'src/lib/boardsignal/quality.ts',
    'src/lib/boardsignal/server/accountDeletion.ts', 'src/lib/boardsignal/server/persistence.ts',
    'src/lib/boardsignal/factualReview.ts', 'public/stockfish/', 'public/sw.js', 'src/app/api/cron/',
    'src/lib/boardsignal/account.ts', 'src/lib/boardsignal/server/betaAccess.ts',
  ]) assert.ok(!changed.includes(locked), `${locked} must remain outside B.1 delta`);

  const combined = [guidanceSource, processor, route, playerRoom, offlineRoom].join('\n');
  assert.doesNotMatch(combined, /publicCoverage|publicShareMoments|publicUniverseEvents|shareAttribution|Player of the Week|universe ranking/i);
  assert.doesNotMatch(combined, /npm install|from "openai"|from 'openai'|anthropic|gemini|LLM/i);
  assert.match(playerRoom, /className="return-loop-blue"/);
  assert.match(playerRoom, /className="return-loop-amber"/);
  assert.match(playerRoom, /className="return-loop-next"/);
  assert.doesNotMatch(playerRoom, /style=\{|#[0-9a-f]{3,8}|rgb\(/i);
});

test('offline snapshot compatibility is preserved and saved guidance is read-only rather than recomputed offline', () => {
  assert.match(offlineRoom, /snapshot\?\.currentEpisode as CurrentEpisodeWithNextGameGuidance/);
  assert.match(offlineRoom, /Before your next game — saved/);
  assert.match(offlineRoom, /No new episode analysis runs offline/);
  assert.doesNotMatch(offlineRoom, /deriveActiveWeekNextGameGuidance|fetchGames|api\.chess\.com/);
  assert.ok(!changedPaths.includes('src/lib/boardsignal/offline/types.ts'));
  assert.ok(!changedPaths.includes('src/lib/boardsignal/offline/snapshots.ts'));
});

test('the consumer hierarchy makes BEFORE YOUR NEXT GAME primary and keeps factual stand-out separate', () => {
  const card = section(playerRoom, 'function CurrentEpisodeCard', 'function ProgressSection');
  const actionAt = card.indexOf('BEFORE YOUR NEXT GAME');
  const standoutAt = card.indexOf("WHAT'S STARTING TO STAND OUT?");
  const watchingAt = card.indexOf('WHAT BOARDSIGNAL IS WATCHING');
  const readyAt = card.indexOf('When the review will be ready:');
  assert.ok(actionAt > -1 && standoutAt > actionAt && watchingAt > standoutAt && readyAt > watchingAt);
  assert.doesNotMatch(card, /CARRY INTO YOUR NEXT GAMES/);
  assert.match(card, /Based on \$\{guidance\.gamesConsidered\}/);
  assert.match(card, /The completed Review remains the authority/);
});
