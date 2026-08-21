const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '2e4b6bf0e383808669a45d2a1d08efcc8d792b85';
const COMPONENT = 'src/components/FoundingBetaPlayersAdmin.tsx';
const source = fs.readFileSync(path.join(ROOT, COMPONENT), 'utf8');

const BLOBS = Object.freeze({
  'src/lib/boardsignal/server/betaRequests.ts': '6448260a8af1eaaacad9140361538ea466426aea',
  'src/app/api/auth/beta-access/magic/route.ts': 'ffb20a1cad4abda3ad9b28448c41284afe687cf5',
  'src/lib/boardsignal/playerEntryRecovery.mjs': '74ca0dc9e8b002f07792610454468be09673f959',
  'src/lib/boardsignal/founderSession.mjs': '11879a7e0d384160aac4d03a1b4a901a2729a6f0',
  'middleware.ts': '8842049b23f965cb2ee024526701eac2b4376189',
  'src/components/ServiceWorkerRegister.tsx': '5979efdb5e83eb366c559546d152b0bc48a4c882',
  'src/lib/boardsignal/firstReviewGeneration.mjs': 'd8d375e1ad421674e27d3ae40c683ae165a503c7',
  'src/app/boardsignal-f2-readability.css': '6fb006ab9342dc38b80ee115ff094f32e4fb5f2a',
  'tests/boardsignal-preview-readability-approval-alert-hotfix.test.cjs': '02177570ed50274f782c6022d1ce43e927b0dca9',
  'tests/boardsignal-first-review-onboarding-loop-hotfix.test.cjs': '9169385e6eb6768729d4fe2c6e8db61048480b50',
  'package.json': '95e6b72c781711c23b9b1a173a6c2c16bafb5882',
  'package-lock.json': '0a6af980d8c90f8a877045e323993785806756bf',
  'firestore.rules': 'a08d287ecba85bec03ca68db327fb8a92a304b2a',
});

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

function envKeyFor(file) {
  return `F31_BLOB_${file.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
}

function assertProtectedBlob(file) {
  const expected = BLOBS[file];
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) {
    assert.equal(gitBlobSha(fs.readFileSync(full)), expected, `${file} changed from immutable baseline`);
    return;
  }
  assert.equal(process.env[envKeyFor(file)], expected, `${file} must be verified from the immutable baseline when the delta workspace omits it`);
}

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing section marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing section end marker: ${endMarker}`);
  return source.slice(start, end);
}

const accessReady = section('<p className="kicker">ACCESS READY</p><div className="pending-request-grid">{accessReady.map', '<p className="kicker">CLAIMED</p>');
const claimed = section('<p className="kicker">CLAIMED</p>', '<p className="kicker">IDENTITY CONFIRMED</p>');
const identityConfirmed = section('<p className="kicker">IDENTITY CONFIRMED</p>', '<p className="kicker">APPROVED · ACCESS CHECK</p>');
const regenerateStart = source.indexOf('async function regenerate(request: RequestRow)');
const regenerateEnd = source.indexOf('async function copyPrepared', regenerateStart);
const regenerate = source.slice(regenerateStart, regenerateEnd);

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

test('1. immutable baseline exact', () => {
  const observed = gitHead() || process.env.BOARD_SIGNAL_F31_BASELINE_SHA;
  assert.equal(observed, BASELINE);
});

test('2. CLAIMED cards expose Regenerate magic link', () => {
  assert.match(claimed, /> Regenerate magic link<\/button>/);
});

test('3. CLAIMED recovery calls regenerate(request)', () => {
  assert.match(claimed, /onClick=\{\(\) => regenerate\(request\)\}/);
});

test('4. CLAIMED recovery is disabled while another Founder mutation is busy', () => {
  assert.match(claimed, /disabled=\{busyPlayer !== null\}/);
});

test('5. existing Open public player action remains on CLAIMED cards', () => {
  assert.match(claimed, /Open public player/);
  assert.match(claimed, /href=\{`\/player\/\$\{encodeURIComponent\(request\.canonicalUsername\)\}`\}/);
});

