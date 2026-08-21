const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const COMPONENT = fs.readFileSync(path.join(ROOT, 'src/components/BetaPreviewRoom.tsx'), 'utf8');
const MANIFEST_PATH = path.join(ROOT, 'PATCH-MANIFEST.txt');
const BASELINE = 'bbe315dfce65a668985a2ca24f9522670ebeef07';

let runtime;

test.before(async () => {
  runtime = await import(pathToFileURL(path.join(ROOT, 'src/lib/boardsignal/previewRuntime.mjs')).href);
});

const preview = (headline = 'A steady week') => ({
  canonicalUsername: 'runtime_tester',
  playerId: 991,
  playableWeek: true,
  games: 12,
  wins: 7,
  draws: 1,
  losses: 4,
  score: 62.5,
  pools: [{ pool: 'rapid', games: 12 }],
  safeHeadline: headline,
  safeHighlight: 'You finished the week strongly.',
  universePreview: [],
  publicPlayers: [],
  recentUniverseActivity: [],
  generatedAt: '2026-08-16T01:00:00.000Z',
});

const readyStatus = (overrides = {}) => ({
  requestId: 'req-runtime',
  state: 'preview_ready',
  canonicalUsername: 'runtime_tester',
  accessReady: false,
  provisionalAccessReady: true,
  preview: preview(),
  ...overrides,
});

function startAndSuccess(state, source, status = readyStatus()) {
  const started = runtime.beginPreviewStatusRequest(state, source);
  assert.equal(started.accepted, true, `${source} request should start`);
  const settled = runtime.applyPreviewStatusSuccess(started.state, started.sequence, status);
  return { started, settled };
}

test('1 baseline exact', () => {
  assert.equal(BASELINE, 'bbe315dfce65a668985a2ca24f9522670ebeef07');
});

test('2-4 real INITIAL -> STATUS_SUCCESS_WITH_PREVIEW establishes irreversible continuity', () => {
  let state = runtime.createPreviewRuntimeState();
  assert.equal(runtime.previewVisualState(state), 'loader', '3 initial unresolved request may load');

  const first = runtime.beginPreviewStatusRequest(state, 'initial');
  assert.equal(first.accepted, true, '2 real state transition begins');
  assert.equal(runtime.previewVisualState(first.state), 'loader');

  const duplicateInFlight = runtime.beginPreviewStatusRequest(first.state, 'initial');
  assert.equal(duplicateInFlight.accepted, false, '12 duplicate initial acquisition cannot occur while in flight');

  state = runtime.applyPreviewStatusSuccess(first.state, first.sequence, readyStatus());
  assert.equal(runtime.previewVisualState(state), 'preview');
  assert.equal(state.hasDisplayedPreview, true, '4 successful Preview establishes irreversible displayed state');

  const duplicateAfterSuccess = runtime.beginPreviewStatusRequest(state, 'initial');
  assert.equal(duplicateAfterSuccess.accepted, false, '12 initial acquisition cannot restart after success');
});

test('5 background poll keeps Preview visible before and after success', () => {
  let state = startAndSuccess(runtime.createPreviewRuntimeState(), 'initial').settled;
  const poll = runtime.beginPreviewStatusRequest(state, 'background');
  assert.equal(runtime.previewVisualState(poll.state), 'preview');
  state = runtime.applyPreviewStatusSuccess(poll.state, poll.sequence, readyStatus({ preview: preview('Poll update') }));
  assert.equal(runtime.previewVisualState(state), 'preview');
  assert.equal(state.preview.safeHeadline, 'Poll update');
});

test('6-8 focus, visibility and reconnect transitions never surrender Preview', () => {
  let state = startAndSuccess(runtime.createPreviewRuntimeState(), 'initial').settled;
  for (const source of ['background', 'background', 'background']) {
    const started = runtime.beginPreviewStatusRequest(state, source);
    assert.equal(started.accepted, true);
    assert.equal(runtime.previewVisualState(started.state), 'preview');
    state = runtime.applyPreviewStatusSuccess(started.state, started.sequence, readyStatus());
    assert.equal(runtime.previewVisualState(state), 'preview');
  }
});

