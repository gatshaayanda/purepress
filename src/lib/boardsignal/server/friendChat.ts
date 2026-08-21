import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { BoardSignalAccount } from "../account";
import { firebaseUidForChessPlayer } from "../account";
import {
  normalizeChatMessageBody,
  requireChatMessageContent,
  validateBoardSignalChatAttachment,
  type BoardSignalChatAttachment,
} from "../chatAttachments";
import type { BoardSignalFriendConversationView, BoardSignalFriendMessage } from "../friendChat";
import { canonicalSocialRelationshipId } from "../social";
import { getAdminDb } from "../../../utils/firebaseAdmin";
import { accountForToken } from "./persistence";
import {
  claimBoardSignalChatAttachment,
  cleanupClaimedAttachmentAfterFailedMessage,
  hydrateBoardSignalChatAttachment,
  playerChatUploadActor,
  type BoardSignalAttachmentClaim,
} from "./chatAttachments";

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function playerId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw Object.assign(new Error("A valid BoardSignal player is required."), { status: 400 });
  return parsed;
}

function blockId(blocker: number, blocked: number) {
  return `${blocker}_${blocked}`;
}

function stableMessageId(scope: string, input: unknown) {
  const clientId = String(input ?? "").trim();
  if (!clientId) return randomUUID();
  if (clientId.length > 160) throw Object.assign(new Error("Message request ID is invalid."), { status: 400 });
  return `msg_${createHash("sha256").update(`${scope}:${clientId}`).digest("hex").slice(0, 40)}`;
}

async function accountByPlayerId(targetPlayerId: number) {
  const db = getAdminDb();
  const mapping = await db.collection("chessPlayerAccounts").doc(String(targetPlayerId)).get();
  const uid = String(mapping.data()?.uid ?? firebaseUidForChessPlayer(targetPlayerId));
  const snapshot = await db.collection("users").doc(uid).get();
  if (!snapshot.exists) throw Object.assign(new Error("That BoardSignal player is not available."), { status: 404 });
  const account = snapshot.data() as BoardSignalAccount;
  if (account.role !== "player" || account.accessStatus !== "active" || account.chessCom.playerId !== targetPlayerId) {
    throw Object.assign(new Error("That BoardSignal player is not available."), { status: 404 });
  }
  return account;
}

function friendshipRefs(left: BoardSignalAccount, right: BoardSignalAccount) {
  const db = getAdminDb();
  const relationshipId = canonicalSocialRelationshipId(left.chessCom.playerId, right.chessCom.playerId);
  return {
    relationshipId,
    relationship: db.collection("socialRelationships").doc(relationshipId),
    leftBlocksRight: db.collection("socialBlocks").doc(blockId(left.chessCom.playerId, right.chessCom.playerId)),
    rightBlocksLeft: db.collection("socialBlocks").doc(blockId(right.chessCom.playerId, left.chessCom.playerId)),
  };
}

function assertAcceptedRelationship(
  left: BoardSignalAccount,
  right: BoardSignalAccount,
  relationship: DocumentSnapshot,
  leftBlock: DocumentSnapshot,
  rightBlock: DocumentSnapshot,
) {
  const data = relationship.data() as { status?: string; playerAId?: number; playerBId?: number; playerAUid?: string; playerBUid?: string } | undefined;
  const ids = new Set([data?.playerAId, data?.playerBId]);
  const uids = new Set([data?.playerAUid, data?.playerBUid]);
  if (!relationship.exists || data?.status !== "friends" || !ids.has(left.chessCom.playerId) || !ids.has(right.chessCom.playerId) || !uids.has(left.uid) || !uids.has(right.uid)) {
    throw Object.assign(new Error("Private messages are available only between accepted BoardSignal friends."), { status: 403 });
  }
  if (leftBlock.exists || rightBlock.exists) throw Object.assign(new Error("Private messaging is unavailable for this connection."), { status: 403 });
}

async function assertCurrentFriendship(left: BoardSignalAccount, right: BoardSignalAccount) {
  const refs = friendshipRefs(left, right);
  const [relationship, leftBlock, rightBlock] = await Promise.all([
    refs.relationship.get(),
    refs.leftBlocksRight.get(),
    refs.rightBlocksLeft.get(),
  ]);
  assertAcceptedRelationship(left, right, relationship, leftBlock, rightBlock);
  return refs.relationshipId;
}

