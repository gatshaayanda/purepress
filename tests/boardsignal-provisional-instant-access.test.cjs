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
const activationTypes = read('src/lib/boardsignal/activation.ts');
const serverActivation = read('src/lib/boardsignal/server/activation.ts');
const betaRequests = read('src/lib/boardsignal/server/betaRequests.ts');
const betaAccess = read('src/lib/boardsignal/server/betaAccess.ts');
const persistence = read('src/lib/boardsignal/server/persistence.ts');
const previewRoute = read('src/app/api/boardsignal/beta-preview/[requestId]/route.ts');
const adminRoute = read('src/app/api/admin/boardsignal/beta-access/route.ts');
const founderUi = read('src/components/FoundingBetaPlayersAdmin.tsx');
const deskUi = read('src/components/UniversalPlayerDesk.tsx');
const publicPlayer = read('src/app/player/[handle]/page.tsx');
const guide = read('src/lib/boardsignal/guide.ts');

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

const provisionalClaim = section(serverActivation, 'export async function claimProvisionalBetaPreview', 'export async function claimBetaPreviewAccess');
const claimRouter = section(serverActivation, 'export async function claimBetaPreviewAccess', 'export function publicBetaPreviewStatus');
const confirmIdentity = section(betaRequests, 'export async function confirmFoundingBetaIdentity', 'export async function revokeProvisionalFoundingBetaIdentity');
const revokeIdentity = section(betaRequests, 'export async function revokeProvisionalFoundingBetaIdentity', 'export async function regenerateFoundingBetaMagicAccess');
const legacyApproval = section(betaRequests, 'export async function approveFoundingBetaRequest', 'export async function confirmFoundingBetaIdentity');
const updatePreferences = section(persistence, 'export async function updatePlayerPreferences', 'async function deleteDeskTree');
const publishDesk = section(persistence, 'export async function publishPrivateDesk', 'export async function loadPublishedDesks');
const accountForToken = section(persistence, 'export async function accountForToken', 'export async function markChessComOAuthLinked');
const oauthLink = section(persistence, 'export async function markChessComOAuthLinked', 'export async function consumeAuthCompletionTicket');
const engineHold = section(deskUi, 'function DeskQualityHold', 'function SignalCard');