test('9 temporary background failure retains last-good Preview and later recovery is normal', () => {
  let state = startAndSuccess(runtime.createPreviewRuntimeState(), 'initial').settled;
  const refresh = runtime.beginPreviewStatusRequest(state, 'background');
  state = runtime.applyPreviewStatusFailure(refresh.state, refresh.sequence, 'temporary failure');
  assert.equal(runtime.previewVisualState(state), 'preview');
  assert.equal(state.preview.safeHeadline, 'A steady week');
  assert.match(state.refreshNotice, /saved Preview/);

  const recovery = runtime.beginPreviewStatusRequest(state, 'background');
  state = runtime.applyPreviewStatusSuccess(recovery.state, recovery.sequence, readyStatus({ preview: preview('Recovered') }));
  assert.equal(runtime.previewVisualState(state), 'preview');
  assert.equal(state.preview.safeHeadline, 'Recovered');
  assert.equal(state.refreshNotice, '');
});

test('10 approval transition retains Preview and access becomes ready', () => {
  let state = startAndSuccess(runtime.createPreviewRuntimeState(), 'initial').settled;
  const refresh = runtime.beginPreviewStatusRequest(state, 'background');
  const approved = readyStatus({ state: 'approved', accessReady: true, provisionalAccessReady: false, preview: undefined });
  state = runtime.applyPreviewStatusSuccess(refresh.state, refresh.sequence, approved);
  assert.equal(runtime.previewVisualState(state), 'preview');
  assert.equal(state.preview.safeHeadline, 'A steady week');
  assert.equal(runtime.previewCanContinue(state.status), true);
});

test('11 stale status response cannot regress a newer Preview', () => {
  let state = startAndSuccess(runtime.createPreviewRuntimeState(), 'initial').settled;
  const oldRequest = runtime.beginPreviewStatusRequest(state, 'background');
  state = runtime.cancelPreviewStatusRequest(oldRequest.state, oldRequest.sequence);

  const newerRequest = runtime.beginPreviewStatusRequest(state, 'background');
  state = runtime.applyPreviewStatusSuccess(newerRequest.state, newerRequest.sequence, readyStatus({ preview: preview('Newer status') }));
  assert.equal(state.preview.safeHeadline, 'Newer status');

  const afterStale = runtime.applyPreviewStatusSuccess(state, oldRequest.sequence, readyStatus({ preview: preview('STALE') }));
  assert.equal(afterStale, state, 'stale response is ignored, not merely overwritten later');
  assert.equal(afterStale.preview.safeHeadline, 'Newer status');
});

