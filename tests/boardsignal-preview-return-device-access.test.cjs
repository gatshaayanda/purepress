const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const BASELINE_SHA = 'b24191dca59c0ce5c33631c414745df4f17d02d7';
const normalizeText = (value) => value.replace(/\r\n/g, '\n');
const assertBaselineFile = (file) => {
  const current = normalizeText(read(file));
  const baseline = normalizeText(execFileSync('git', ['show', `${BASELINE_SHA}:${file}`], { cwd: root, encoding: 'utf8' }));
  assert.equal(current, baseline, `${file} changed from locked baseline ${BASELINE_SHA}`);
};
const pkg = JSON.parse(read('package.json'));
const requestForm = read('src/components/UsernameDeskForm.tsx');
const previewRoom = read('src/components/BetaPreviewRoom.tsx');
const previewReturn = read('src/lib/boardsignal/previewReturn.ts');
const activation = read('src/lib/boardsignal/activation.ts');
const serverActivation = read('src/lib/boardsignal/server/activation.ts');
const betaRequests = read('src/lib/boardsignal/server/betaRequests.ts');
const previewRoute = read('src/app/api/boardsignal/beta-preview/[requestId]/route.ts');
const requestRoute = read('src/app/api/boardsignal/beta-request/route.ts');
const browserPush = read('src/components/BrowserPushControl.tsx');
const founderUi = read('src/components/FoundingBetaPlayersAdmin.tsx');
const founderAlerts = read('src/components/FounderBetaRequestAlerts.tsx');
const guide = read('src/lib/boardsignal/guide.ts');
const serverGuide = read('src/lib/boardsignal/server/guide.ts');
const profile = read('src/components/PlayerProfileNotifications.tsx');
const firestore = read('firestore.rules');
const sw = read('public/sw.js');
const css = read('src/app/globals.css');

