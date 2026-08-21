const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const service = read('src/lib/boardsignal/server/accountDeletion.ts');

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

test('stable-player typed confirmation and fail-closed lifecycle remain authoritative', () => {
  assert.match(service, /function stablePlayerId/);
  assert.match(service, /ACCOUNT_DELETION_PLAYER_ID_REQUIRED/);
  assert.match(service, /ACCOUNT_DELETION_CONFIRMATION_MISMATCH/);
  assert.match(service, /account\.role !== "player"/);
  assert.match(service, /accessStatus: "deleted"/);
  assert.match(service, /identityStatus: "revoked"/);
});

test('Firebase session and Auth cleanup remains idempotent', () => {
  assert.match(service, /auth\.updateUser\(uid, \{ disabled: true \}\)/);
  assert.match(service, /auth\.revokeRefreshTokens\(uid\)/);
  assert.match(service, /auth\.deleteUser\(uid\)/);
  assert.match(service, /auth\/user-not-found/);
  assert.match(service, /alreadyDeleted: true/);
  assert.match(service, /ACCOUNT_DELETION_IDENTITY_CONFLICT/);
  assert.match(service, /authUser\.customClaims\?\.chessPlayerId/);
  assert.match(service, /claimedRole !== "player"/);
});

test('all audited private trees including Desk evidence, A.1 facts and Guide state remain recursive deletion targets', () => {
  for (const name of ['desks', 'factualReviews', 'social', 'inbox', 'conversations', 'pushTokens', 'pulse', 'automationEvents', 'guide', 'guideFeedback']) {
    assert.match(service, new RegExp(`"${name}"`));
  }
  assert.match(service, /db\.recursiveDelete\(userRef\.collection\(collectionName\)\)/);
  assert.match(service, /desk\.ref\.collection\("evidence"\)/);
  assert.match(service, /DELETE_CHUNK_SIZE = 200/);
  assert.match(service, /accountNow[\s\S]*await userRef\.delete\(\)/);
});

test('Beta Preview recovery mappings and temporary credentials are still removed before reset verification', () => {
  assert.match(service, /collection\("betaAccess"\)\.doc\(stablePlayerKey\)/);
  assert.match(service, /collection\("betaRequests"\)\.doc\(stablePlayerKey\)/);
  assert.match(service, /collection\("authCompletionTickets"\)\.where\("uid", "==", uid\)/);
  assert.match(service, /collection\("playerIdentityAliases"\)\.where\("uid", "==", uid\)/);
  assert.match(service, /collection\("playerIdentityAliases"\)\.where\("playerId", "==", playerId\)/);
  assert.match(service, /collection\("chessPlayerAccounts"\)\.doc\(stablePlayerKey\)/);
  assert.match(service, /await betaAccessRef\.delete\(\)/);
  assert.match(service, /await betaRequestRef\.delete\(\)/);
  assert.match(service, /assertResetComplete/);
});

test('public identity and social cleanup remain stable-ID based while social projection cleanup is index-independent', () => {
  for (const collection of ['publicPlayers', 'publicCoverage', 'publicUniverseEvents', 'publicShareMoments', 'shareAttribution']) {
    assert.match(service, new RegExp(`collection\\("${collection}"\\)`));
  }
  assert.doesNotMatch(service, /collectionGroup\("social"\)\.where\("otherPlayerId"/);
  assert.match(service, /scanSocialProjectionsIndexIndependent/);
  assert.match(service, /collection\("users"\)\.orderBy\(FieldPath\.documentId\(\)\)/);
  assert.match(service, /collection\("social"\)\.doc\(String\(playerId\)\)/);
  assert.match(service, /socialRelationships/);
  assert.match(service, /socialBlocks/);
  assert.match(service, /socialRequestRateLimits/);
  assert.match(service, /friend_request_\$\{relationshipId\}/);
  assert.match(service, /friend_accepted_\$\{relationshipId\}/);
  assert.doesNotMatch(service, /where\("canonicalUsername"|where\("username"/);
});

test('E.2 friend conversations and deletion-owned attachment receipts are now part of the destructive lifecycle', () => {
  assert.match(service, /friendConversations/);
  assert.match(service, /participantPlayerIds/);
  assert.match(service, /participantUids/);
  assert.match(service, /chatAttachmentReceipts/);
  assert.match(service, /uploaderUid/);
  assert.match(service, /uploaderPlayerId/);
  assert.match(service, /claimRecipientUid/);
  assert.match(service, /claimKind === "founder_campaign"/);
  assert.match(service, /new UTApi\(\)\.deleteFiles\(fileKey\)/);
  assert.match(service, /ACCOUNT_DELETION_ATTACHMENT_CLEANUP_FAILED/);
});

test('fresh re-onboarding remains a deletion of old lifecycle anchors, never creation of a replacement account', () => {
  assert.match(service, /firebaseUidForChessPlayer\(playerId\)/);
  assert.match(service, /await mappingRef\.delete\(\)/);
  assert.match(service, /await userRef\.delete\(\)/);
  assert.match(service, /betaAccessDeleted/);
  assert.match(service, /betaRequestDeleted/);
  assert.doesNotMatch(service, /ensureStablePlayerAccount|createUser\(/);
  assert.doesNotMatch(service, /quality|processor|Stockfish|cron|seven-day|latest-four/i);
});

test('historical username aliases for the same stable player remain valid history, not canonical conflicts', () => {
  const resolution = section(service, 'for (const alias of [...aliasesByUid.docs, ...aliasesByPlayer.docs])', 'const secondaryLifecycle');
  const canonicalResolution = section(service, 'const authoritativeCanonicalCandidates = [', 'const secondaryLifecycle');
  const aliasDeletion = section(service, 'async function deleteIdentityAliases', 'async function hasSecondaryLifecycle');

  assert.match(service, /Historical alias document IDs are intentionally NOT canonical authority/);
  assert.match(canonicalResolution, /account\?\.chessCom\?\.canonicalUsername/);
  assert.match(canonicalResolution, /mapping\.data\(\)\?\.canonicalUsername/);
  assert.match(canonicalResolution, /betaAccess\.data\(\)\?\.canonicalUsername/);
  assert.match(canonicalResolution, /betaRequest\.data\(\)\?\.canonicalUsername/);
  assert.match(canonicalResolution, /publicPlayer\.data\(\)\?\.username/);
  assert.match(canonicalResolution, /authUser\?\.customClaims\?\.chessUsername/);
  assert.doesNotMatch(canonicalResolution, /aliasesByUid\.docs\.map\(\(alias\) => alias\.id\)/);
  assert.match(service, /!canonicalUsername \|\| !sameUsername\(confirmationUsername, canonicalUsername\)/);
  assert.match(resolution, /aliasUid !== undefined && String\(aliasUid\) !== uid/);
  assert.match(resolution, /Number\.isSafeInteger\(aliasPlayerId\) && aliasPlayerId !== playerId/);
  assert.match(aliasDeletion, /where\("uid", "==", uid\)/);
  assert.match(aliasDeletion, /where\("playerId", "==", playerId\)/);
});

test('partial deletion cannot return alreadyDeleted while secondary lifecycle state survives', () => {
  assert.match(service, /const secondaryLifecycle = await hasSecondaryLifecycle\(\{ uid, playerId \}\)/);
  assert.match(service, /hasKnownLifecycle = Boolean\([\s\S]*secondaryLifecycle/);
  assert.match(service, /hasSocialProjection/);
  assert.match(service, /findFriendConversations/);
  assert.match(service, /hasDeletionOwnedReceipt/);
});