test('6. ACCESS READY recovery button remains unchanged', () => {
  assert.match(accessReady, /disabled=\{busyPlayer !== null\} onClick=\{\(\) => regenerate\(request\)\}><RefreshCcw size=\{14\}\/?> Regenerate magic link/);
});

test('7. IDENTITY CONFIRMED recovery action remains unchanged', () => {
  assert.match(identityConfirmed, /disabled=\{busyPlayer !== null\} onClick=\{\(\) => regenerate\(request\)\}><RefreshCcw size=\{14\}\/?> Recovery options/);
});

test('8. regenerate(request) still posts regenerateMagic for the same request id', () => {
  assert.match(regenerate, /JSON\.stringify\(\{ action: "regenerateMagic", requestId: request\.id \}\)/);
});

test('9. successful regeneration stores link, message and expiry in preparedAccess', () => {
  assert.match(regenerate, /setPreparedAccess\(\{[^}]*requestId: request\.id,[^}]*magicLink: body\.magicLink,[^}]*approvalMessage: body\.approvalMessage,[^}]*expiresAt: body\.magicAccessExpiresAt/s);
});

test('10. Copy magic link remains available in ACCESS READY result panel', () => {
  assert.match(source, /copyPrepared\("link"\)[\s\S]*Copy magic link/);
});

test('11. Copy access message remains available', () => {
  assert.match(source, /copyPrepared\("message"\)[\s\S]*Copy access message/);
});

test('12. CLAIMED recovery does not invoke Reset fallback access', () => {
  assert.doesNotMatch(claimed, /mutate\("reset"/);
  assert.doesNotMatch(claimed, /Reset fallback/);
});

test('13. server magic-regeneration implementation is unchanged', () => assertProtectedBlob('src/lib/boardsignal/server/betaRequests.ts'));
test('14. F.3 player-entry helper is unchanged', () => assertProtectedBlob('src/lib/boardsignal/playerEntryRecovery.mjs'));
test('15. F.1.2 firstReviewGeneration helper is unchanged', () => assertProtectedBlob('src/lib/boardsignal/firstReviewGeneration.mjs'));
test('16. package.json is unchanged', () => assertProtectedBlob('package.json'));
test('17. package-lock.json is unchanged', () => assertProtectedBlob('package-lock.json'));
test('18. firestore.rules is unchanged', () => assertProtectedBlob('firestore.rules'));

test('19. changed TSX has zero parse diagnostics', () => {
  const parsed = ts.createSourceFile(COMPONENT, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.deepEqual(parsed.parseDiagnostics, []);
});

test('20. changed TSX has zero isolated-transpile errors', () => {
  const result = ts.transpileModule(source, {
    fileName: COMPONENT,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      isolatedModules: true,
    },
  });
  const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
});

test('21. F.3 Founder-session and magic-consume boundaries remain unchanged', () => {
  assertProtectedBlob('src/lib/boardsignal/founderSession.mjs');
  assertProtectedBlob('middleware.ts');
  assertProtectedBlob('src/app/api/auth/beta-access/magic/route.ts');
});

test('22. F.2 and F.1.2 shipped guards remain present', () => {
  assertProtectedBlob('src/app/boardsignal-f2-readability.css');
  assertProtectedBlob('tests/boardsignal-preview-readability-approval-alert-hotfix.test.cjs');
  assertProtectedBlob('tests/boardsignal-first-review-onboarding-loop-hotfix.test.cjs');
});

test('23. service-worker update implementation is untouched', () => assertProtectedBlob('src/components/ServiceWorkerRegister.tsx'));

test('24. whitespace/source validation passes', () => {
  assert.equal(source.endsWith('\n'), true, 'source must end with a newline');
  const trailing = source.split('\n').flatMap((line, index) => /[ \t]+$/.test(line) ? [index + 1] : []);
  assert.deepEqual(trailing, []);
  if (gitHead()) {
    const check = spawnSync('git', ['diff', '--check', '--', COMPONENT], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  }
});