function section(source, start, end) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`missing ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}
function all(source, parts) { return parts.every((part) => typeof part === 'string' ? source.includes(part) : part.test(source)); }

const submit = section(betaRequests, 'export async function submitFoundingBetaRequest', 'export async function retryFoundingBetaPreview');
const updateReturn = section(betaRequests, 'export async function updateFoundingBetaReturnPreference', 'export async function listFoundingBetaRequests');
const approval = section(betaRequests, 'export async function approveFoundingBetaRequest', 'export async function confirmFoundingBetaIdentity');
const registerDevice = section(serverActivation, 'export async function registerBetaPreviewNotificationDevice', 'export async function notifyApprovedBetaPreviewDevice');
const approvalPush = section(serverActivation, 'export async function notifyApprovedBetaPreviewDevice', 'export async function registerFounderNotificationDevice');
const claim = section(serverActivation, 'export async function claimApprovedBetaPreview', 'export async function registerBetaPreviewNotificationDevice');
const openRoom = section(previewRoom, 'async function openPlayerRoom', 'function ask');
const enableDevice = section(previewRoom, 'async function enableDevice', 'async function choose');
const previewType = section(activation, 'export type BoardSignalBetaPreview', 'export type BetaActivationReturnMethod');

test('request gate and Preview value stay frictionless and public-safe', () => {
  // 1 new request can be username-only
  assert.ok(all(requestForm, ['Chess.com username', 'See My BoardSignal']) && !/preferredContactMethod:|preferredContactValue:|betaContactConsent:/.test(requestForm));
  // 2 Preview still appears immediately
  assert.ok(all(requestForm, ['saveBetaPreviewReturn(', '/boardsignal/preview/${encodeURIComponent(requestId)}#status=']));
  // 3 existing contact-first requests remain compatible
  assert.ok(all(submit, ['preferredContactMethod?: unknown', 'hasLegacyContactInput', 'hasLegacyContactInput ? validateContact']));
  // 4 safe Preview privacy unchanged
  assert.ok(all(activation, ['"red"', '"amber"', '"blue"', '"evidence"']) && !/preferredContact|betaContactConsent|activationDevice|fcm/i.test(previewType));
  // 5 return method is selected after Preview value
  assert.ok(previewRoom.indexOf('{returnChoice}') > previewRoom.indexOf('YOUR UNIVERSE PREVIEW') && previewRoom.includes('KEEP MY BOARDSIGNAL READY'));
});

test('device notification is explicit, possession-protected, and reuses current push infrastructure', () => {
  // 6 device notification requires explicit click
  assert.ok(enableDevice.includes('Notification.requestPermission()') && previewRoom.includes('onClick={() => void choose("device")}'));
  // 7 no permission request on Preview load
  assert.ok(!section(previewRoom, 'useEffect(() => {', 'const loadStatus').includes('Notification.requestPermission'));
  // 8 existing service worker reused
  assert.ok(browserPush.includes('navigator.serviceWorker.ready') && !previewRoom.includes('serviceWorker.register('));
  // 9 pending-device registration requires valid Preview credential
  assert.ok(registerDevice.includes('verifyBetaPreviewStatusCredential(input.requestId, input.statusToken)'));
  // 10 requestId alone cannot register device
  assert.ok(previewRoute.includes('statusToken: body.statusToken') && !previewRoute.includes('export async function GET'));
  // 11 pending FCM token stays server-controlled
  assert.ok(registerDevice.includes('activationDevice: { token, registeredAt: now') && !previewRoute.includes('activationDevice:'));
});

test('same-device Preview possession survives closure and cleans up safely', () => {
  // 12 same-device Preview credential persists across browser restart
  assert.ok(all(previewReturn, ['boardsignal-beta-preview-return-v1', 'window.localStorage.setItem', 'Date.parse(existing.createdAt) > Date.parse(createdAt)']));
  // 13 expired local Preview is removed
  assert.ok(all(previewReturn, ['Date.parse(parsed.expiresAt) <= now', 'window.localStorage.removeItem(STORAGE_KEY)']));
  // 14 claimed local Preview is removed
  assert.ok(claim.includes('activationDevice: null') && openRoom.includes('clearSavedBetaPreviewReturn(requestId)'));
  // 15 rejected local Preview is removed
  assert.ok(previewRoom.includes('["rejected", "expired", "claimed"].includes(body.status.state)'));
  // 16 Continue Preview appears for valid saved request
  assert.ok(all(requestForm, ['CONTINUE YOUR BOARDSIGNAL PREVIEW', 'Continue Preview']));
  // 17 server still verifies status before showing approved
  assert.ok(all(requestForm, ['action: "status", statusToken: saved.statusCredential', 'body.status.state === "approved" && body.status.accessReady']));
});

test('approval notification returns to Preview without making push a hard dependency', () => {
  // 18 approval push deep-links to exact Preview without secret in URL
  assert.ok(approvalPush.includes('const link = `/boardsignal/preview/${encodeURIComponent(input.requestId)}`') && !/status=|statusToken|ticket=/.test(approvalPush));
  // 19 push failure never rolls back approval
  assert.ok(approval.includes('notifyApprovedBetaPreviewDevice') && approval.includes('.catch(() => ({ eligible: true, delivered: 0, failed: 1'));
  // 20 return_here works without external contact
  assert.ok(updateReturn.includes('method === "return_here"') && !section(updateReturn, 'method === "return_here"', '} else {').includes('validateContact'));
});

test('backup contact can be added or corrected after Preview without changing identity', () => {
  // 21 email can be added after Preview
  assert.ok(all(previewRoom, ['Email address', 'Save ${selected}']) && updateReturn.includes('method === "email"'));
  // 22 email can be edited while pending
  assert.ok(previewRoom.includes('You can correct this while the Preview is pending') && updateReturn.includes('request.status !== "pending"'));
  // 23 Discord/Telegram can be changed while pending
  assert.ok(all(updateReturn, ['method === "discord"', 'method === "telegram"']));
  // 24 contact edit cannot change stable Chess.com player identity
  assert.ok(!/chessPlayerId\s*:|canonicalUsername\s*:/.test(updateReturn));
  // 25 approval hydrates valid external contact
  assert.ok(all(approval, ['validExternalContact', 'preferredContactMethod: request.preferredContactMethod', 'preferredContactValue: request.preferredContactValue']));
  // 26 deliberate no-external-contact return choice does not force setup before Desk
  assert.ok(all(approval, ['completedReturnDecision', 'contactConfirmedAt', 'preferencesConfirmedAt']) && all(profile, ['External contact', '"Not added"']));
});

test('recovery access and legacy compatibility remain intact', () => {
  // 27 magic access remains fallback
  assert.ok(previewRoom.includes('Magic access and username + access code remain recovery paths'));
  // 28 legacy Beta Access hotfix remains intact
  assert.ok(approval.includes('loadExistingFoundingBetaAccess(request.chessPlayerId)'));
  // 29 existing Beta code is not reset
  assert.ok(!approval.includes('resetFoundingBetaAccess'));
  // 30 existing Firebase session is not revoked
  assert.ok(!/revokeRefreshTokens|revokeExistingFirebaseSession/.test(approval));
});

test('post-claim notification migration avoids another browser permission prompt', () => {
  // 31 post-claim push registration attaches to stable account if permission exists
  assert.ok(all(openRoom, ['Notification.permission === "granted"', 'registerBoardSignalBrowserPush(idToken)']));
  // 32 no duplicate browser permission prompt
  assert.ok(!openRoom.includes('Notification.requestPermission'));
});

test('Ask and Founder surfaces reflect return state and keep audiences separate', () => {
  // 33 Ask explains actual return state
  assert.ok(all(guide, ['how do i come back', 'Email is optional', 'activationReturnMethod === "device" && p.deviceAlertsEnabled']) && serverGuide.includes('activationReturnMethod:'));
  // 34 Founder UI shows return method
  assert.ok(all(founderUi, ['DEVICE ALERTS ENABLED', 'SAVED ON DEVICE', 'PREVIEW SAVED']));
  // 35 Founder alert path remains separate from player approval push
  assert.ok(founderAlerts.toLowerCase().includes('founder') && !approvalPush.includes('founderNotificationDevices'));
});

test('locked infrastructure and release gates remain unchanged', () => {
  // 36 PWA service worker unchanged
  assertBaselineFile('public/sw.js');
  // 37 no Firestore rule loosening
  assertBaselineFile('firestore.rules');
  // 38 current production prebuild remains unchanged
  assert.equal(pkg.scripts.prebuild, 'npm run prepare:stockfish && npm run test:contrast');
  // 39 contrast contract remains wired and Preview styles use semantic surfaces
  assert.ok(pkg.scripts['test:contrast'] === 'node scripts/check-boardsignal-contrast.mjs' && all(css, ['beta-preview-return', 'var(--bs-text-primary)', 'var(--bs-surface-paper)']));
});
