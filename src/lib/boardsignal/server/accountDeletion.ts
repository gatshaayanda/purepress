import "server-only";

import { createHash } from "node:crypto";
import { FieldPath } from "firebase-admin/firestore";
import type { DocumentSnapshot, Query, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { UTApi } from "uploadthing/server";
import { firebaseUidForChessPlayer, type BoardSignalAccount } from "../account";
import { getAdminAuth, getAdminDb } from "../../../utils/firebaseAdmin";

// Patch E.3 immutable baseline:
// ce270724126aa827bb8e02ec324bc6ee1a20b7de — Clarify player access and repair public highlights
const DELETE_CHUNK_SIZE = 200;

const PRIVATE_PLAYER_SUBCOLLECTIONS = [
  "desks",
  "factualReviews",
  "social",
  "inbox",
  "conversations",
  "pushTokens",
  "pulse",
  "automationEvents",
  "guide",
  "guideFeedback",
] as const;

type DeletionStage =
  | "resolve_target"
  | "fail_closed"
  | "revoke_sessions"
  | "chat_attachments"
  | "friend_conversations"
  | "private_player_tree"
  | "social_references"
  | "public_references"
  | "temporary_credentials"
  | "firebase_auth"
  | "identity_mappings"
  | "account_document"
  | "verify_reset";

export type BoardSignalAccountDeletionSummary = {
  playerId: number;
  canonicalUsername: string;
  alreadyDeleted: boolean;
  firebaseSessionsRevoked: boolean;
  firebaseAuthDeleted: boolean;
  accountDeleted: boolean;
  identityMappingsDeleted: number;
  betaAccessDeleted: boolean;
  betaRequestDeleted: boolean;
  desksDeleted: number;
  deskEvidenceDeleted: number;
  factualReviewsDeleted: number;
  privateSubcollectionsDeleted: string[];
  socialReferencesDeleted: number;
  publicReferencesDeleted: number;
  temporaryCredentialsDeleted: number;
  friendThreadsDeleted: number;
  friendMessagesDeleted: number;
  attachmentReceiptsDeleted: number;
  attachmentFilesDeleted: number;
  sharedCampaignAttachmentsPreserved: number;
};

export class BoardSignalAccountDeletionError extends Error {
  status: number;
  code: string;
  stage: DeletionStage;

  constructor(code: string, stage: DeletionStage, message: string, status = 409) {
    super(message);
    this.name = "BoardSignalAccountDeletionError";
    this.status = status;
    this.code = code;
    this.stage = stage;
  }
}

function stablePlayerId(value: unknown) {
  const playerId = Number(value);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new BoardSignalAccountDeletionError("ACCOUNT_DELETION_PLAYER_ID_REQUIRED", "resolve_target", "A stable Chess.com player ID is required.", 400);
  }
  return playerId;
}

function normalizedConfirmation(value: unknown) {
  const username = String(value ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_-]{2,50}$/.test(username)) {
    throw new BoardSignalAccountDeletionError("ACCOUNT_DELETION_CONFIRMATION_REQUIRED", "resolve_target", "Type the player's canonical Chess.com username to confirm deletion.", 400);
  }
  return username;
}