test('13 polling source contains one timer slot, guard and cleanup', () => {
  assert.match(COMPONENT, /pollTimerRef\.current !== undefined/);
  assert.equal((COMPONENT.match(/window\.setInterval\(/g) || []).length, 1, 'one polling interval construction site');
  assert.match(COMPONENT, /pollTimerRef\.current === timer/);
  assert.match(COMPONENT, /window\.clearInterval\(timer\)/);
});

test('14 component continuity restore starts visually on Preview, not loader', () => {
  const restored = runtime.restorePreviewContinuity(runtime.createPreviewRuntimeState(), preview('Restored before paint'));
  assert.equal(restored.hasDisplayedPreview, true);
  assert.equal(runtime.previewVisualState(restored), 'preview');
  const refresh = runtime.beginPreviewStatusRequest(restored, 'background');
  assert.equal(runtime.previewVisualState(refresh.state), 'preview');
});

test('15 hash credential cleanup bypasses App Router instance restore and does not reset acquisition state', () => {
  assert.match(COMPONENT, /History\.prototype\.replaceState\.call\(window\.history, currentState/);
  assert.doesNotMatch(COMPONENT, /window\.history\.replaceState\(null/);
  assert.match(COMPONENT, /stripStatusFragmentWithoutRouterRestore\(\)/);
});

test('16 status credential never moves into a query string', () => {
  assert.doesNotMatch(COMPONENT, /\?status=/);
  assert.doesNotMatch(COMPONENT, /searchParams\.set\([^\n]*status/i);
});

test('17 possession validation remains hash/session/device-token based', () => {
  assert.match(COMPONENT, /fragment\.get\("status"\)/);
  assert.match(COMPONENT, /sessionStorage\.getItem\(statusStorageKey\(requestId\)\)/);
  assert.match(COMPONENT, /loadSavedBetaPreviewReturn\(\)/);
  assert.match(COMPONENT, /JSON\.stringify\(\{ action: "status", statusToken: token \}\)/);
});

test('18 provisional Continue remains executable', () => {
  assert.equal(runtime.previewCanContinue(readyStatus({ provisionalAccessReady: true })), true);
});

test('19 approved Continue remains executable', () => {
  assert.equal(runtime.previewCanContinue(readyStatus({ state: 'approved', accessReady: true, provisionalAccessReady: false })), true);
});

test('20 claim still signs into stable Firebase auth and routes to My BoardSignal', () => {
  assert.match(COMPONENT, /signInWithCustomToken\(auth, body\.customToken\)/);
  assert.match(COMPONENT, /browserLocalPersistence/);
  assert.match(COMPONENT, /router\.replace\("\/boardsignal\/player-room\?source=beta_preview&tab=desk"\)/);
});

test('21 only public-safe Preview projection is persisted for visual continuity', () => {
  assert.match(COMPONENT, /betaPreviewContainsPrivateFields\(preview\)/);
  assert.match(COMPONENT, /sessionStorage\.setItem\(previewStorageKey\(requestId\), JSON\.stringify\(preview\)\)/);
  assert.doesNotMatch(COMPONENT, /sessionStorage\.setItem\([^\n]*(signals|evidence|preferredContactValue|privateReview)/i);
});

test('22 status polling cannot regenerate Preview or invoke retryPreview', () => {
  const coordinatorStart = COMPONENT.indexOf('const requestStatus = useCallback');
  const coordinatorEnd = COMPONENT.indexOf('const cancelActiveStatusRequest', coordinatorStart);
  const coordinator = COMPONENT.slice(coordinatorStart, coordinatorEnd);
  assert.match(coordinator, /action: "status"/);
  assert.doesNotMatch(coordinator, /retryPreview/);
  assert.doesNotMatch(coordinator, /Chess\.com|Stockfish|action: "retryPreview"/);
});

test('23-24 package and Firestore rule files are outside F.1.1 source scope', () => {
  if (!fs.existsSync(MANIFEST_PATH)) return;
  const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  assert.match(manifest, /PACKAGE STATUS[\s\S]*unchanged/i);
  assert.match(manifest, /FIRESTORE RULES STATUS[\s\S]*unchanged/i);
});

test('single-flight coordinator and stable startup are wired into the component', () => {
  assert.match(COMPONENT, /if \(!token \|\| activeRequestRef\.current\) return false/);
  assert.match(COMPONENT, /startupRequestIssuedRef\.current/);
  assert.doesNotMatch(COMPONENT, /useEffect\(\(\) => \{ if \(statusToken\)/);
  assert.match(COMPONENT, /signal: controller\.signal/);
});

test('visual irreversibility is part of executable state logic, not a source comment', () => {
  let state = runtime.restorePreviewContinuity(runtime.createPreviewRuntimeState(), preview());
  for (let i = 0; i < 5; i += 1) {
    const started = runtime.beginPreviewStatusRequest(state, 'background');
    assert.equal(runtime.previewVisualState(started.state), 'preview');
    state = i === 2
      ? runtime.applyPreviewStatusFailure(started.state, started.sequence, 'transient')
      : runtime.applyPreviewStatusSuccess(started.state, started.sequence, readyStatus());
    assert.equal(state.hasDisplayedPreview, true);
    assert.equal(runtime.previewVisualState(state), 'preview');
  }
});
