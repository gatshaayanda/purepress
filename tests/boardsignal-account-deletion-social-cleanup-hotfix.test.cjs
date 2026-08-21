const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const service = read('src/lib/boardsignal/server/accountDeletion.ts');
const manifest = read('PATCH-MANIFEST.txt');

function section(start, end) {
  const from = service.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = end ? service.indexOf(end, from + start.length) : service.length;
  return service.slice(from, to < 0 ? service.length : to);
}

const socialCleanup = section('async function deleteSocialReferences', 'type FriendConversationData');
const verification = section('async function assertResetComplete', 'export async function deleteBoardSignalAccount');
const attachmentCleanup = section('type AttachmentReceiptData', 'async function deletePublicReferences');

// 33 locked E.3 acceptance points.
test('1 exact immutable E.3 baseline is recorded', () => {
  assert.match(manifest, /ce270724126aa827bb8e02ec324bc6ee1a20b7de/);
  assert.match(manifest, /Clarify player access and repair public highlights/);
});

test('2 filtered social collection-group query is gone everywhere', () => {
  assert.doesNotMatch(service, /collectionGroup\(["']social["']\)\s*\.where\(\s*["']otherPlayerId["']/);
});

test('3 surviving-user social projection uses deterministic direct path', () => {
  assert.match(service, /collection\("users"\)\.doc\(ownerUid\)\.collection\("social"\)\.doc\(String\(playerId\)\)/);
});

test('4 unrelated social projections are not enumerated for deletion', () => {
  assert.match(service, /page\.docs\.map\(\(document\) => document\.ref\.collection\("social"\)\.doc\(String\(playerId\)\)\)/);
  assert.doesNotMatch(socialCleanup, /recursiveDelete\([^)]*social/);
});

test('5 conflicting direct social projection fails closed', () => {
  assert.match(service, /storedPlayerId !== playerId[\s\S]*lifecycleConflict\("social_references"/);
});

test('6 reset verification uses the same index-independent social scan', () => {
  assert.match(verification, /hasSocialProjection\(input\.playerId\)/);
  assert.doesNotMatch(verification, /collectionGroup/);
});

test('7 relationship cleanup remains two-endpoint stable-ID based', () => {
  assert.match(service, /playerAId/);
  assert.match(service, /playerBId/);
  assert.match(service, /isA === isB/);
  assert.match(service, /targetUid && targetUid !== uid/);
});

test('8 socialBlocks cleanup remains both directions', () => {
  assert.match(socialCleanup, /where\("blockerPlayerId", "==", playerId\)/);
  assert.match(socialCleanup, /where\("blockedPlayerId", "==", playerId\)/);
});

test('9 social request rate limits cleanup remains both directions', () => {
  assert.match(socialCleanup, /where\("actorPlayerId", "==", playerId\)/);
  assert.match(socialCleanup, /where\("targetPlayerId", "==", playerId\)/);
});

test('10 surviving friend request and accepted inbox artifacts are removed', () => {
  assert.match(service, /friend_request_\$\{relationshipId\}/);
  assert.match(service, /friend_accepted_\$\{relationshipId\}/);
});

test('11 absent social records are naturally retry-safe', () => {
  assert.match(service, /if \(!snapshot\.exists\) return 0/);
  assert.match(service, /if \(page\.empty\) return false/);
});

test('12 already-removed private tree is retry-safe', () => {
  assert.match(service, /db\.recursiveDelete\(userRef\.collection\(collectionName\)\)/);
  assert.match(service, /factualReviews\.size/);
});

test('13 secondary lifecycle prevents false alreadyDeleted short-circuit', () => {
  assert.match(service, /secondaryLifecycle = await hasSecondaryLifecycle/);
  assert.match(service, /hasKnownLifecycle = Boolean\([\s\S]*secondaryLifecycle/);
});

test('14 Friend conversation involving deleted stable identity is removed with messages first', () => {
  assert.match(service, /collection\("friendConversations"\)/);
  assert.match(service, /threadTargetsPlayer/);
  assert.match(service, /collection\("messages"\)\.limit\(DELETE_CHUNK_SIZE\)/);
  assert.match(service, /await latest\.ref\.delete\(\)/);
});

test('15 unrelated Friend conversation survives', () => {
  assert.match(service, /if \(!idIndexes\.length && !uidIndexes\.length\) return false/);
});

test('16 Friend-message exclusive attachment is cleaned by fileKey', () => {
  assert.match(attachmentCleanup, /claimKind !== "friend_message"/);
  assert.match(attachmentCleanup, /deleteUploadThingObject\(fileKey/);
});

test('17 player unclaimed upload is caught by uploader ownership fields', () => {
  assert.match(attachmentCleanup, /uploaderUid/);
  assert.match(attachmentCleanup, /uploaderPlayerId/);
  assert.match(attachmentCleanup, /uploaderIdentityKey/);
  assert.match(attachmentCleanup, /scanDeletionOwnedReceipts/);
});

test('18 player_reply exclusive attachment is deleted', () => {
  assert.match(attachmentCleanup, /claimKind === "player_reply"/);
  assert.match(attachmentCleanup, /receiptOwnedByTarget\(receiptData, uid, playerId\)/);
});

test('19 founder_reply exclusive attachment is deleted only for deleted recipient/thread', () => {
  assert.match(attachmentCleanup, /claimKind === "founder_reply"/);
  assert.match(attachmentCleanup, /claimThreadId !== thread\.id/);
  assert.match(attachmentCleanup, /claimRecipientUid !== uid/);
});

test('20 shared founder_campaign attachment is preserved', () => {
  assert.match(attachmentCleanup, /claimKind === "founder_campaign"/);
  assert.match(attachmentCleanup, /sharedCampaignAttachmentsPreserved \+= 1/);
  assert.match(service, /Shared campaign file\/receipt survives one recipient deletion/);
});

test('21 unrelated player receipt and file survive full receipt scan', () => {
  assert.match(service, /if \(!targetOwned && !targetRecipient\) continue/);
});

test('22 UploadThing provider failure prevents deletion success', () => {
  assert.match(service, /ACCOUNT_DELETION_ATTACHMENT_CLEANUP_FAILED/);
  assert.match(service, /status: "cleanup_failed"/);
  assert.match(service, /stage = "chat_attachments"/);
});

test('23 provider cleanup failure remains retryable because destructive trees run afterward', () => {
  const attachmentStage = service.indexOf('stage = "chat_attachments"');
  const friendStage = service.indexOf('stage = "friend_conversations"');
  const privateStage = service.indexOf('stage = "private_player_tree"');
  assert.ok(attachmentStage > -1 && attachmentStage < friendStage && friendStage < privateStage);
});

test('24 already-absent UploadThing object is treated as clean', () => {
  assert.match(service, /uploadThingObjectAlreadyAbsent/);
  assert.match(service, /deleted\.success/);
  assert.match(service, /deleted\.deletedCount > 0/);
  assert.match(service, /status === 404/);
  assert.match(service, /already \(\?:deleted\|gone\)/);
});

test('25 exclusive receipt is removed only after object cleanup succeeds or is already clean', () => {
  const exclusive = section('async function deleteExclusiveReceipt', 'async function scanDeletionOwnedReceipts');
  assert.ok(exclusive.indexOf('deleteUploadThingObject') < exclusive.indexOf('receipt.ref.delete()'));
});

test('26 shared campaign receipt is excluded from deletion-owned receipt scan', () => {
  assert.match(service, /if \(data\.claimKind === "founder_campaign"\) \{[\s\S]*continue; \/\/ Shared campaign file\/receipt survives one recipient deletion/);
});

test('27 final verification catches residual Friend thread', () => {
  assert.match(verification, /findFriendConversations\(input\.playerId, input\.uid\)/);
  assert.match(verification, /friendThreads\.length > 0/);
});

test('28 final verification catches residual exclusive attachment receipt', () => {
  assert.match(verification, /hasDeletionOwnedReceipt\(input\.uid, input\.playerId\)/);
  assert.match(verification, /attachmentReceipt/);
});

test('29 Firebase Auth cleanup remains idempotent', () => {
  assert.match(service, /auth\.deleteUser\(uid\)/);
  assert.match(service, /auth\/user-not-found/);
});

test('30 publicCoverage deletion remains intact after E.2.1', () => {
  assert.match(service, /collection\("publicCoverage"\)\.where\("chessPlayerId", "==", stablePlayerKey\)/);
  assert.match(verification, /publicCoverage/);
});

test('31 E.2.1 access/public highlight repair files are not part of the delta', () => {
  assert.doesNotMatch(manifest, /src\/lib\/boardsignal\/server\/publicCoverageRepair\.ts\s*\n/);
  assert.match(manifest, /E\.2\.1 Player Access\/Public Highlights repair: UNCHANGED/);
});

test('32 Firestore rules and index configuration are unchanged', () => {
  assert.match(manifest, /firestore\.rules: UNCHANGED/);
  assert.match(manifest, /NO NEW FIRESTORE INDEX/);
  const added = manifest.split('ADDED FILES')[1].split('DELETED FILES')[0];
  assert.doesNotMatch(added, /firestore\.indexes\.json/);
});

test('33 package files and locked chess\/Ask\/motion systems remain unchanged', () => {
  assert.match(manifest, /package\.json: UNCHANGED/);
  assert.match(manifest, /package-lock\.json: UNCHANGED/);
  assert.match(manifest, /B\.1 active-week guidance: UNCHANGED/);
  assert.match(manifest, /Patch D motion: UNCHANGED/);
  assert.match(manifest, /Patch E Ask BoardSignal: UNCHANGED/);
  assert.match(manifest, /Stockfish\/quality\/processor\/seven-day logic: UNCHANGED/);
});