export async function friendConversation(token: DecodedIdToken, otherPlayerIdInput: unknown): Promise<BoardSignalFriendConversationView> {
  const account = await accountForToken(token);
  const other = await accountByPlayerId(playerId(otherPlayerIdInput));
  if (other.uid === account.uid) throw Object.assign(new Error("Choose another BoardSignal player."), { status: 400 });
  const threadId = await assertCurrentFriendship(account, other);
  const threadRef = getAdminDb().collection("friendConversations").doc(threadId);
  const messages = await threadRef.collection("messages").orderBy("createdAt", "desc").limit(100).get();
  const hydrated = await Promise.all(messages.docs.reverse().map(async (document) => {
    const message = { id: document.id, ...document.data() } as BoardSignalFriendMessage;
    return { ...message, attachment: await hydrateBoardSignalChatAttachment(message.attachment) };
  }));
  const orderedIds = [account.chessCom.playerId, other.chessCom.playerId].sort((a, b) => a - b) as [number, number];
  const orderedUids = orderedIds[0] === account.chessCom.playerId ? [account.uid, other.uid] : [other.uid, account.uid];
  return {
    thread: { id: threadId, participantUids: orderedUids as [string, string], participantPlayerIds: orderedIds },
    friend: { uid: other.uid, playerId: other.chessCom.playerId, canonicalUsername: other.chessCom.canonicalUsername },
    messages: hydrated,
  };
}

export async function sendFriendMessage(
  token: DecodedIdToken,
  otherPlayerIdInput: unknown,
  bodyInput: unknown,
  attachmentInput?: unknown,
  clientMessageIdInput?: unknown,
) {
  const account = await accountForToken(token);
  const other = await accountByPlayerId(playerId(otherPlayerIdInput));
  if (other.uid === account.uid) throw Object.assign(new Error("Choose another BoardSignal player."), { status: 400 });

  const body = normalizeChatMessageBody(bodyInput, 2000);
  const requestedAttachment = attachmentInput === undefined || attachmentInput === null ? undefined : validateBoardSignalChatAttachment(attachmentInput);
  requireChatMessageContent(body, requestedAttachment);

  const threadId = await assertCurrentFriendship(account, other);
  const messageId = stableMessageId(`${account.uid}:${threadId}`, clientMessageIdInput);
  const actor = playerChatUploadActor(account);
  const claim: BoardSignalAttachmentClaim = { kind: "friend_message", id: messageId, threadId, recipientUid: other.uid };
  let attachment: BoardSignalChatAttachment | undefined;
  if (requestedAttachment) attachment = await claimBoardSignalChatAttachment(requestedAttachment, actor, claim);

  const db = getAdminDb();
  const refs = friendshipRefs(account, other);
  const threadRef = db.collection("friendConversations").doc(threadId);
  const messageRef = threadRef.collection("messages").doc(messageId);
  const createdAt = new Date().toISOString();
  const orderedIds = [account.chessCom.playerId, other.chessCom.playerId].sort((a, b) => a - b) as [number, number];
  const orderedUids = orderedIds[0] === account.chessCom.playerId ? [account.uid, other.uid] : [other.uid, account.uid];

  try {
    let result: BoardSignalFriendMessage | undefined;
    await db.runTransaction(async (transaction) => {
      // Relationship and block state are deliberately re-read at SEND time.
      const [relationship, leftBlock, rightBlock, existing] = await Promise.all([
        transaction.get(refs.relationship),
        transaction.get(refs.leftBlocksRight),
        transaction.get(refs.rightBlocksLeft),
        transaction.get(messageRef),
      ]);
      assertAcceptedRelationship(account, other, relationship, leftBlock, rightBlock);
      if (existing.exists) {
        result = { id: existing.id, ...existing.data() } as BoardSignalFriendMessage;
        return;
      }
      const message: BoardSignalFriendMessage = {
        id: messageId,
        threadId,
        senderUid: account.uid,
        senderPlayerId: account.chessCom.playerId,
        recipientUid: other.uid,
        recipientPlayerId: other.chessCom.playerId,
        body,
        createdAt,
        ...(attachment ? { attachment } : {}),
      };
      transaction.set(threadRef, clean({
        id: threadId,
        participantUids: orderedUids,
        participantPlayerIds: orderedIds,
        createdAt,
        updatedAt: createdAt,
        lastMessageId: messageId,
      }), { merge: true });
      transaction.set(messageRef, clean(message), { merge: false });
      result = message;
    });
    const message = result!;
    return { ...message, attachment: await hydrateBoardSignalChatAttachment(message.attachment) };
  } catch (reason) {
    if (attachment) await cleanupClaimedAttachmentAfterFailedMessage(actor, attachment, claim).catch(() => false);
    throw reason;
  }
}
