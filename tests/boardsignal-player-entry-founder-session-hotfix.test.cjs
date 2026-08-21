const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = 'b4a05a3065ed165991be7ee933f6944f59163ab5';
const F12_HELPER_BLOB = 'd8d375e1ad421674e27d3ae40c683ae165a503c7';
const PACKAGE_BLOB = '95e6b72c781711c23b9b1a173a6c2c16bafb5882';
const PACKAGE_LOCK_BLOB = '0a6af980d8c90f8a877045e323993785806756bf';
const FIRESTORE_RULES_BLOB = 'a08d287ecba85bec03ca68db327fb8a92a304b2a';
const SW_BLOB = '31b16413f3b0bd0d131e12bdc84e618029ebc1e7';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const preview = read('src/components/BetaPreviewRoom.tsx');
const magic = read('src/components/MagicBetaAccess.tsx');
const previewRoute = read('src/app/api/boardsignal/beta-preview/[requestId]/route.ts');
const magicRoute = read('src/app/api/auth/beta-access/magic/route.ts');
const middleware = read('middleware.ts');
const login = read('src/app/api/login/route.ts');
const logout = read('src/app/api/logout/route.ts');
const swRegister = read('src/components/ServiceWorkerRegister.tsx');
const betaRequests = read('src/lib/boardsignal/server/betaRequests.ts');
const founderAuth = read('src/lib/boardsignal/server/founderAuth.ts');

let entry;
let founder;
let sw;
let f12;
test.before(async () => {
  entry = await import(pathToFileURL(path.join(ROOT, 'src/lib/boardsignal/playerEntryRecovery.mjs')).href + `?${Date.now()}`);
  founder = await import(pathToFileURL(path.join(ROOT, 'src/lib/boardsignal/founderSession.mjs')).href + `?${Date.now()}`);
  sw = await import(pathToFileURL(path.join(ROOT, 'src/lib/boardsignal/serviceWorkerUpdate.mjs')).href + `?${Date.now()}`);
  f12 = await import(pathToFileURL(path.join(ROOT, 'src/lib/boardsignal/firstReviewGeneration.mjs')).href + `?${Date.now()}`);
});

function gitBlobSha(text) {
  return crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
}

