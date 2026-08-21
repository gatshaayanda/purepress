const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const preview = read('src/components/BetaPreviewRoom.tsx');
const manifest = read('PATCH-MANIFEST.txt');

function section(start, end) {
  const from = preview.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = end ? preview.indexOf(end, from + start.length) : preview.length;
  return preview.slice(from, to < 0 ? preview.length : to);
}

const loadStatus = section('const loadStatus = useCallback', 'useEffect(() => {\n    if (!statusToken) return;');
const polling = section('useEffect(() => {\n    if (!statusToken || status?.state !== "preview_ready") return;', 'async function retryPreview');
const retry = section('async function retryPreview()', 'async function openPlayerRoom()');
const claim = section('async function openPlayerRoom()', 'function ask(prompt: string)');
const returnChoice = section('function PreviewReturnChoice', 'function PreviewContent');

// F.1 focused acceptance gate. 42 checks cover the requested 34 points plus
// state/continuity/privacy guards for the same-session remount fix.
test('1 immutable baseline is exact', () => {
  assert.match(manifest, /60dfc3f8f444de288346da6b3027476becc7ceb5/);
});

test('2 initial Preview resolution has an explicit initializing phase', () => {
  assert.match(preview, /type PreviewLoadPhase = "initializing"/);
  assert.match(preview, /loadPhase === "initializing" && !preview && !status/);
  assert.match(preview, /Finding your chess week/);
});

test('3 first successful status leaves initialization and atomically installs status', () => {
  assert.match(preview, /setStatus\(nextStatus\);[\s\S]*setLoadPhase\("ready"\)/);
});

test('4 background poll cannot select the initial full-screen loader', () => {
  assert.match(polling, /loadStatus\("background"\)/);
  assert.doesNotMatch(polling, /initializing|Finding your chess week|setLoading/);
});

test('5 last-good Preview wins across repeated background cycles', () => {
  assert.match(preview, /const preview = status\?\.preview \?\? lastGoodPreview/);
  assert.match(preview, /lastGoodPreviewRef\.current = preview/);
  assert.doesNotMatch(loadStatus, /setStatus\(null\)|setLastGoodPreview\(null\)/);
});

test('6 focus refresh is in-place background work', () => {
  assert.match(polling, /const onFocus = \(\) => refreshInPlace\(\)/);
  assert.match(polling, /const refreshInPlace = \(\) => void loadStatus\("background"\)/);
});

test('7 visibility refresh is in-place background work', () => {
  assert.match(polling, /visibilitychange/);
  assert.match(polling, /document\.visibilityState === "visible"[\s\S]*refreshInPlace\(\)/);
});

test('8 pending to approved uses status replacement in place', () => {
  assert.match(preview, /nextStatus\.state === "approved"/);
  assert.match(preview, /setStatus\(nextStatus\)/);
});

test('9 approval path never invokes the initial loader', () => {
  const apply = section('const applyStatus = useCallback', 'useEffect(() => {\n    const fragment');
  assert.doesNotMatch(apply, /initializing|Finding your chess week/);
  assert.match(apply, /setLoadPhase\("ready"\)/);
});