function sameUsername(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function identityConflict(detail: string): never {
  throw new BoardSignalAccountDeletionError(
    "ACCOUNT_DELETION_IDENTITY_CONFLICT",
    "resolve_target",
    `BoardSignal stopped account deletion because the stable identity records conflict: ${detail}`,
    409,
  );
}

function lifecycleConflict(stage: DeletionStage, detail: string): never {
  throw new BoardSignalAccountDeletionError(
    "ACCOUNT_DELETION_LIFECYCLE_CONFLICT",
    stage,
    `BoardSignal stopped account deletion because a deletion-owned record conflicted with the stable player identity: ${detail}`,
    409,
  );
}

async function existingAuthUser(uid: string) {
  try {
    return await getAdminAuth().getUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") return undefined;
    throw error;
  }
}

async function deleteDocumentsInChunks(documents: QueryDocumentSnapshot[]) {
  const db = getAdminDb();
  let deleted = 0;
  for (let offset = 0; offset < documents.length; offset += DELETE_CHUNK_SIZE) {
    const chunk = documents.slice(offset, offset + DELETE_CHUNK_SIZE);
    const batch = db.batch();
    chunk.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function queryDocuments(query: Query) {
  const snapshot = await query.get();
  return snapshot.docs;
}

async function deleteQueryInChunks(query: Query, validate?: (document: QueryDocumentSnapshot) => void) {
  let deleted = 0;
  while (true) {
    const snapshot = await query.limit(DELETE_CHUNK_SIZE).get();
    if (snapshot.empty) break;
    snapshot.docs.forEach((document) => validate?.(document));
    deleted += await deleteDocumentsInChunks(snapshot.docs);
  }
  return deleted;
}

function validateStableField(document: QueryDocumentSnapshot, field: string, expected: string | number) {
  const actual = document.data()?.[field];
  if (String(actual) !== String(expected)) identityConflict(`${document.ref.path} did not match ${field}=${expected}.`);
}

async function countDeskEvidence(uid: string) {
  const db = getAdminDb();
  const desks = await db.collection("users").doc(uid).collection("desks").get();
  let evidence = 0;
  for (const desk of desks.docs) {
    evidence += (await desk.ref.collection("evidence").get()).size;
  }
  return { desks: desks.size, evidence };
}

async function deletePrivatePlayerTree(uid: string) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const factualReviews = await userRef.collection("factualReviews").get();
  const deskCounts = await countDeskEvidence(uid);

  // Firestore does not cascade subcollections. recursiveDelete is applied to the
  // explicit audited BoardSignal user collections so nested Desk evidence and
  // conversation messages are removed without assuming a 500-write ceiling.
  for (const collectionName of PRIVATE_PLAYER_SUBCOLLECTIONS) {
    await db.recursiveDelete(userRef.collection(collectionName));
  }

  return {
    desksDeleted: deskCounts.desks,
    deskEvidenceDeleted: deskCounts.evidence,
    factualReviewsDeleted: factualReviews.size,
    privateSubcollectionsDeleted: [...PRIVATE_PLAYER_SUBCOLLECTIONS],
  };
}

type SocialRelationshipData = {
  playerAId?: number;
  playerAUid?: string;
  playerBId?: number;
  playerBUid?: string;
};

type RelationshipEndpoint = {
  otherUid?: string;
};

function relationshipEndpoint(relationship: QueryDocumentSnapshot, playerId: number, uid: string): RelationshipEndpoint {
  const data = relationship.data() as SocialRelationshipData;
  const isA = Number(data.playerAId) === playerId;
  const isB = Number(data.playerBId) === playerId;
  if (isA === isB) identityConflict(`${relationship.ref.path} did not identify exactly one deleted-player endpoint.`);
  const targetUid = isA ? data.playerAUid : data.playerBUid;
  if (targetUid && targetUid !== uid) identityConflict(`${relationship.ref.path} pointed the deleted player at another uid.`);
  const otherPlayerId = Number(isA ? data.playerBId : data.playerAId);
  const otherUid = isA ? data.playerBUid : data.playerAUid;
  if (!Number.isSafeInteger(otherPlayerId) || otherPlayerId <= 0 || !otherUid || otherUid === uid) {
    lifecycleConflict("social_references", `${relationship.ref.path} did not contain a safe surviving relationship endpoint.`);
  }
  if (otherUid !== firebaseUidForChessPlayer(otherPlayerId)) {
    lifecycleConflict("social_references", `${relationship.ref.path} pointed the surviving player ID at another uid.`);
  }
  return { otherUid };
}

async function deleteRelationshipInboxArtifacts(relationship: QueryDocumentSnapshot, playerId: number, uid: string) {
  const db = getAdminDb();
  const { otherUid } = relationshipEndpoint(relationship, playerId, uid);
  if (!otherUid) return 0;

  const relationshipId = relationship.id;
  const otherInbox = db.collection("users").doc(otherUid).collection("inbox");
  const refs = [
    otherInbox.doc(`friend_request_${relationshipId}`),
    otherInbox.doc(`friend_accepted_${relationshipId}`),
  ];
  const snapshots = await Promise.all(refs.map((ref) => ref.get()));
  const existing = snapshots.filter((snapshot) => snapshot.exists);
  await Promise.all(existing.map((snapshot) => snapshot.ref.delete()));
  return existing.length;
}

async function deleteDirectSocialProjection(ownerUid: string, playerId: number) {
  const ref = getAdminDb().collection("users").doc(ownerUid).collection("social").doc(String(playerId));
  const snapshot = await ref.get();
  if (!snapshot.exists) return 0;
  const storedPlayerId = Number(snapshot.data()?.otherPlayerId);
  if (storedPlayerId !== playerId) {
    lifecycleConflict("social_references", `${ref.path} did not match otherPlayerId=${playerId}.`);
  }
  await ref.delete();
  return 1;
}

async function scanSocialProjectionsIndexIndependent(
  playerId: number,
  visitor: (snapshot: DocumentSnapshot) => Promise<boolean | void> | boolean | void,
) {
  const db = getAdminDb();
  let afterId: string | undefined;
  while (true) {
    let query: Query = db.collection("users").orderBy(FieldPath.documentId()).limit(DELETE_CHUNK_SIZE);
    if (afterId) query = query.startAfter(afterId);
    const page = await query.get();
    if (page.empty) return false;
    afterId = page.docs.at(-1)!.id;

    const refs = page.docs.map((document) => document.ref.collection("social").doc(String(playerId)));
    const projections = refs.length ? await db.getAll(...refs) : [];
    for (const projection of projections) {
      if (!projection.exists) continue;
      const storedPlayerId = Number(projection.data()?.otherPlayerId);
      if (storedPlayerId !== playerId) {
        lifecycleConflict("social_references", `${projection.ref.path} did not match otherPlayerId=${playerId}.`);
      }
      if (await visitor(projection)) return true;
    }
    if (page.size < DELETE_CHUNK_SIZE) return false;
  }
}

async function deleteOrphanSocialProjections(playerId: number) {
  let deleted = 0;
  await scanSocialProjectionsIndexIndependent(playerId, async (projection) => {
    await projection.ref.delete();
    deleted += 1;
  });
  return deleted;
}

async function hasSocialProjection(playerId: number) {
  let found = false;
  await scanSocialProjectionsIndexIndependent(playerId, () => {
    found = true;
    return true;
  });
  return found;
}

async function deleteSocialReferences(playerId: number, uid: string) {
  const db = getAdminDb();
  const relationships = new Map<string, QueryDocumentSnapshot>();
  for (const query of [
    db.collection("socialRelationships").where("playerAId", "==", playerId),
    db.collection("socialRelationships").where("playerBId", "==", playerId),
  ]) {
    for (const document of await queryDocuments(query)) relationships.set(document.ref.path, document);
  }

  let deleted = 0;
  for (const relationship of relationships.values()) {
    const { otherUid } = relationshipEndpoint(relationship, playerId, uid);
    deleted += await deleteRelationshipInboxArtifacts(relationship, playerId, uid);
    if (otherUid) deleted += await deleteDirectSocialProjection(otherUid, playerId);
  }
  deleted += await deleteDocumentsInChunks([...relationships.values()]);

  // E.3 deliberately avoids a filtered collectionGroup("social") query. Every
  // current BoardSignal user is paged in bounded chunks and only the deterministic
  // users/{uid}/social/{deletedPlayerId} document is inspected. This also cleans
  // orphan projections whose relationship record disappeared on an earlier retry.
  deleted += await deleteOrphanSocialProjections(playerId);

  deleted += await deleteQueryInChunks(
    db.collection("socialBlocks").where("blockerPlayerId", "==", playerId),
    (document) => validateStableField(document, "blockerPlayerId", playerId),
  );
  deleted += await deleteQueryInChunks(
    db.collection("socialBlocks").where("blockedPlayerId", "==", playerId),
    (document) => validateStableField(document, "blockedPlayerId", playerId),
  );
  deleted += await deleteQueryInChunks(
    db.collection("socialRequestRateLimits").where("actorPlayerId", "==", playerId),
    (document) => validateStableField(document, "actorPlayerId", playerId),
  );
  deleted += await deleteQueryInChunks(
    db.collection("socialRequestRateLimits").where("targetPlayerId", "==", playerId),
    (document) => validateStableField(document, "targetPlayerId", playerId),
  );
  return deleted;
}

type FriendConversationData = {
  participantUids?: unknown;
  participantPlayerIds?: unknown;
};

function threadTargetsPlayer(document: QueryDocumentSnapshot, playerId: number, uid: string) {
  const data = document.data() as FriendConversationData;
  const playerIds = Array.isArray(data.participantPlayerIds) ? data.participantPlayerIds.map(Number) : [];
  const uids = Array.isArray(data.participantUids) ? data.participantUids.map(String) : [];
  const idIndexes = playerIds.flatMap((value, index) => value === playerId ? [index] : []);
  const uidIndexes = uids.flatMap((value, index) => value === uid ? [index] : []);
  if (!idIndexes.length && !uidIndexes.length) return false;
  if (playerIds.length !== 2 || uids.length !== 2 || idIndexes.length !== 1 || uidIndexes.length !== 1 || idIndexes[0] !== uidIndexes[0]) {
    lifecycleConflict("friend_conversations", `${document.ref.path} had conflicting participant identity fields.`);
  }
  for (let index = 0; index < playerIds.length; index += 1) {
    if (!Number.isSafeInteger(playerIds[index]) || playerIds[index] <= 0) {
      lifecycleConflict("friend_conversations", `${document.ref.path} had an invalid participant player ID.`);
    }
    if (uids[index] !== firebaseUidForChessPlayer(playerIds[index])) {
      lifecycleConflict("friend_conversations", `${document.ref.path} had a participant uid that did not match its stable player ID.`);
    }
  }
  return true;
}

async function findFriendConversations(playerId: number, uid: string) {
  const db = getAdminDb();
  const found: QueryDocumentSnapshot[] = [];
  let afterId: string | undefined;
  while (true) {
    let query: Query = db.collection("friendConversations").orderBy(FieldPath.documentId()).limit(DELETE_CHUNK_SIZE);
    if (afterId) query = query.startAfter(afterId);
    const page = await query.get();
    if (page.empty) break;
    afterId = page.docs.at(-1)!.id;
    for (const document of page.docs) {
      if (threadTargetsPlayer(document, playerId, uid)) found.push(document);
    }
    if (page.size < DELETE_CHUNK_SIZE) break;
  }
  return found;
}

type AttachmentReceiptData = {
  fileKey?: string;
  status?: string;
  uploaderActorType?: string;
  uploaderIdentityKey?: string;
  uploaderUid?: string;
  uploaderPlayerId?: number;
  claimKind?: string;
  claimId?: string;
  claimThreadId?: string;
  claimRecipientUid?: string;
};

type AttachmentCleanupResult = {
  attachmentReceiptsDeleted: number;
  attachmentFilesDeleted: number;
  sharedCampaignAttachmentsPreserved: number;
};

function emptyAttachmentCleanupResult(): AttachmentCleanupResult {
  return { attachmentReceiptsDeleted: 0, attachmentFilesDeleted: 0, sharedCampaignAttachmentsPreserved: 0 };
}

function attachmentReceiptRef(fileKey: string) {
  const id = createHash("sha256").update(fileKey).digest("hex");
  return getAdminDb().collection("chatAttachmentReceipts").doc(id);
}

function fileKeyFromAttachment(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const fileKey = String((value as { fileKey?: unknown }).fileKey ?? "").trim();
  return fileKey || undefined;
}

function uploadThingObjectAlreadyAbsent(error: unknown) {
  const record = error as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown; data?: { status?: unknown; code?: unknown } };
  const status = Number(record?.status ?? record?.statusCode ?? record?.data?.status);
  const code = String(record?.code ?? record?.data?.code ?? "").toLowerCase();
  const message = String(record?.message ?? "");
  return status === 404
    || code === "not_found"
    || code === "not-found"
    || /(?:file|object).*(?:not found|does not exist)|already (?:deleted|gone)/i.test(message);
}

async function deleteUploadThingObject(fileKey: string, receipt?: DocumentSnapshot) {
  if (!fileKey || /^https?:\/\//i.test(fileKey)) {
    lifecycleConflict("chat_attachments", "an attachment cleanup target did not contain a durable UploadThing fileKey.");
  }
  const receiptData = receipt?.data() as AttachmentReceiptData | undefined;
  if (receiptData?.status === "deleted") return false;
  try {
    const deleted = await new UTApi().deleteFiles(fileKey);
    if (!deleted.success) throw new Error("UploadThing did not confirm file deletion.");
    // success + deletedCount=0 is already-clean/idempotent: the object is absent.
    return deleted.deletedCount > 0;
  } catch (error) {
    if (uploadThingObjectAlreadyAbsent(error)) return false;
    if (receipt?.exists) {
      await receipt.ref.set({
        status: "cleanup_failed",
        cleanupAttemptedAt: new Date().toISOString(),
        cleanupError: error instanceof Error ? error.message.slice(0, 500) : "UploadThing cleanup failed.",
      }, { merge: true }).catch(() => undefined);
    }
    throw new BoardSignalAccountDeletionError(
      "ACCOUNT_DELETION_ATTACHMENT_CLEANUP_FAILED",
      "chat_attachments",
      "BoardSignal could not remove an exclusive chat attachment from storage. Access remains fail-closed and the Founder can retry deletion.",
      503,
    );
  }
}

function validateReceiptFileKey(receipt: DocumentSnapshot, fileKey: string) {
  const data = receipt.data() as AttachmentReceiptData | undefined;
  if (!data || String(data.fileKey ?? "") !== fileKey) {
    lifecycleConflict("chat_attachments", `${receipt.ref.path} did not match its attachment fileKey.`);
  }
  return data;
}

function validateSharedFounderCampaignReceipt(data: AttachmentReceiptData, path: string) {
  if (data.uploaderActorType !== "founder" || data.uploaderIdentityKey !== "founder" || data.uploaderUid !== undefined || data.uploaderPlayerId !== undefined) {
    lifecycleConflict("chat_attachments", `${path} claimed founder_campaign but did not belong to the Founder upload identity.`);
  }
}

function receiptOwnedByTarget(data: AttachmentReceiptData, uid: string, playerId: number) {
  const identityKey = `player:${uid}`;
  const uidMatches = data.uploaderUid === uid;
  const playerMatches = Number(data.uploaderPlayerId) === playerId;
  const identityMatches = data.uploaderIdentityKey === identityKey;

  if (uidMatches && data.uploaderPlayerId !== undefined && !playerMatches) {
    lifecycleConflict("chat_attachments", "a player upload receipt matched the deleted uid but carried another stable player ID.");
  }
  if (playerMatches && data.uploaderUid !== undefined && !uidMatches) {
    lifecycleConflict("chat_attachments", "a player upload receipt matched the deleted player ID but carried another uid.");
  }
  if (identityMatches && data.uploaderUid !== undefined && !uidMatches) {
    lifecycleConflict("chat_attachments", "a player upload identity key pointed at another uid.");
  }
  return uidMatches || playerMatches || identityMatches;
}

function receiptTargetsDeletedRecipient(data: AttachmentReceiptData, uid: string) {
  if (data.claimRecipientUid !== uid) return false;
  if (data.claimKind !== "founder_reply" && data.claimKind !== "friend_message") {
    lifecycleConflict("chat_attachments", "a receipt targeted the deleted uid with a non-exclusive claim kind.");
  }
  return true;
}

async function deleteExclusiveReceipt(receipt: QueryDocumentSnapshot, uid: string, playerId: number) {
  const data = receipt.data() as AttachmentReceiptData;
  const fileKey = String(data.fileKey ?? "").trim();
  if (!fileKey) lifecycleConflict("chat_attachments", `${receipt.ref.path} was missing fileKey.`);
  if (data.claimKind === "founder_campaign") {
    lifecycleConflict("chat_attachments", `${receipt.ref.path} was a shared Founder campaign attachment but also matched deleted-player ownership.`);
  }
  const targetOwned = receiptOwnedByTarget(data, uid, playerId);
  const targetRecipient = receiptTargetsDeletedRecipient(data, uid);
  if (!targetOwned && !targetRecipient) {
    lifecycleConflict("chat_attachments", `${receipt.ref.path} was not exclusively owned by the deleted lifecycle.`);
  }
  const fileDeleted = await deleteUploadThingObject(fileKey, receipt);
  await receipt.ref.delete();
  return { receiptDeleted: 1, fileDeleted: fileDeleted ? 1 : 0 };
}

async function scanDeletionOwnedReceipts(
  uid: string,
  playerId: number,
  visitor: (receipt: QueryDocumentSnapshot) => Promise<boolean | void> | boolean | void,
) {
  const db = getAdminDb();
  let afterId: string | undefined;
  while (true) {
    let query: Query = db.collection("chatAttachmentReceipts").orderBy(FieldPath.documentId()).limit(DELETE_CHUNK_SIZE);
    if (afterId) query = query.startAfter(afterId);
    const page = await query.get();
    if (page.empty) return false;
    afterId = page.docs.at(-1)!.id;
    for (const receipt of page.docs) {
      const data = receipt.data() as AttachmentReceiptData;
      if (data.claimKind === "founder_campaign") {
        const falselyTargetsPlayer = data.uploaderUid === uid
          || Number(data.uploaderPlayerId) === playerId
          || data.uploaderIdentityKey === `player:${uid}`
          || data.claimRecipientUid === uid;
        if (falselyTargetsPlayer) {
          lifecycleConflict("chat_attachments", `${receipt.ref.path} was marked as a shared campaign attachment but also targeted the deleted player as its owner.`);
        }
        continue; // Shared campaign file/receipt survives one recipient deletion.
      }
      const targetOwned = receiptOwnedByTarget(data, uid, playerId);
      const targetRecipient = receiptTargetsDeletedRecipient(data, uid);
      if (!targetOwned && !targetRecipient) continue;
      if (await visitor(receipt)) return true;
    }
    if (page.size < DELETE_CHUNK_SIZE) return false;
  }
}

async function deleteResidualDeletionOwnedReceipts(uid: string, playerId: number) {
  const result = emptyAttachmentCleanupResult();
  await scanDeletionOwnedReceipts(uid, playerId, async (receipt) => {
    const deleted = await deleteExclusiveReceipt(receipt, uid, playerId);
    result.attachmentReceiptsDeleted += deleted.receiptDeleted;
    result.attachmentFilesDeleted += deleted.fileDeleted;
  });
  return result;
}

async function hasDeletionOwnedReceipt(uid: string, playerId: number) {
  let found = false;
  await scanDeletionOwnedReceipts(uid, playerId, () => {
    found = true;
    return true;
  });
  return found;
}

async function campaignAttachmentState(campaignId: string | undefined, fileKey: string): Promise<"matches" | "different" | "missing"> {
  if (!campaignId) return "missing";
  const campaign = await getAdminDb().collection("communications").doc(campaignId).get();
  if (!campaign.exists) return "missing";
  return fileKeyFromAttachment(campaign.data()?.attachment) === fileKey ? "matches" : "different";
}

async function cleanFriendMessageAttachments(
  thread: QueryDocumentSnapshot,
  uid: string,
  playerId: number,
  result: AttachmentCleanupResult,
) {
  const db = getAdminDb();
  const threadId = thread.id;
  let afterId: string | undefined;
  while (true) {
    let query: Query = thread.ref.collection("messages").orderBy(FieldPath.documentId()).limit(DELETE_CHUNK_SIZE);
    if (afterId) query = query.startAfter(afterId);
    const page = await query.get();
    if (page.empty) break;
    afterId = page.docs.at(-1)!.id;
    for (const message of page.docs) {
      const fileKey = fileKeyFromAttachment(message.data()?.attachment);
      if (!fileKey) continue;
      const ref = attachmentReceiptRef(fileKey);
      const receipt = await ref.get();
      if (receipt.exists) {
        const data = validateReceiptFileKey(receipt, fileKey);
        if (data.claimKind !== "friend_message" || data.claimThreadId !== threadId) {
          lifecycleConflict("chat_attachments", `${message.ref.path} pointed at an attachment receipt owned by another chat lifecycle.`);
        }
        const targetOwned = receiptOwnedByTarget(data, uid, playerId);
        const targetRecipient = receiptTargetsDeletedRecipient(data, uid);
        if (!targetOwned && !targetRecipient) {
          lifecycleConflict("chat_attachments", `${message.ref.path} did not bind its friend attachment to the deleted participant.`);
        }
      }
      const fileDeleted = await deleteUploadThingObject(fileKey, receipt.exists ? receipt : undefined);
      if (receipt.exists) {
        await receipt.ref.delete();
        result.attachmentReceiptsDeleted += 1;
      }
      if (fileDeleted) result.attachmentFilesDeleted += 1;
    }
    if (page.size < DELETE_CHUNK_SIZE) break;
  }
}

async function cleanPrivateConversationAttachments(uid: string, playerId: number, result: AttachmentCleanupResult) {
  const db = getAdminDb();
  const conversations = db.collection("users").doc(uid).collection("conversations");
  let afterThreadId: string | undefined;
  while (true) {
    let threadQuery: Query = conversations.orderBy(FieldPath.documentId()).limit(DELETE_CHUNK_SIZE);
    if (afterThreadId) threadQuery = threadQuery.startAfter(afterThreadId);
    const threads = await threadQuery.get();
    if (threads.empty) break;
    afterThreadId = threads.docs.at(-1)!.id;

    for (const thread of threads.docs) {
      let afterMessageId: string | undefined;
      while (true) {
        let messageQuery: Query = thread.ref.collection("messages").orderBy(FieldPath.documentId()).limit(DELETE_CHUNK_SIZE);
        if (afterMessageId) messageQuery = messageQuery.startAfter(afterMessageId);
        const messages = await messageQuery.get();
        if (messages.empty) break;
        afterMessageId = messages.docs.at(-1)!.id;

        for (const message of messages.docs) {
          const data = message.data() as { senderType?: string; campaignId?: string; attachment?: unknown };
          const fileKey = fileKeyFromAttachment(data.attachment);
          if (!fileKey) continue;
          const ref = attachmentReceiptRef(fileKey);
          const receipt = await ref.get();
          const receiptData = receipt.exists ? validateReceiptFileKey(receipt, fileKey) : undefined;

          if (receiptData?.claimKind === "founder_campaign") {
            validateSharedFounderCampaignReceipt(receiptData, receipt.ref.path);
            result.sharedCampaignAttachmentsPreserved += 1;
            continue;
          }
          const campaignState = !receiptData && data.senderType === "founder" && data.campaignId
            ? await campaignAttachmentState(data.campaignId, fileKey)
            : undefined;
          if (!receiptData && campaignState === "matches") {
            // A previous retry may already have removed a receipt, while the shared
            // campaign itself remains the durable owner. Never delete that file here.
            result.sharedCampaignAttachmentsPreserved += 1;
            continue;
          }

          if (receiptData?.claimKind === "founder_reply") {
            if (receiptData.claimThreadId !== thread.id || receiptData.claimRecipientUid !== uid || receiptData.uploaderActorType !== "founder") {
              lifecycleConflict("chat_attachments", `${receipt.ref.path} did not match the deleted player's Founder reply thread.`);
            }
          } else if (receiptData?.claimKind === "player_reply") {
            if (receiptData.claimThreadId !== thread.id || !receiptOwnedByTarget(receiptData, uid, playerId)) {
              lifecycleConflict("chat_attachments", `${receipt.ref.path} did not match the deleted player's reply thread.`);
            }
          } else if (receiptData) {
            lifecycleConflict("chat_attachments", `${receipt.ref.path} used an unexpected claim kind inside the deleted player's Founder conversation.`);
          } else if (data.senderType !== "player" && data.senderType !== "founder") {
            lifecycleConflict("chat_attachments", `${message.ref.path} had an attachment without a safe deletion ownership proof.`);
          } else if (data.senderType === "founder" && data.campaignId && campaignState === "missing") {
            // If the campaign record is missing we cannot safely decide whether a
            // receipt-less Founder attachment was shared or exclusive. If the campaign
            // exists but owns a different fileKey, this message is safely an exclusive
            // Founder reply from an earlier cleanup attempt and can be retried.
            lifecycleConflict("chat_attachments", `${message.ref.path} lost the receipt needed to distinguish a campaign attachment from a Founder reply.`);
          }

          const fileDeleted = await deleteUploadThingObject(fileKey, receipt.exists ? receipt : undefined);
          if (receipt.exists) {
            await receipt.ref.delete();
            result.attachmentReceiptsDeleted += 1;
          }
          if (fileDeleted) result.attachmentFilesDeleted += 1;
        }
        if (messages.size < DELETE_CHUNK_SIZE) break;
      }
    }
    if (threads.size < DELETE_CHUNK_SIZE) break;
  }
}

async function cleanDeletionAttachments(uid: string, playerId: number, friendThreads: QueryDocumentSnapshot[]) {
  const result = emptyAttachmentCleanupResult();
  for (const thread of friendThreads) await cleanFriendMessageAttachments(thread, uid, playerId, result);
  await cleanPrivateConversationAttachments(uid, playerId, result);
  const residual = await deleteResidualDeletionOwnedReceipts(uid, playerId);
  result.attachmentReceiptsDeleted += residual.attachmentReceiptsDeleted;
  result.attachmentFilesDeleted += residual.attachmentFilesDeleted;
  result.sharedCampaignAttachmentsPreserved += residual.sharedCampaignAttachmentsPreserved;
  return result;
}

async function deleteFriendConversationTrees(threads: QueryDocumentSnapshot[]) {
  const db = getAdminDb();
  let friendThreadsDeleted = 0;
  let friendMessagesDeleted = 0;
  for (const thread of threads) {
    // Messages go first; the parent thread is deleted last. A mid-stage retry can
    // therefore always rediscover any thread whose descendants still need cleanup.
    while (true) {
      const messages = await thread.ref.collection("messages").limit(DELETE_CHUNK_SIZE).get();
      if (messages.empty) break;
      const batch = db.batch();
      messages.docs.forEach((message) => batch.delete(message.ref));
      await batch.commit();
      friendMessagesDeleted += messages.size;
    }
    const latest = await thread.ref.get();
    if (latest.exists) {
      await latest.ref.delete();
      friendThreadsDeleted += 1;
    }
  }
  return { friendThreadsDeleted, friendMessagesDeleted };
}

async function deletePublicReferences(playerId: number) {
  const db = getAdminDb();
  const stablePlayerKey = String(playerId);
  let deleted = 0;

  const shareMoments = await queryDocuments(db.collection("publicShareMoments").where("playerId", "==", stablePlayerKey));
  for (const moment of shareMoments) {
    deleted += await deleteQueryInChunks(
      db.collection("shareAttribution").where("shareMomentId", "==", moment.id),
      (document) => validateStableField(document, "shareMomentId", moment.id),
    );
  }
  deleted += await deleteDocumentsInChunks(shareMoments);

  deleted += await deleteQueryInChunks(
    db.collection("publicUniverseEvents").where("playerId", "==", stablePlayerKey),
    (document) => validateStableField(document, "playerId", stablePlayerKey),
  );
  deleted += await deleteQueryInChunks(
    db.collection("publicCoverage").where("chessPlayerId", "==", stablePlayerKey),
    (document) => validateStableField(document, "chessPlayerId", stablePlayerKey),
  );

  const publicPlayerRef = db.collection("publicPlayers").doc(stablePlayerKey);
  const directPublicPlayer = await publicPlayerRef.get();
  if (directPublicPlayer.exists) {
    const storedId = directPublicPlayer.data()?.chessPlayerId;
    if (storedId !== undefined && String(storedId) !== stablePlayerKey) identityConflict(`${publicPlayerRef.path} belonged to another stable player.`);
    await publicPlayerRef.delete();
    deleted += 1;
  }
  deleted += await deleteQueryInChunks(
    db.collection("publicPlayers").where("chessPlayerId", "==", stablePlayerKey),
    (document) => validateStableField(document, "chessPlayerId", stablePlayerKey),
  );
  return deleted;
}

async function deleteTemporaryCredentials(uid: string, playerId: number) {
  const db = getAdminDb();
  let deleted = 0;
  deleted += await deleteQueryInChunks(
    db.collection("authCompletionTickets").where("uid", "==", uid),
    (document) => {
      validateStableField(document, "uid", uid);
      const ticketPlayerId = Number(document.data()?.identity?.playerId);
      if (Number.isSafeInteger(ticketPlayerId) && ticketPlayerId !== playerId) identityConflict(`${document.ref.path} carried a different Chess.com player ID.`);
    },
  );
  deleted += await deleteQueryInChunks(
    db.collection("exceptions").where("uid", "==", uid),
    (document) => validateStableField(document, "uid", uid),
  );
  return deleted;
}

async function deleteIdentityAliases(uid: string, playerId: number) {
  const db = getAdminDb();
  let deleted = 0;
  deleted += await deleteQueryInChunks(
    db.collection("playerIdentityAliases").where("uid", "==", uid),
    (document) => {
      validateStableField(document, "uid", uid);
      const aliasPlayerId = Number(document.data()?.playerId);
      if (Number.isSafeInteger(aliasPlayerId) && aliasPlayerId !== playerId) identityConflict(`${document.ref.path} carried a different Chess.com player ID.`);
    },
  );
  deleted += await deleteQueryInChunks(
    db.collection("playerIdentityAliases").where("playerId", "==", playerId),
    (document) => {
      validateStableField(document, "playerId", playerId);
      const aliasUid = document.data()?.uid;
      if (aliasUid !== undefined && String(aliasUid) !== uid) identityConflict(`${document.ref.path} pointed to another BoardSignal uid.`);
    },
  );
  return deleted;
}

async function hasSecondaryLifecycle(input: { uid: string; playerId: number }) {
  const db = getAdminDb();
  const stablePlayerKey = String(input.playerId);
  const directResiduals = await Promise.all([
    db.collection("authCompletionTickets").where("uid", "==", input.uid).limit(1).get(),
    db.collection("exceptions").where("uid", "==", input.uid).limit(1).get(),
    db.collection("publicCoverage").where("chessPlayerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("publicPlayers").where("chessPlayerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("publicUniverseEvents").where("playerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("publicShareMoments").where("playerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("socialRelationships").where("playerAId", "==", input.playerId).limit(1).get(),
    db.collection("socialRelationships").where("playerBId", "==", input.playerId).limit(1).get(),
    db.collection("socialBlocks").where("blockerPlayerId", "==", input.playerId).limit(1).get(),
    db.collection("socialBlocks").where("blockedPlayerId", "==", input.playerId).limit(1).get(),
    db.collection("socialRequestRateLimits").where("actorPlayerId", "==", input.playerId).limit(1).get(),
    db.collection("socialRequestRateLimits").where("targetPlayerId", "==", input.playerId).limit(1).get(),
  ]);
  if (directResiduals.some((snapshot) => !snapshot.empty)) return true;
  if (await hasSocialProjection(input.playerId)) return true;
  if ((await findFriendConversations(input.playerId, input.uid)).length) return true;
  if (await hasDeletionOwnedReceipt(input.uid, input.playerId)) return true;
  return false;
}

async function assertResetComplete(input: { uid: string; playerId: number }) {
  const db = getAdminDb();
  const stablePlayerKey = String(input.playerId);
  const [
    user,
    mapping,
    betaAccess,
    betaRequest,
    aliasesByUid,
    aliasesByPlayer,
    tickets,
    exceptions,
    publicPlayer,
    publicPlayersById,
    publicCoverage,
    publicEvents,
    publicMoments,
    relationshipsA,
    relationshipsB,
    blocksA,
    blocksB,
    rateA,
    rateB,
    authUser,
  ] = await Promise.all([
    db.collection("users").doc(input.uid).get(),
    db.collection("chessPlayerAccounts").doc(stablePlayerKey).get(),
    db.collection("betaAccess").doc(stablePlayerKey).get(),
    db.collection("betaRequests").doc(stablePlayerKey).get(),
    db.collection("playerIdentityAliases").where("uid", "==", input.uid).limit(1).get(),
    db.collection("playerIdentityAliases").where("playerId", "==", input.playerId).limit(1).get(),
    db.collection("authCompletionTickets").where("uid", "==", input.uid).limit(1).get(),
    db.collection("exceptions").where("uid", "==", input.uid).limit(1).get(),
    db.collection("publicPlayers").doc(stablePlayerKey).get(),
    db.collection("publicPlayers").where("chessPlayerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("publicCoverage").where("chessPlayerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("publicUniverseEvents").where("playerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("publicShareMoments").where("playerId", "==", stablePlayerKey).limit(1).get(),
    db.collection("socialRelationships").where("playerAId", "==", input.playerId).limit(1).get(),
    db.collection("socialRelationships").where("playerBId", "==", input.playerId).limit(1).get(),
    db.collection("socialBlocks").where("blockerPlayerId", "==", input.playerId).limit(1).get(),
    db.collection("socialBlocks").where("blockedPlayerId", "==", input.playerId).limit(1).get(),
    db.collection("socialRequestRateLimits").where("actorPlayerId", "==", input.playerId).limit(1).get(),
    db.collection("socialRequestRateLimits").where("targetPlayerId", "==", input.playerId).limit(1).get(),
    existingAuthUser(input.uid),
  ]);
  const [socialProjection, friendThreads, attachmentReceipt] = await Promise.all([
    hasSocialProjection(input.playerId),
    findFriendConversations(input.playerId, input.uid),
    hasDeletionOwnedReceipt(input.uid, input.playerId),
  ]);
  const resetIncomplete = user.exists
    || mapping.exists
    || betaAccess.exists
    || betaRequest.exists
    || !aliasesByUid.empty
    || !aliasesByPlayer.empty
    || !tickets.empty
    || !exceptions.empty
    || publicPlayer.exists
    || !publicPlayersById.empty
    || !publicCoverage.empty
    || !publicEvents.empty
    || !publicMoments.empty
    || !relationshipsA.empty
    || !relationshipsB.empty
    || !blocksA.empty
    || !blocksB.empty
    || !rateA.empty
    || !rateB.empty
    || socialProjection
    || friendThreads.length > 0
    || attachmentReceipt
    || Boolean(authUser);
  if (resetIncomplete) {
    throw new BoardSignalAccountDeletionError(
      "ACCOUNT_DELETION_VERIFICATION_FAILED",
      "verify_reset",
      "BoardSignal could not verify a complete identity reset. The destructive operation can be retried safely.",
      500,
    );
  }
}

export async function deleteBoardSignalAccount(input: { playerId: unknown; confirmationUsername: unknown }): Promise<BoardSignalAccountDeletionSummary> {
  const playerId = stablePlayerId(input.playerId);
  const confirmationUsername = normalizedConfirmation(input.confirmationUsername);
  const stablePlayerKey = String(playerId);
  const uid = firebaseUidForChessPlayer(playerId);
  const db = getAdminDb();
  const auth = getAdminAuth();
  let stage: DeletionStage = "resolve_target";

  try {
    const mappingRef = db.collection("chessPlayerAccounts").doc(stablePlayerKey);
    const userRef = db.collection("users").doc(uid);
    const betaAccessRef = db.collection("betaAccess").doc(stablePlayerKey);
    const betaRequestRef = db.collection("betaRequests").doc(stablePlayerKey);
    const publicPlayerRef = db.collection("publicPlayers").doc(stablePlayerKey);
    const [mapping, userSnapshot, betaAccess, betaRequest, publicPlayer, aliasesByUid, aliasesByPlayer, authUser] = await Promise.all([
      mappingRef.get(),
      userRef.get(),
      betaAccessRef.get(),
      betaRequestRef.get(),
      publicPlayerRef.get(),
      db.collection("playerIdentityAliases").where("uid", "==", uid).get(),
      db.collection("playerIdentityAliases").where("playerId", "==", playerId).get(),
      existingAuthUser(uid),
    ]);

    if (mapping.exists) {
      const mappedUid = String(mapping.data()?.uid ?? "");
      const mappedPlayerId = Number(mapping.data()?.playerId ?? playerId);
      if (mappedUid !== uid || mappedPlayerId !== playerId) identityConflict(`${mappingRef.path} did not match ${uid}.`);
    }
    if (betaAccess.exists && Number(betaAccess.data()?.playerId) !== playerId) identityConflict(`${betaAccessRef.path} belonged to another player.`);
    if (betaRequest.exists && Number(betaRequest.data()?.chessPlayerId) !== playerId) identityConflict(`${betaRequestRef.path} belonged to another player.`);
    if (betaRequest.exists) {
      const request = betaRequest.data() as Record<string, unknown>;
      const magic = request.magicAccess as Record<string, unknown> | undefined;
      for (const candidateUid of [request.firebaseUid, magic?.uid]) {
        if (candidateUid !== undefined && String(candidateUid) !== uid) identityConflict(`${betaRequestRef.path} pointed to another BoardSignal uid.`);
      }
    }
    for (const alias of [...aliasesByUid.docs, ...aliasesByPlayer.docs]) {
      const aliasUid = alias.data()?.uid;
      const aliasPlayerId = Number(alias.data()?.playerId);
      if (aliasUid !== undefined && String(aliasUid) !== uid) identityConflict(`${alias.ref.path} pointed to another BoardSignal uid.`);
      if (Number.isSafeInteger(aliasPlayerId) && aliasPlayerId !== playerId) identityConflict(`${alias.ref.path} carried another Chess.com player ID.`);
    }
    if (publicPlayer.exists) {
      const publicPlayerId = publicPlayer.data()?.chessPlayerId;
      if (publicPlayerId !== undefined && String(publicPlayerId) !== stablePlayerKey) identityConflict(`${publicPlayerRef.path} belonged to another stable player.`);
    }
    if (authUser) {
      if (authUser.uid !== uid) identityConflict("Firebase Auth uid did not match the deterministic Chess.com identity.");
      const claimedPlayerId = Number(authUser.customClaims?.chessPlayerId);
      if (Number.isSafeInteger(claimedPlayerId) && claimedPlayerId !== playerId) identityConflict("Firebase Auth custom claims carried a different Chess.com player ID.");
      const claimedRole = authUser.customClaims?.role;
      if (claimedRole !== undefined && claimedRole !== "player") identityConflict("Firebase Auth custom claims did not identify a player account.");
    }

    const account = userSnapshot.exists ? userSnapshot.data() as BoardSignalAccount : undefined;
    if (account) {
      if (account.role !== "player") {
        throw new BoardSignalAccountDeletionError("ACCOUNT_DELETION_PLAYER_ONLY", "resolve_target", "Only BoardSignal player accounts can be deleted from this Founder action.", 403);
      }
      if (account.uid !== uid || account.chessCom?.playerId !== playerId) identityConflict(`${userRef.path} did not match the requested stable Chess.com identity.`);
    }

    // Historical alias document IDs are intentionally NOT canonical authority.
    // A stable Chess.com player can legitimately accumulate old username aliases
    // that all point to this same uid/playerId. Those aliases were validated above
    // only as identity bindings and are deleted later as historical lifecycle data.
    const authoritativeCanonicalCandidates = [
      account?.chessCom?.canonicalUsername,
      mapping.data()?.canonicalUsername,
      betaAccess.data()?.canonicalUsername,
      betaRequest.data()?.canonicalUsername,
      publicPlayer.data()?.username,
      authUser?.customClaims?.chessUsername,
    ].map((value) => typeof value === "string" ? value.trim() : "").filter(Boolean);
    const distinctCanonical = new Map(authoritativeCanonicalCandidates.map((value) => [value.toLowerCase(), value]));
    if (distinctCanonical.size > 1) identityConflict("authoritative canonical username records disagree for this stable Chess.com player ID.");
    const canonicalUsername = [...distinctCanonical.values()][0];

    // E.3: do not declare a partially deleted lifecycle complete merely because
    // its primary account/mapping/Auth anchors are already absent. Secondary
    // social/public/chat/receipt state is part of the deletion-owned lifecycle.
    const secondaryLifecycle = await hasSecondaryLifecycle({ uid, playerId });
    const hasKnownLifecycle = Boolean(account || mapping.exists || betaAccess.exists || betaRequest.exists || publicPlayer.exists || !aliasesByUid.empty || !aliasesByPlayer.empty || authUser || secondaryLifecycle);
    if (!hasKnownLifecycle) {
      return {
        playerId,
        canonicalUsername: confirmationUsername,
        alreadyDeleted: true,
        firebaseSessionsRevoked: false,
        firebaseAuthDeleted: false,
        accountDeleted: false,
        identityMappingsDeleted: 0,
        betaAccessDeleted: false,
        betaRequestDeleted: false,
        desksDeleted: 0,
        deskEvidenceDeleted: 0,
        factualReviewsDeleted: 0,
        privateSubcollectionsDeleted: [...PRIVATE_PLAYER_SUBCOLLECTIONS],
        socialReferencesDeleted: 0,
        publicReferencesDeleted: 0,
        temporaryCredentialsDeleted: 0,
        friendThreadsDeleted: 0,
        friendMessagesDeleted: 0,
        attachmentReceiptsDeleted: 0,
        attachmentFilesDeleted: 0,
        sharedCampaignAttachmentsPreserved: 0,
      };
    }
    if (!canonicalUsername || !sameUsername(confirmationUsername, canonicalUsername)) {
      throw new BoardSignalAccountDeletionError("ACCOUNT_DELETION_CONFIRMATION_MISMATCH", "resolve_target", "The typed Chess.com username did not match this BoardSignal player.", 400);
    }

    stage = "fail_closed";
    const deletionStartedAt = new Date().toISOString();
    if (account) await userRef.set({ accessStatus: "deleted", identityStatus: "revoked", identityReviewStatus: "rejected", deletionStartedAt }, { merge: true });
    if (betaAccess.exists) await betaAccessRef.set({ status: "revoked", failedAttempts: 0, lockedUntil: null }, { merge: true });
    if (betaRequest.exists) await betaRequestRef.set({ identityReviewStatus: "rejected", revokedAt: deletionStartedAt, deletionStartedAt }, { merge: true });
    if (publicPlayer.exists) await publicPlayerRef.set({ pageEnabled: false }, { merge: true });

    stage = "revoke_sessions";
    let firebaseSessionsRevoked = false;
    if (authUser) {
      await auth.updateUser(uid, { disabled: true });
      await auth.revokeRefreshTokens(uid);
      firebaseSessionsRevoked = true;
    }

    // Discover shared friend threads while their durable participant fields still
    // exist. A partially completed A.2 deletion can have no private user tree here.
    const friendThreads = await findFriendConversations(playerId, uid);

    stage = "chat_attachments";
    const attachmentResult = await cleanDeletionAttachments(uid, playerId, friendThreads);

    stage = "friend_conversations";
    const friendResult = await deleteFriendConversationTrees(friendThreads);

    stage = "private_player_tree";
    const privateResult = await deletePrivatePlayerTree(uid);

    stage = "social_references";
    const socialReferencesDeleted = await deleteSocialReferences(playerId, uid);

    stage = "public_references";
    const publicReferencesDeleted = await deletePublicReferences(playerId);

    stage = "temporary_credentials";
    const temporaryCredentialsDeleted = await deleteTemporaryCredentials(uid, playerId);
    const betaAccessDeleted = (await betaAccessRef.get()).exists;
    if (betaAccessDeleted) await betaAccessRef.delete();
    const betaRequestDeleted = (await betaRequestRef.get()).exists;
    if (betaRequestDeleted) await betaRequestRef.delete();

    stage = "firebase_auth";
    let firebaseAuthDeleted = false;
    try {
      await auth.deleteUser(uid);
      firebaseAuthDeleted = true;
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }

    stage = "identity_mappings";
    let identityMappingsDeleted = await deleteIdentityAliases(uid, playerId);
    const mappingNow = await mappingRef.get();
    if (mappingNow.exists) {
      const mappedUid = String(mappingNow.data()?.uid ?? "");
      if (mappedUid !== uid) identityConflict(`${mappingRef.path} changed to another uid during deletion.`);
      await mappingRef.delete();
      identityMappingsDeleted += 1;
    }

    stage = "account_document";
    const accountNow = await userRef.get();
    if (accountNow.exists) {
      const latestAccount = accountNow.data() as BoardSignalAccount;
      if (latestAccount.role !== "player" || latestAccount.uid !== uid || latestAccount.chessCom?.playerId !== playerId) {
        identityConflict(`${userRef.path} changed identity during deletion.`);
      }
      await userRef.delete();
    }

    stage = "verify_reset";
    await assertResetComplete({ uid, playerId });

    return {
      playerId,
      canonicalUsername,
      alreadyDeleted: false,
      firebaseSessionsRevoked,
      firebaseAuthDeleted,
      accountDeleted: true,
      identityMappingsDeleted,
      betaAccessDeleted,
      betaRequestDeleted,
      ...privateResult,
      socialReferencesDeleted,
      publicReferencesDeleted,
      temporaryCredentialsDeleted,
      ...friendResult,
      ...attachmentResult,
    };
  } catch (error) {
    if (error instanceof BoardSignalAccountDeletionError) throw error;
    throw new BoardSignalAccountDeletionError(
      "ACCOUNT_DELETION_FAILED",
      stage,
      "BoardSignal account deletion did not complete. Access remains fail-closed and the Founder can retry the operation.",
      500,
    );
  }
}