test('Preview remains the public-safe first step and can enter private access immediately', () => {
  // 1 username request still reaches Preview without login
  assert.match(requestForm, /Chess\.com username/);
  assert.match(requestForm, /See My BoardSignal/);
  assert.match(requestForm, /\/boardsignal\/preview\/\$\{encodeURIComponent\(requestId\)\}#status=/);

  // 2 Preview contract stays public-safe
  const previewType = section(activationTypes, 'export type BoardSignalBetaPreview', 'export type BetaActivationReturnMethod');
  assert.doesNotMatch(previewType, /signals|evidence|red:|amber:|blue:|inbox|preferredContact/i);

  // 3 eligible first-time request can claim before Founder approval
  assert.match(claimRouter, /if \(status === "approved"\) return claimApprovedBetaPreview/);
  assert.match(claimRouter, /return claimProvisionalBetaPreview/);
  assert.match(previewRoom, /Continue to My Player Room/);
  assert.match(previewRoom, /Founding Beta access starts immediately/);
});

test('provisional claim is possession-protected and anchored to the stable Chess.com identity', () => {
  // 4 claim requires Preview possession verification
  assert.match(provisionalClaim, /verifyBetaPreviewStatusCredential\(requestId, statusTokenInput\)/);
  assert.match(previewRoute, /claimBetaPreviewAccess\(id, body\.statusToken\)/);

  // 5 requestId alone is insufficient
  assert.doesNotMatch(previewRoute, /export async function GET/);
  assert.match(provisionalClaim, /sameHash\(String\(request\.statusTokenHash \?\? ""\), statusToken\)/);

  // 6 invalid/rejected Preview cannot claim
  assert.match(provisionalClaim, /PREVIEW_STATUS_INVALID/);
  assert.match(provisionalClaim, /request\.status !== "pending" \|\| request\.identityReviewStatus === "rejected"/);

  // 7 stable UID is chesscom_<playerId>
  assert.match(provisionalClaim, /firebaseUidForChessPlayer\(identity\.playerId\)/);
  assert.match(provisionalClaim, /mappedUid !== uid/);

  // 8 custom claims carry stable identity and provisional provider/state
  assert.match(provisionalClaim, /boardsignalAuthProvider: "beta_preview_provisional"/);
  assert.match(provisionalClaim, /boardsignalIdentityStatus: "provisional"/);
  assert.match(provisionalClaim, /chessPlayerId: String\(claim\.playerId\)/);
  assert.match(provisionalClaim, /chessUsername: claim\.canonicalUsername/);
});

test('claim creates private provisional access without conflating it with Founder review', () => {
  // 9 account is explicitly provisional
  assert.match(provisionalClaim, /identityStatus: "provisional"/);
  assert.match(provisionalClaim, /identityReviewStatus: "pending"/);
  assert.match(provisionalClaim, /accessStatus: "active"/);

  // 10 request records provisionalClaimedAt while remaining pending
  assert.match(provisionalClaim, /provisionalClaimedAt: claimedAt/);
  assert.doesNotMatch(provisionalClaim, /status:\s*"approved"/);

  // 11 first private entry does not require magic link, email, or device notification
  assert.doesNotMatch(provisionalClaim, /betaMagicAccessCredential|sendBoardSignalEmail|notifyApprovedBetaPreviewDevice/);
  assert.match(previewRoom, /router\.replace\("\/boardsignal\/player-room\?source=beta_preview&tab=desk"\)/);

  // 12 current agreement remains the lightweight first private gate rather than another setup form
  assert.match(provisionalClaim, /contactConfirmedAt:/);
  assert.match(provisionalClaim, /preferencesConfirmedAt:/);
  assert.doesNotMatch(provisionalClaim, /universeParticipationDisclosedAt:/);
});

test('established BoardSignal identities cannot be hijacked by a new provisional request', () => {
  // 13 any established user or active legacy Beta Access blocks a fresh provisional claim
  assert.match(provisionalClaim, /userSnapshot\.exists \|\| betaAccess\.exists/);
  assert.match(provisionalClaim, /ESTABLISHED_ACCOUNT_EXISTS/);

  // 14 founder-reviewed and OAuth-verified identities are explicitly protected
  assert.match(provisionalClaim, /existing\?\.identityStatus === "founder_reviewed"/);
  assert.match(provisionalClaim, /existing\?\.identityStatus === "oauth_verified"/);
  assert.match(provisionalClaim, /existing\?\.chessComOAuthLinkedAt/);

  // 15 a stable mapping to another UID never auto-merges
  assert.match(provisionalClaim, /if \(mappedUid !== uid\)/);
  assert.match(provisionalClaim, /This BoardSignal already exists/);
});

test('Founder review upgrades or revokes the same private identity without re-onboarding', () => {
  // 16 Founder Confirm upgrades identity state and keeps current session alive
  assert.match(confirmIdentity, /identityStatus: "founder_reviewed"/);
  assert.match(confirmIdentity, /founderReviewedAt: decidedAt/);
  assert.doesNotMatch(confirmIdentity, /revokeRefreshTokens|resetFoundingBetaAccess/);

  // 17 official public identity is created only at review, not provisional claim
  assert.doesNotMatch(provisionalClaim, /publicPlayers|writePublicUniverseEvent|newPlayerUniverseEvent/);
  assert.match(confirmIdentity, /collection\("publicPlayers"\)/);
  assert.match(confirmIdentity, /writePublicUniverseEvent\(newPlayerUniverseEvent/);

  // 18 Founder Revoke blocks account access, revokes refresh sessions, and preserves stored data
  assert.match(revokeIdentity, /identityStatus: "revoked"/);
  assert.match(revokeIdentity, /accessStatus: "paused"/);
  assert.match(revokeIdentity, /revokeRefreshTokens\(uid\)/);
  assert.doesNotMatch(revokeIdentity, /delete\(|resetFoundingBetaAccess/);
  assert.match(accountForToken, /identityStatus === "revoked"/);
});

test('private Desk value is allowed while public identity mutations remain review-gated', () => {
  // 19 provisional private Desk persistence stays available under the existing quality PASS contract
  assert.match(publishDesk, /validateDeskForPublication\(desk, engineResults\)/);
  assert.match(publishDesk, /batch\.set\(deskRef/);

  // 20 public coverage/share/Universe writes are gated by identity state
  assert.match(persistence, /function publicIdentityAllowed/);
  assert.match(publishDesk, /const allowPublicIdentity = publicIdentityAllowed\(account\)/);
  assert.match(publishDesk, /const publicCoverage = allowPublicIdentity \?/);
  assert.match(publishDesk, /if \(allowPublicIdentity && !alreadyPublished/);
  assert.match(updatePreferences, /if \(allowPublicIdentity\)/);

  // 21 public page no longer suggests missing public approval means private BoardSignal failed
  assert.match(publicPlayer, /Public BoardSignal highlights are not live for this player yet/);
  assert.match(publicPlayer, /A private BoardSignal can exist without appearing on this public page/);
});

test('engine-only first-value failure keeps factual private value without weakening quality', () => {
  // 22 engine-review failure gets an in-Player-Room factual recovery surface
  assert.match(engineHold, /ENGINE_REVIEW_UNAVAILABLE/);
  assert.match(engineHold, /ENGINE_REVIEW_INCOMPLETE/);
  assert.match(engineHold, /Position review is still finishing/);
  assert.match(engineHold, /Retry position analysis/);

  // 23 factual week remains visible while private Signal/evidence claims stay absent from the recovery branch
  assert.match(engineHold, /desk\.games/);
  assert.match(engineHold, /desk\.wins/);
  assert.match(engineHold, /desk\.draws/);
  assert.match(engineHold, /desk\.losses/);
  assert.match(engineHold, /desk\.pools/);
  assert.doesNotMatch(section(engineHold, 'if (engineUnavailable)', 'return (\n    <div id="main" className="desk-processing-page"'), /desk\.signals|EvidenceCard|desk\.candidates/);

  // 24 core quality/engine files are untouched from b241 production baseline
  assertBaselineFile('src/lib/boardsignal/quality.ts');
  assertBaselineFile('src/lib/boardsignal/processor.ts');
});

test('legacy/recovery paths and Preview return remain compatible', () => {
  // 25 approved historical requests retain their existing claim route
  assert.match(claimRouter, /status === "approved"/);
  assert.match(claimRouter, /claimApprovedBetaPreview/);

  // 26 legacy Beta Access is still read-only during compound approval
  assert.match(legacyApproval, /loadExistingFoundingBetaAccess\(request\.chessPlayerId\)/);
  assert.doesNotMatch(legacyApproval, /resetFoundingBetaAccess/);
  assert.doesNotMatch(legacyApproval, /revokeRefreshTokens/);

  assert.match(betaRequests, /const provisionalRecovery = request\.status === "pending" && Boolean\(request\.provisionalClaimedAt\)/);
  assert.match(serverActivation, /request\.status === "approved" \|\| provisionalRecovery/);

  // 27 explicit Reset remains explicit in betaAccess implementation
  assert.match(betaAccess, /export async function resetFoundingBetaAccess/);
  assert.match(betaAccess, /revokeExistingFirebaseSession\(account\.uid\)/);

  // 28 same-device Preview Return remains the pre-claim recovery bridge
  assert.match(previewReturn, /boardsignal-beta-preview-return-v1/);
  assert.match(previewReturn, /window\.localStorage\.setItem/);
  assert.match(previewRoom, /clearSavedBetaPreviewReturn\(requestId\)/);
});

test('notifications, Founder moderation alerts, Ask wording and OAuth future path remain bounded', () => {
  // 29 provisional claim best-effort Founder alert cannot roll back access
  assert.match(provisionalClaim, /notifyFounderOfProvisionalClaim/);
  assert.match(provisionalClaim, /\.catch\(\(\) => \(\{ eligible: true, delivered: 0, failed: 1 \}\)\)/);
  assert.match(provisionalClaim, /founderAlertProvisionalClaim/);

  // 30 Founder UI distinguishes active provisional access from review status
  assert.match(founderUi, /PROVISIONAL PLAYER ROOM ACTIVE/);
  assert.match(founderUi, /Player already has private BoardSignal access\. Identity review is still pending\./);
  assert.match(founderUi, /Confirm Identity/);
  assert.match(founderUi, /Revoke Access/);

  // 31 already-granted browser permission is reused; claim itself never prompts for permission
  const openRoom = section(previewRoom, 'async function openPlayerRoom', 'function ask');
  assert.match(openRoom, /Notification\.permission === "granted"/);
  assert.doesNotMatch(openRoom, /Notification\.requestPermission/);

  // 32 Ask no longer tells eligible Preview users to wait for approval/email/magic
  assert.match(guide, /Continue to My Player Room opens private Founding Beta access now/);
  assert.match(guide, /Identity review happens quietly in the background/);
  assert.match(guide, /You're already in\. Your private BoardSignal is available now/);

  // 33 future same-player OAuth upgrades account status on the same UID; mismatched stable mapping is never merged
  assert.match(oauthLink, /identityStatus: "oauth_verified"/);
  assert.doesNotMatch(oauthLink, /createUser|firebaseUidForChessPlayer|chessPlayerAccounts|playerIdentityAliases/);
  assert.match(provisionalClaim, /mappedUid !== uid/);
});

test('release gates and public/private infrastructure stay locked', () => {
  // 34 prebuild remains exact and Firestore/PWA/engine release files are unchanged
  assert.equal(pkg.scripts.prebuild, 'npm run prepare:stockfish && npm run test:contrast');
  assertBaselineFile('firestore.rules');
  assertBaselineFile('public/sw.js');

  // 35 no engine or public/private meaning modules are imported into a new alternate pipeline
  assert.doesNotMatch(provisionalClaim, /processor|quality|Stockfish|universe\.ts|pulse\.ts/);
  assert.match(previewRoute, /claimBetaPreviewAccess/);
  assert.match(adminRoute, /confirmIdentity/);
  assert.match(adminRoute, /revokeIdentity/);
});
