import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { UTApi } from "uploadthing/server";
import type { BoardSignalAccount } from "../account";
import {
  attachmentKindForMimeType,
  validateBoardSignalChatAttachment,
  type BoardSignalChatAttachment,
  type BoardSignalChatAttachmentView,
} from "../chatAttachments";
import { getAdminDb } from "../../../utils/firebaseAdmin";
import { requireFounderBasicAuth } from "./founderAuth";
import { accountForToken, requirePlayerToken } from "./persistence";

export type BoardSignalChatUploadActor =
  | { actorType: "founder"; identityKey: "founder" }
  | { actorType: "player"; identityKey: string; uid: string; playerId: number };

export type BoardSignalAttachmentClaim = {
  kind: "founder_campaign" | "founder_reply" | "player_reply" | "friend_message";
  id: string;
  threadId?: string;
  recipientUid?: string;
};

type UploadReceiptRecord = BoardSignalChatAttachment & {
  uploaderActorType: BoardSignalChatUploadActor["actorType"];
  uploaderIdentityKey: string;
  uploaderUid?: string;
  uploaderPlayerId?: number;
  uploadSessionId: string;
  storageViewUrl?: string;
  createdAt: string;
  status: "uploaded" | "claimed" | "deleted" | "cleanup_failed";
  claimedAt?: string;
  claimKind?: BoardSignalAttachmentClaim["kind"];
  claimId?: string;
  claimThreadId?: string;
  claimRecipientUid?: string;
  cleanupAttemptedAt?: string;
  cleanupError?: string;
};

function receiptId(fileKey: string) {
  return createHash("sha256").update(fileKey).digest("hex");
}

function receiptRef(fileKey: string) {
  return getAdminDb().collection("chatAttachmentReceipts").doc(receiptId(fileKey));
}

function actorForPlayer(account: BoardSignalAccount): BoardSignalChatUploadActor {
  return {
    actorType: "player",
    identityKey: `player:${account.uid}`,
    uid: account.uid,
    playerId: account.chessCom.playerId,
  };
}

export function founderChatUploadActor(): BoardSignalChatUploadActor {
  return { actorType: "founder", identityKey: "founder" };
}

export function playerChatUploadActor(account: BoardSignalAccount): BoardSignalChatUploadActor {
  return actorForPlayer(account);
}

export async function resolveBoardSignalChatUploadActor(request: Request): Promise<BoardSignalChatUploadActor> {
  const authorization = request.headers.get("authorization") ?? "";
  if (/^Bearer\s+/i.test(authorization)) {
    const token = await requirePlayerToken(request);
    const account = await accountForToken(token);
    if (account.accessStatus !== "active") throw Object.assign(new Error("BoardSignal account access is not active."), { status: 403 });
    return actorForPlayer(account);
  }
  if (/^Basic\s+/i.test(authorization)) {
    requireFounderBasicAuth(request);
    return founderChatUploadActor();
  }
  throw Object.assign(new Error("BoardSignal chat uploads require an authenticated player or Founder."), { status: 401 });
}

export function createChatUploadSessionId() {
  return randomUUID();
}

export async function recordBoardSignalChatAttachmentUpload(
  actor: BoardSignalChatUploadActor,
  uploadSessionId: string,
  file: { key: string; name: string; size: number; type?: string; ufsUrl?: string; url?: string },
) {
  const mimeType = String(file.type ?? "").trim().toLowerCase();
  const kind = attachmentKindForMimeType(mimeType);
  if (!kind) throw Object.assign(new Error("Only non-SVG images and PDFs can be attached to BoardSignal messages."), { status: 400 });
  const attachment = validateBoardSignalChatAttachment({
    kind,
    fileKey: file.key,
    name: file.name,
    mimeType,
    size: file.size,
  });
  const now = new Date().toISOString();
  const storageViewUrl = String(file.ufsUrl ?? file.url ?? "").trim() || undefined;
  const receipt: UploadReceiptRecord = {
    ...attachment,
    uploaderActorType: actor.actorType,
    uploaderIdentityKey: actor.identityKey,
    ...(actor.actorType === "player" ? { uploaderUid: actor.uid, uploaderPlayerId: actor.playerId } : {}),
    uploadSessionId,
    ...(storageViewUrl ? { storageViewUrl } : {}),
    createdAt: now,
    status: "uploaded",
  };
  try {
    await receiptRef(attachment.fileKey).set(receipt, { merge: false });
  } catch (reason) {
    // UploadThing has already accepted the bytes at this point. If the ownership receipt
    // cannot be made durable, best-effort remove the file so it cannot become a permanent
    // unclaimable orphan. Receipt persistence remains the authority for message claims.
    await deleteStoredFile(attachment.fileKey).catch(() => undefined);
    throw reason;
  }
  return { attachment, viewUrl: storageViewUrl };
}