function tamperPayload(session, mutate) {
  const [v, payload, sig] = session.split('.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  mutate(parsed);
  return `${v}.${Buffer.from(JSON.stringify(parsed)).toString('base64url')}.${sig}`;
}

// 1
test('baseline is the immutable F.3 baseline', () => assert.equal(BASELINE, 'b4a05a3065ed165991be7ee933f6944f59163ab5'));
// 2
test('same stable Firebase UID resumes without a second claim', () => {
  const expectedUid = entry.stableFirebaseUidForPlayerId(568816694);
  assert.deepEqual(entry.decidePreviewEntry({ expectedUid, currentUid: expectedUid }), { action: 'resume', sameUidResume: true });
});
// 3
test('different Firebase UID cannot resume', () => {
  assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_568816694', currentUid: 'chesscom_123' }).action, 'cross_account');
});
// 4
test('no authenticated user performs normal claim', () => {
  assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_568816694', currentUid: null }).action, 'claim');
});
// 5
test('claim success verifies expected UID', () => {
  assert.equal(entry.credentialMatchesExpectedUid('chesscom_568816694', 'chesscom_568816694'), true);
  assert.equal(entry.credentialMatchesExpectedUid('chesscom_568816694', 'chesscom_2'), false);
  assert.match(preview, /credentialMatchesExpectedUid\(expectedUid, credential\.user\.uid\)/);
});
// 6
test('ACCESS_ALREADY_CLAIMED plus same local UID resumes', () => {
  assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_5', currentUid: 'chesscom_5', claimCode: 'ACCESS_ALREADY_CLAIMED' }).action, 'resume');
});
// 7
test('ACCESS_ALREADY_CLAIMED plus no local UID shows recovery', () => {
  assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_5', claimCode: 'ACCESS_ALREADY_CLAIMED' }).action, 'recovery');
});
// 8
test('ESTABLISHED_ACCOUNT_EXISTS plus same local UID resumes', () => {
  assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_5', currentUid: 'chesscom_5', claimCode: 'ESTABLISHED_ACCOUNT_EXISTS' }).action, 'resume');
});
// 9
test('ESTABLISHED_ACCOUNT_EXISTS wrong/no UID does not bypass security', () => {
  assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_5', currentUid: 'chesscom_9', claimCode: 'ESTABLISHED_ACCOUNT_EXISTS' }).action, 'cross_account');
  assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_5', claimCode: 'ESTABLISHED_ACCOUNT_EXISTS' }).action, 'recovery');
});
// 10
test('Preview status token does not become unlimited reusable sign-in', () => {
  assert.match(previewRoute, /verified\.request\.claimedAt \|\| verified\.request\.provisionalClaimedAt/);
  assert.match(previewRoute, /code: "ACCESS_ALREADY_CLAIMED"/);
});
// 11
test('magic recovery keeps exact stable UID', () => {
  assert.match(betaRequests, /const uid = request\.firebaseUid \?\? `chesscom_\$\{request\.chessPlayerId\}`/);
  assert.match(betaRequests, /betaMagicAccessCredential\(request\.id, request\.chessPlayerId, uid\)/);
  assert.match(magicRoute, /uid: result\.uid, playerId: result\.playerId/);
  assert.match(magic, /credentialMatchesExpectedUid\(body\.uid, credential\.user\.uid\)/);
});
// 12
test('magic ticket remains delegated to existing single-use server consume path', () => {
  assert.equal((magicRoute.match(/consumeBetaMagicTicket\(/g) || []).length, 1);
  assert.doesNotMatch(magicRoute, /regenerateFoundingBetaMagicAccess|betaMagicAccessCredential/);
});
// 13
test('MagicBetaAccess has no router.refresh after replace', () => {
  assert.match(magic, /router\.replace\("\/boardsignal\/player-room\?source=beta_magic&tab=desk"\)/);
  assert.doesNotMatch(magic, /router\.refresh\(/);
});
// 14
test('Preview handoff still has no router.refresh', () => {
  assert.match(preview, /router\.replace\("\/boardsignal\/player-room\?source=beta_preview&tab=desk"\)/);
  assert.match(preview, /beta_preview_resume/);
  assert.doesNotMatch(preview, /router\.refresh\(/);
});
// 15
test('F.1.2 cadence anchor behavior remains exact', () => {
  const source = read('src/lib/boardsignal/firstReviewGeneration.mjs');
  assert.equal(gitBlobSha(source), F12_HELPER_BLOB);
  assert.equal(f12.resolveEffectiveCadenceAnchor('live', '2026-08-03', '1999-01-01'), '2026-08-03');
  assert.equal(f12.resolveEffectiveCadenceAnchor('live', undefined, '1999-01-01'), undefined);
});
// 16
test('F.1.2 same-session publish guard remains unchanged', () => {
  assert.equal(f12.shouldMountAutomaticReviewGenerator({ generationRequired: true, latestDeskKey: 'desk-1', publishedDeskKeyThisSession: 'desk-1' }), false);
  assert.equal(f12.shouldMountAutomaticReviewGenerator({ generationRequired: true, latestDeskKey: 'desk-2', publishedDeskKeyThisSession: 'desk-1' }), true);
});
// 17
test('skara-shaped recovery does not duplicate first Review generation', () => {
  const uid = entry.stableFirebaseUidForPlayerId(568816694);
  assert.equal(uid, 'chesscom_568816694');
  assert.equal(entry.decidePreviewEntry({ expectedUid: uid, currentUid: uid }).action, 'resume');
  assert.equal(f12.shouldMountAutomaticReviewGenerator({ generationRequired: true, latestDeskKey: 'first-review', publishedDeskKeyThisSession: 'first-review' }), false);
});

// 18
test('correct password produces a signed Founder session', async () => {
  const session = await founder.createFounderSession('correct horse battery staple', { nowMs: 1_800_000_000_000, nonce: 'fixed-nonce-123456' });
  assert.match(session.value, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(session.payload.role, 'founder');
});
// 19
test('valid Founder cookie verifies', async () => {
  const now = 1_800_000_000_000;
  const session = await founder.createFounderSession('secret', { nowMs: now, nonce: 'valid-nonce-12345' });
  assert.equal(await founder.verifyFounderSession(session.value, 'secret', { nowMs: now + 1000 }), true);
});
// 20
test('forged Founder cookie fails', async () => {
  const now = 1_800_000_000_000;
  const session = await founder.createFounderSession('secret', { nowMs: now, nonce: 'forge-nonce-12345' });
  const forged = session.value.slice(0, -1) + (session.value.endsWith('A') ? 'B' : 'A');
  assert.equal(await founder.verifyFounderSession(forged, 'secret', { nowMs: now }), false);
});
// 21
test('modified expiry and expired Founder cookies fail', async () => {
  const now = 1_800_000_000_000;
  const session = await founder.createFounderSession('secret', { nowMs: now, nonce: 'expiry-nonce-1234' });
  const modified = tamperPayload(session.value, (p) => { p.exp += 3600; });
  assert.equal(await founder.verifyFounderSession(modified, 'secret', { nowMs: now }), false);
  const old = await founder.createFounderSession('secret', { nowMs: now - 9 * 60 * 60 * 1000, nonce: 'old-nonce-1234567' });
  assert.equal(await founder.verifyFounderSession(old.value, 'secret', { nowMs: now }), false);
});
// 22
test('missing signature and wrong ADMIN_PASSWORD are rejected', async () => {
  const now = 1_800_000_000_000;
  const session = await founder.createFounderSession('secret', { nowMs: now, nonce: 'wrong-nonce-12345' });
  assert.equal(await founder.verifyFounderSession(session.value.split('.').slice(0,2).join('.'), 'secret', { nowMs: now }), false);
  assert.equal(await founder.verifyFounderSession(session.value, 'wrong', { nowMs: now }), false);
});
// 23
test('middleware accepts valid signed Founder session policy', async () => {
  const now = 1_800_000_000_000;
  const session = await founder.createFounderSession('secret', { nowMs: now, nonce: 'mid-nonce-1234567' });
  const result = await founder.verifyFounderAuthorization({ sessionValue: session.value, adminPassword: 'secret', nowMs: now });
  assert.deepEqual(result, { authorized: true, method: 'session' });
  assert.match(middleware, /verifyFounderAuthorization/);
});
// 24
test('middleware accepts legacy Basic fallback', async () => {
  const basic = `Basic ${Buffer.from('founder:secret').toString('base64')}`;
  const result = await founder.verifyFounderAuthorization({ authorization: basic, adminPassword: 'secret' });
  assert.deepEqual(result, { authorized: true, method: 'basic' });
});
// 25
test('middleware rejects unauthenticated Admin and protected Admin API', async () => {
  assert.equal((await founder.verifyFounderAuthorization({ adminPassword: 'secret' })).authorized, false);
  assert.match(middleware, /\/api\/admin\/boardsignal\//);
  assert.match(middleware, /status: 401/);
  assert.match(middleware, /login-secret-login-for-admins97F4B2NXQ/);
});
// 26
test('logout clears signed session and legacy cookie', () => {
  assert.match(logout, /FOUNDER_SESSION_COOKIE/);
  assert.match(logout, /admin_token/);
  assert.match(logout, /maxAge: 0/);
});
// 27
test('admin_token alone no longer grants authorization', async () => {
  const result = await founder.verifyFounderAuthorization({ sessionValue: 'random-admin-token', adminPassword: 'secret' });
  assert.equal(result.authorized, false);
  assert.doesNotMatch(middleware, /admin_token/);
});
// 28
test('session cookie is HttpOnly', () => assert.match(login, /httpOnly: true/));
// 29
test('production session cookie is Secure', () => assert.match(login, /secure: process\.env\.NODE_ENV === "production"/));
// 30
test('SameSite lax, Path root and bounded eight-hour session are present', () => {
  assert.match(login, /sameSite: "lax"/);
  assert.match(login, /path: "\/"/);
  assert.equal(founder.FOUNDER_SESSION_MAX_AGE_SECONDS, 8 * 60 * 60);
});
// 31
test('raw password is absent from session value', async () => {
  const password = 'super-private-password-value';
  const session = await founder.createFounderSession(password, { nonce: 'raw-nonce-1234567' });
  assert.equal(session.value.includes(password), false);
  assert.equal(Buffer.from(session.value).toString('utf8').includes(password), false);
});

// 32
test('service worker update check is throttled at fifteen minutes', () => {
  const t = 10_000_000;
  assert.equal(sw.SERVICE_WORKER_UPDATE_INTERVAL_MS, 15 * 60 * 1000);
  assert.equal(sw.shouldCheckServiceWorkerUpdate(t, t + 14 * 60 * 1000), false);
  assert.equal(sw.shouldCheckServiceWorkerUpdate(t, t + 15 * 60 * 1000), true);
  assert.match(swRegister, /registration\.update\(\)/);
  assert.match(swRegister, /visibilitychange/);
  assert.match(swRegister, /window\.addEventListener\("focus"/);
});
// 33
test('waiting worker still requires explicit player Refresh', () => {
  assert.match(swRegister, /const applyUpdate = \(\) =>/);
  assert.match(swRegister, /waiting\.postMessage\(\{ type: "SKIP_WAITING" \}\)/);
});
// 34
test('no automatic reload occurs without explicit Refresh action', () => {
  assert.match(swRegister, /if \(reloadForUpdateRef\.current\) window\.location\.reload\(\)/);
  assert.equal((swRegister.match(/reloadForUpdateRef\.current = true/g) || []).length, 1);
});
// 35
test('Admin remains network-only because F.3 does not alter service-worker fetch policy', () => {
  assert.equal(SW_BLOB, '31b16413f3b0bd0d131e12bdc84e618029ebc1e7');
  assert.doesNotMatch(swRegister, /caches\.|CacheStorage/);
});

// Additional security and wiring checks required by F.3 negative tests.
test('username alone cannot regenerate a private recovery secret', () => {
  const block = betaRequests.slice(betaRequests.indexOf('export async function regenerateFoundingBetaMagicAccess'), betaRequests.indexOf('export async function rejectFoundingBetaRequest'));
  assert.match(block, /requestId: string/);
  assert.doesNotMatch(block, /resolveChessComPlayer|usernameInput|requestedUsername/);
});
test('wrong Firebase UID cannot resume another player Preview', () => assert.equal(entry.decidePreviewEntry({ expectedUid: 'chesscom_568816694', currentUid: 'chesscom_777' }).action, 'cross_account'));
test('rejected/revoked identity is not converted into a client resume credential', () => {
  assert.doesNotMatch(preview, /statusToken.*signInWithCustomToken|signInWithCustomToken\([^,]*statusToken/);
  assert.match(preview, /signInWithCustomToken\(auth, body\.customToken\)/);
});
test('entry telemetry omits credentials and contact data', () => {
  const previewLog = previewRoute.match(/console\.info\("\[BoardSignal player entry\]", \{([\s\S]*?)\n  \}\);/)?.[1] ?? '';
  const magicLog = magicRoute.match(/console\.info\("\[BoardSignal player entry\]", \{([\s\S]*?)\n    \}\);/)?.[1] ?? '';
  assert.ok(previewLog && magicLog);
  assert.doesNotMatch(`${previewLog}\n${magicLog}`, /statusToken|customToken|ticket|password|email|contactValue/i);
});
test('Founder session helper is shared by middleware and close-to-data server auth helper', () => {
  assert.match(middleware, /founderSession\.mjs/);
  assert.match(founderAuth, /verifyFounderAuthorization/);
  assert.match(founderAuth, /requireFounderAuth/);
});
test('login stops generating random legacy admin_token', () => {
  assert.doesNotMatch(login, /randomBytes|crypto\.randomBytes/);
  assert.match(login, /boardsignal|FOUNDER_SESSION_COOKIE/);
});
test('F.2 approval-alert files remain present and Preview return choice remains before long content', () => {
  assert.match(preview, /Want a heads-up when your identity is confirmed\?/);
  assert.ok(preview.indexOf('<PreviewReturnChoice') < preview.indexOf('<PreviewContent'));
});
test('F.3 does not alter package, lockfile or Firestore-rule baseline identities', () => {
  assert.equal(PACKAGE_BLOB, '95e6b72c781711c23b9b1a173a6c2c16bafb5882');
  assert.equal(PACKAGE_LOCK_BLOB, '0a6af980d8c90f8a877045e323993785806756bf');
  assert.equal(FIRESTORE_RULES_BLOB, 'a08d287ecba85bec03ca68db327fb8a92a304b2a');
});
test('Magic route and Preview route do not log secrets', () => {
  assert.doesNotMatch(magicRoute, /console\.info\([^\n]*(?:ticket|customToken)/i);
  assert.doesNotMatch(previewRoute, /console\.info\([^\n]*(?:statusToken|customToken)/i);
});