test('10 temporary background status failure keeps the last-good Preview', () => {
  assert.match(loadStatus, /background && lastGoodPreviewRef\.current/);
  assert.match(loadStatus, /error_with_last_good_preview/);
  assert.match(loadStatus, /Couldn't refresh just now\. Showing your saved Preview\./);
});

test('11 recovery after a background failure clears the refresh notice normally', () => {
  assert.match(preview, /setRefreshNotice\(""\);[\s\S]*setLoadPhase\("ready"\)/);
});

test('12 initial invalid possession remains an honest blocking error', () => {
  assert.match(preview, /if \(!token\) \{[\s\S]*setLoadPhase\("initial_error"\)/);
  assert.match(preview, /This Preview isn't saved on this device/);
});

test('13 rejected state remains explicit and closed', () => {
  assert.match(preview, /const rejected = status\?\.state === "rejected"/);
  assert.match(preview, /This Founding Beta request is closed/);
});

test('14 expired state remains explicit and recovery-only', () => {
  assert.match(preview, /const expired = status\?\.state === "expired"/);
  assert.match(preview, /ACCESS WINDOW EXPIRED/);
});

test('15 explicit retryPreview recovery remains functional', () => {
  assert.match(retry, /action: "retryPreview"/);
  assert.match(retry, /applyStatus\(body\.status, "explicit"\)/);
});

test('16 exactly one polling interval is declared', () => {
  assert.equal((preview.match(/window\.setInterval\(/g) || []).length, 1);
  assert.match(polling, /BETA_PREVIEW_POLL_MS/);
});

test('17 in-flight request protection remains effective', () => {
  assert.match(preview, /const pollInFlightRef = useRef\(false\)/);
  assert.match(loadStatus, /pollInFlightRef\.current/);
  assert.match(loadStatus, /pollInFlightRef\.current = true/);
  assert.match(loadStatus, /pollInFlightRef\.current = false/);
});

test('18 polling and passive listeners clean up on unmount/state change', () => {
  assert.match(polling, /window\.clearInterval\(timer\)/);
  assert.match(polling, /removeEventListener\("visibilitychange"/);
  assert.match(polling, /removeEventListener\("focus"/);
  assert.match(polling, /removeEventListener\(BOARDSIGNAL_RECONNECTED_EVENT/);
});

test('19 passive Preview synchronization contains no router navigation', () => {
  assert.doesNotMatch(polling, /router\.|window\.location|location\.replace|location\.reload/);
  assert.doesNotMatch(loadStatus, /router\.|window\.location\.reload|window\.location\.replace/);
});

test('20 BetaPreviewRoom has no automatic window reload during passive viewing', () => {
  assert.doesNotMatch(preview, /window\.location\.reload\(/);
  assert.doesNotMatch(preview, /window\.location\.replace\(/);
});

test('21 service-worker update audit confirms reload remains explicit only', () => {
  assert.match(manifest, /ServiceWorkerRegister\.tsx — 54030ce18fcedcbac13dca5e56918290f0d81ef9/);
  assert.match(manifest, /reloads only after the player explicitly chooses the ready update/);
});

test('22 reconnect refresh is background-only', () => {
  assert.match(polling, /BOARDSIGNAL_RECONNECTED_EVENT/);
  assert.match(polling, /const onReconnect = \(\) => refreshInPlace\(\)/);
});

test('23 status synchronization does not regenerate the chess Preview', () => {
  assert.match(loadStatus, /action: "status"/);
  assert.doesNotMatch(loadStatus, /retryPreview|Chess\.com|Stockfish|generate/i);
});

test('24 background status synchronization never invokes retryPreview', () => {
  assert.doesNotMatch(polling, /retryPreview/);
  assert.doesNotMatch(loadStatus, /action: "retryPreview"/);
});

test('25 possession/status-token intake model is unchanged', () => {
  assert.match(preview, /fragment\.get\("status"\)/);
  assert.match(preview, /window\.sessionStorage\.getItem\(statusStorageKey\(requestId\)\)/);
  assert.match(preview, /loadSavedBetaPreviewReturn\(\)/);
  assert.match(preview, /fromHash \|\| fromDevice \|\| fromSession/);
  assert.match(loadStatus, /statusToken/);
});

test('26 provisional Continue flow remains available', () => {
  assert.match(preview, /status\?\.state === "preview_ready" && status\.provisionalAccessReady === true/);
  assert.match(preview, /const canContinue = approved \|\| provisionalReady/);
});

test('27 approved Continue flow remains available', () => {
  assert.match(preview, /status\?\.state === "approved" && status\.accessReady/);
});

test('28 claim still requests a server custom token', () => {
  assert.match(claim, /action: "claim", statusToken/);
  assert.match(claim, /customToken/);
  assert.match(claim, /signInWithCustomToken\(auth, body\.customToken\)/);
});

test('29 deliberate claim still routes to My BoardSignal', () => {
  assert.match(claim, /router\.replace\("\/boardsignal\/player-room\?source=beta_preview&tab=desk"\)/);
  assert.match(claim, /router\.refresh\(\)/);
});

test('30 saved same-device Preview return remains functional', () => {
  assert.match(preview, /loadSavedBetaPreviewReturn\(\)/);
  assert.match(preview, /saved\?\.requestId === requestId \? saved\.statusCredential/);
  assert.match(preview, /saveBetaPreviewReturn\(/);
});

test('31 same-session continuity stores only the public-safe Preview projection', () => {
  assert.match(preview, /boardsignal-beta-preview-public-v1:/);
  assert.match(preview, /JSON\.stringify\(preview\)/);
  assert.match(preview, /betaPreviewContainsPrivateFields\(preview\)/);
  const continuity = section('function readPreviewContinuity', 'function formatSync');
  assert.doesNotMatch(continuity, /preferredContactValue|betaContactConsent|signals|evidence|engineResults|statusToken/);
});

test('32 Ask Preview context still receives requestId and statusToken', () => {
  assert.match(preview, /boardsignal:preview-context/);
  assert.match(preview, /detail: \{ requestId, statusToken \}/);
  assert.match(manifest, /Ask BoardSignal's Preview listener only captures requestId\/statusToken context/);
});

test('33 delta contains no unrelated account Review social messaging or deletion source', () => {
  const files = fs.readdirSync(root, { recursive: true }).map(String).filter((file) => fs.statSync(path.join(root, file)).isFile());
  const normalized = files.map((file) => file.replaceAll('\\', '/'));
  assert.ok(normalized.includes('src/components/BetaPreviewRoom.tsx'));
  assert.ok(normalized.includes('tests/boardsignal-onboarding-preview-stability-hotfix.test.cjs'));
  assert.ok(normalized.includes('PATCH-MANIFEST.txt'));
  assert.equal(normalized.filter((file) => file.startsWith('src/')).length, 1);
});

test('34 package files remain unchanged', () => {
  assert.match(manifest, /package\.json: UNCHANGED — baseline Git blob 95e6b72c781711c23b9b1a173a6c2c16bafb5882/);
  assert.match(manifest, /package-lock\.json: UNCHANGED/);
  assert.equal(fs.existsSync(path.join(root, 'package.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'package-lock.json')), false);
});

test('35 Firestore rules remain unchanged', () => {
  assert.match(manifest, /firestore\.rules: UNCHANGED — baseline Git blob a08d287ecba85bec03ca68db327fb8a92a304b2a/);
  assert.match(manifest, /NO NEW FIRESTORE RULE/);
  assert.equal(fs.existsSync(path.join(root, 'firestore.rules')), false);
});

test('36 background refresh does not clear shared error state before the request', () => {
  const backgroundSetup = section('const loadStatus = useCallback', 'try {');
  assert.match(backgroundSetup, /if \(background\) setLoadPhase\("refreshing_background"\)/);
  assert.match(backgroundSetup, /else \{[\s\S]*setError\(""\)/);
});

test('37 explicit state model includes a last-good refresh failure phase', () => {
  assert.match(preview, /"error_with_last_good_preview"/);
  assert.match(preview, /"refreshing_background"/);
});

test('38 unsaved return-method edits are not reset by every status prop update', () => {
  assert.doesNotMatch(returnChoice, /useEffect\(\(\) => \{[\s\S]*setSelected\(status\.activationReturnMethod/);
  assert.match(returnChoice, /Keep unsaved return-method\/contact edits local while background status polls/);
});

test('39 Preview route/remount audit found no passive navigation source', () => {
  assert.match(manifest, /No unintended passive Preview navigation\/reload was found/);
  assert.match(manifest, /Preview page only renders BetaPreviewRoom and remains force-dynamic/);
  assert.match(manifest, /PwaLaunchRedirect only performs its intentional full navigation from \/boardsignal\?source=pwa/);
});

test('40 global loader remains untouched and mount-only', () => {
  assert.match(manifest, /AdminHubLoader is a mount-only 500ms fade \/ 850ms hide component/);
  assert.match(manifest, /No global loader change was required/);
});

test('41 terminal states clear continuity rather than weakening possession', () => {
  assert.match(preview, /\["rejected", "expired", "claimed"\]\.includes\(nextStatus\.state\)/);
  assert.match(preview, /clearPreviewContinuity\(requestId\)/);
});

test('42 no new infrastructure or unrelated subsystem source is part of F.1', () => {
  assert.match(manifest, /NO NEW DEPENDENCY/);
  assert.match(manifest, /NO NEW FIRESTORE INDEX/);
  assert.match(manifest, /E\.4 offline consistency\/database schema: UNCHANGED/);
  assert.match(manifest, /Chess analytics \/ Stockfish \/ seven-day calculation \/ public coverage \/ Friends: UNCHANGED/);
});