function assertReceiptMatches(
  receipt: UploadReceiptRecord | undefined,
  attachment: BoardSignalChatAttachment,
  actor: BoardSignalChatUploadActor,
  allowedClaim?: BoardSignalAttachmentClaim,
) {
  if (!receipt || receipt.fileKey !== attachment.fileKey) throw Object.assign(new Error("That attachment was not uploaded through BoardSignal chat."), { status: 400 });
  if (receipt.uploaderIdentityKey !== actor.identityKey || receipt.uploaderActorType !== actor.actorType) {
    throw Object.assign(new Error("That attachment belongs to a different BoardSignal sender."), { status: 403 });
  }
  if (
    receipt.kind !== attachment.kind
    || receipt.name !== attachment.name
    || receipt.mimeType !== attachment.mimeType
    || receipt.size !== attachment.size
  ) {
    throw Object.assign(new Error("Attachment metadata does not match the completed BoardSignal upload."), { status: 400 });
  }
  if (receipt.status === "deleted" || receipt.status === "cleanup_failed") {
    throw Object.assign(new Error("That uploaded attachment is no longer available to send."), { status: 409 });
  }
  if (receipt.status === "claimed") {
    const sameClaim = Boolean(allowedClaim && receipt.claimId === allowedClaim.id && receipt.claimKind === allowedClaim.kind);
    if (!sameClaim) throw Object.assign(new Error("That attachment has already been used in another message."), { status: 409 });
  }
}

export async function validateChatAttachmentOwnership(
  input: unknown,
  actor: BoardSignalChatUploadActor,
  allowedClaim?: BoardSignalAttachmentClaim,
) {
  const attachment = validateBoardSignalChatAttachment(input);
  const snapshot = await receiptRef(attachment.fileKey).get();
  assertReceiptMatches(snapshot.data() as UploadReceiptRecord | undefined, attachment, actor, allowedClaim);
  return attachment;
}

export async function claimBoardSignalChatAttachment(
  input: unknown,
  actor: BoardSignalChatUploadActor,
  claim: BoardSignalAttachmentClaim,
): Promise<BoardSignalChatAttachment> {
  const attachment = validateBoardSignalChatAttachment(input);
  const ref = receiptRef(attachment.fileKey);
  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const receipt = snapshot.data() as UploadReceiptRecord | undefined;
    assertReceiptMatches(receipt, attachment, actor, claim);
    if (receipt?.status === "claimed") return;
    transaction.set(ref, {
      status: "claimed",
      claimedAt: new Date().toISOString(),
      claimKind: claim.kind,
      claimId: claim.id,
      ...(claim.threadId ? { claimThreadId: claim.threadId } : {}),
      ...(claim.recipientUid ? { claimRecipientUid: claim.recipientUid } : {}),
    }, { merge: true });
  });
  return attachment;
}

export async function hydrateBoardSignalChatAttachment(
  attachmentInput: BoardSignalChatAttachment | undefined,
): Promise<BoardSignalChatAttachmentView | undefined> {
  if (!attachmentInput) return undefined;
  const attachment = validateBoardSignalChatAttachment(attachmentInput);
  const snapshot = await receiptRef(attachment.fileKey).get();
  const receipt = snapshot.data() as UploadReceiptRecord | undefined;
  if (!receipt || receipt.status === "deleted" || receipt.fileKey !== attachment.fileKey) return attachment;
  return receipt.storageViewUrl ? { ...attachment, viewUrl: receipt.storageViewUrl } : attachment;
}

async function deleteStoredFile(fileKey: string) {
  const utapi = new UTApi();
  await utapi.deleteFiles(fileKey);
}

async function bestEffortDeleteReceiptFile(ref: ReturnType<typeof receiptRef>, receipt: UploadReceiptRecord) {
  const attemptedAt = new Date().toISOString();
  try {
    await deleteStoredFile(receipt.fileKey);
    await ref.set({ status: "deleted", cleanupAttemptedAt: attemptedAt, cleanupError: "" }, { merge: true });
    return true;
  } catch (reason) {
    await ref.set({
      status: "cleanup_failed",
      cleanupAttemptedAt: attemptedAt,
      cleanupError: reason instanceof Error ? reason.message.slice(0, 500) : "UploadThing cleanup failed.",
    }, { merge: true }).catch(() => undefined);
    return false;
  }
}

export async function discardUnclaimedChatAttachment(actor: BoardSignalChatUploadActor, fileKeyInput: unknown) {
  const fileKey = String(fileKeyInput ?? "").trim();
  if (!fileKey) throw Object.assign(new Error("Attachment file key is required."), { status: 400 });
  const ref = receiptRef(fileKey);
  const snapshot = await ref.get();
  const receipt = snapshot.data() as UploadReceiptRecord | undefined;
  if (!receipt) return { discarded: true, alreadyGone: true };
  if (receipt.uploaderIdentityKey !== actor.identityKey) throw Object.assign(new Error("That attachment belongs to a different sender."), { status: 403 });
  if (receipt.status === "claimed") throw Object.assign(new Error("A sent attachment cannot be removed from its message."), { status: 409 });
  if (receipt.status === "deleted") return { discarded: true, alreadyGone: true };
  return { discarded: await bestEffortDeleteReceiptFile(ref, receipt) };
}

export async function cleanupClaimedAttachmentAfterFailedMessage(
  actor: BoardSignalChatUploadActor,
  attachment: BoardSignalChatAttachment | undefined,
  claim: BoardSignalAttachmentClaim,
) {
  if (!attachment) return false;
  const ref = receiptRef(attachment.fileKey);
  const snapshot = await ref.get();
  const receipt = snapshot.data() as UploadReceiptRecord | undefined;
  if (!receipt || receipt.uploaderIdentityKey !== actor.identityKey) return false;
  if (receipt.status !== "claimed" || receipt.claimId !== claim.id || receipt.claimKind !== claim.kind) return false;
  return bestEffortDeleteReceiptFile(ref, receipt);
}
