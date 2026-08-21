const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const betaAccess = read('src/lib/boardsignal/server/betaAccess.ts');
const betaRequests = read('src/lib/boardsignal/server/betaRequests.ts');
const adminRoute = read('src/app/api/admin/boardsignal/beta-access/route.ts');
const founderUi = read('src/components/FoundingBetaPlayersAdmin.tsx');
const pkg = JSON.parse(read('package.json'));
const firestore = read('firestore.rules');

function functionSlice(source, name, nextName) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} missing`);
  const end = nextName ? source.indexOf(`export async function ${nextName}`, start + 1) : source.length;
  return source.slice(start, end === -1 ? source.length : end);
}

const loadExisting = functionSlice(betaAccess, 'loadExistingFoundingBetaAccess', 'resetFoundingBetaAccess');
const resetAccess = functionSlice(betaAccess, 'resetFoundingBetaAccess', 'revokeFoundingBetaAccess');
const approval = functionSlice(betaRequests, 'approveFoundingBetaRequest', 'confirmFoundingBetaIdentity');
const regenerate = functionSlice(betaRequests, 'regenerateFoundingBetaMagicAccess', 'rejectFoundingBetaRequest');

test('1 legacy approval reuses existing Beta Access instead of resetting it', () => {
  assert.match(approval, /BETA_ACCESS_EXISTS/);
  assert.match(approval, /loadExistingFoundingBetaAccess\(request\.chessPlayerId\)/);
  assert.doesNotMatch(approval, /resetFoundingBetaAccess/);
});

test('2 read-only legacy loader never rotates the stored Beta Access hash or salt', () => {
  assert.match(loadExisting, /collection\("betaAccess"\).*\.doc\(String\(playerId\)\)/s);
  assert.doesNotMatch(loadExisting, /\.set\(|\.create\(|\.update\(/);
  assert.doesNotMatch(loadExisting, /createBetaAccessCredential|passHash\s*:|passSalt\s*:/);
});

test('3 legacy loader returns no raw fallback access code', () => {
  assert.match(loadExisting, /return \{ account, record \}/);
  assert.doesNotMatch(loadExisting, /accessCode/);
});

test('4 compound approval cannot revoke an existing Firebase refresh session', () => {
  assert.doesNotMatch(approval, /revokeRefreshTokens|revokeExistingFirebaseSession/);
  assert.doesNotMatch(loadExisting, /revokeRefreshTokens|revokeExistingFirebaseSession/);
});

test('5 explicit Reset Access still rotates the fallback credential and revokes sessions', () => {
  assert.match(resetAccess, /createBetaAccessCredential\(identity, new Date\(\), previous\)/);
  assert.match(resetAccess, /revokeExistingFirebaseSession\(account\.uid\)/);
  assert.match(adminRoute, /body\.action === "reset"/);
  assert.match(adminRoute, /resetFoundingBetaAccess\(body\.playerId\)/);
});

test('6 optional magic-link creation does not touch fallback Beta Access', () => {
  assert.match(regenerate, /betaMagicAccessCredential/);
  assert.doesNotMatch(regenerate, /resetFoundingBetaAccess|createFoundingBetaAccess|createBetaAccessCredential|revokeRefreshTokens/);
  assert.match(regenerate, /magicAccess: magic\.record/);
});

test('7 historical active testers are classified as LEGACY / EXISTING ACTIVE', () => {
  assert.match(founderUi, /LEGACY \/ EXISTING ACTIVE/);
  assert.match(founderUi, /!item\.magicAccess/);
  assert.match(founderUi, /betaAccessStatus === "active"/);
});

test('8 ACCESS READY requires an actual Activation Bridge magic-access record', () => {
  assert.match(founderUi, /const accessReady = useMemo\(\(\) => approved\.filter\([\s\S]*Boolean\(item\.magicAccess\)/);
  assert.match(founderUi, />ACCESS READY</);
});

test('9 claimed magic access is rendered separately as CLAIMED', () => {
  assert.match(founderUi, /const claimed = useMemo/);
  assert.match(founderUi, />CLAIMED</);
});

test('10 legacy player gets explicit Create magic access link without resetting fallback access', () => {
  assert.match(founderUi, /Create magic access link/);
  assert.match(founderUi, /does not reset fallback Beta Access or end the current Firebase session/);
  assert.match(founderUi, /action: "regenerateMagic"/);
});

test('11 Founder page loading is read-only for legacy request classification', () => {
  const loadStart = founderUi.indexOf('const loadPlayers = useCallback');
  const loadEnd = founderUi.indexOf('useEffect(() => { void loadPlayers();', loadStart);
  const loadBlock = founderUi.slice(loadStart, loadEnd);
  assert.match(loadBlock, /fetch\("\/api\/admin\/boardsignal\/beta-access", \{ cache: "no-store" \}\)/);
  assert.doesNotMatch(loadBlock, /method:\s*"POST"|reset|regenerateMagic/);
});

test('12 current production prebuild stays unchanged', () => {
  assert.equal(pkg.scripts.prebuild, 'npm run prepare:stockfish && npm run test:contrast');
  assert.equal(pkg.scripts['test:legacy-beta-access'], 'node --test tests/boardsignal-legacy-beta-access-compat.test.cjs');
});

test('13 Founding Beta Firestore collections remain server-only', () => {
  const betaRequestsRule = firestore.slice(firestore.indexOf('match /betaRequests/{requestId}'), firestore.indexOf('match /betaRequestRateLimits/{limitId}'));
  const betaAccessRule = firestore.slice(firestore.indexOf('match /betaAccess/{playerId}'), firestore.indexOf('/* ========================================================\n       DENY EVERYTHING ELSE'));
  assert.match(betaRequestsRule, /allow read, write: if false/);
  assert.match(betaAccessRule, /allow read, write: if false/);
});
