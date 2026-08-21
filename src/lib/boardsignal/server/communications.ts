import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import type { BoardSignalAccount } from "../account";
import type { BoardSignalDesk } from "../types";
import { buildPlayerUniverseView } from "../universe";
import { foundingBetaField } from "../../../data/universeField";
import {
  preferenceAllowsMessage,
  type BoardSignalConversationMessage,
  type BoardSignalInboxMessage,
  type BoardSignalMessageType,
  type CommunicationCampaignDraft,
  type CommunicationSegment,
} from "../communications";
import {
  attachmentOnlyNotificationCopy,
  normalizeChatMessageBody,
  requireChatMessageContent,
  validateBoardSignalChatAttachment,
  type BoardSignalChatAttachment,
} from "../chatAttachments";
import { getAdminDb, getAdminMessaging } from "../../../utils/firebaseAdmin";
import { absoluteBoardSignalLink, accountCanReceiveBoardSignalEmail, boardSignalMessageLink } from "../delivery";
import { accountForToken } from "./persistence";
import { getBoardSignalDeliveryStatus, getFounderDeliveryStatus } from "./delivery";
import { sendBoardSignalEmail } from "./email";
import {
  claimBoardSignalChatAttachment,
  cleanupClaimedAttachmentAfterFailedMessage,
  founderChatUploadActor,
  hydrateBoardSignalChatAttachment,
  playerChatUploadActor,
  validateChatAttachmentOwnership,
  type BoardSignalAttachmentClaim,
} from "./chatAttachments";

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeId(value: string) {
  return value.replaceAll("/", "_").slice(0, 700);
}

function validateText(value: unknown, label: string, max = 4000) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw Object.assign(new Error(`${label} is required and must be under ${max} characters.`), { status: 400 });
  return text;
}

function stableMessageId(scope: string, input: unknown) {
  const clientId = String(input ?? "").trim();
  if (!clientId) return randomUUID();
  if (clientId.length > 160) throw Object.assign(new Error("Message request ID is invalid."), { status: 400 });
  return `msg_${createHash("sha256").update(`${scope}:${clientId}`).digest("hex").slice(0, 40)}`;
}

function safePrivateMessagePreview(body: string, attachment?: BoardSignalChatAttachment) {
  return body || attachmentOnlyNotificationCopy(attachment);
}

async function hydrateInboxMessage(message: BoardSignalInboxMessage) {
  return { ...message, attachment: await hydrateBoardSignalChatAttachment(message.attachment) };
}

async function hydrateConversationMessage(message: BoardSignalConversationMessage) {
  return { ...message, attachment: await hydrateBoardSignalChatAttachment(message.attachment) };
}

function pushPayload(type: BoardSignalMessageType, title: string, body: string, forceVisible = false) {
  if (forceVisible || ["desk_ready", "episode_update", "blue_reminder", "universe_achievement", "friend_request", "friend_accepted", "beta_update"].includes(type)) {
    return { title, body };
  }
  return { title: "BoardSignal", body: "You have a new private message in My Player Room." };
}

function messageLink(type: BoardSignalMessageType, explicit?: string) {
  return explicit?.trim() || boardSignalMessageLink(type);
}

async function sendEmailToAccount(account: BoardSignalAccount, type: BoardSignalMessageType, title: string, body: string, link?: string) {
  const status = getBoardSignalDeliveryStatus();
  if (!status.emailConfigured || !accountCanReceiveBoardSignalEmail(account, type)) {
    return { eligible: false, delivered: 0, failed: 0, configured: status.emailConfigured };
  }
  const destination = account.preferredContactValue!.trim();
  const absoluteLink = absoluteBoardSignalLink(link);
  const text = [body.trim(), absoluteLink ? `Open BoardSignal: ${absoluteLink}` : ""].filter(Boolean).join("\n\n");
  const result = await sendBoardSignalEmail({ to: destination, subject: title, text });
  return {
    eligible: true,
    delivered: result.delivered ? 1 : 0,
    failed: result.delivered ? 0 : 1,
    configured: result.configured,
    error: result.error,
  };
}

export async function listPlayerInbox(token: DecodedIdToken) {
  const account = await accountForToken(token);
  const db = getAdminDb();
  const snapshot = await db.collection("users").doc(account.uid).collection("inbox")
    .orderBy("createdAt", "desc").limit(100).get();
  const durable = snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as BoardSignalInboxMessage));
  const messages = await Promise.all(durable.map(hydrateInboxMessage));
  return { messages, unreadCount: durable.filter((message) => !message.readAt).length };
}

export async function markInboxMessageRead(token: DecodedIdToken, messageIdInput: unknown) {
  const account = await accountForToken(token);
  const messageId = safeId(validateText(messageIdInput, "Message ID", 700));
  const ref = getAdminDb().collection("users").doc(account.uid).collection("inbox").doc(messageId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("That inbox message was not found."), { status: 404 });
  const readAt = new Date().toISOString();
  const data = snapshot.data() as BoardSignalInboxMessage;
  await ref.set({ readAt }, { merge: true });
  if (!data.readAt && data.campaignId) {
    await getAdminDb().collection("communications").doc(data.campaignId).set({
      readCount: FieldValue.increment(1),
    }, { merge: true }).catch(() => undefined);
  }
  return { messageId, readAt };
}

export async function listPlayerConversation(token: DecodedIdToken, threadIdInput: unknown) {
  const account = await accountForToken(token);
  const threadId = safeId(validateText(threadIdInput, "Thread ID", 700));
  const db = getAdminDb();
  const threadRef = db.collection("users").doc(account.uid).collection("conversations").doc(threadId);
  const thread = await threadRef.get();
  if (!thread.exists) throw Object.assign(new Error("That conversation was not found."), { status: 404 });
  const messages = await threadRef.collection("messages").orderBy("createdAt", "asc").limit(200).get();
  const hydrated = await Promise.all(messages.docs.map(async (document) => hydrateConversationMessage({ id: document.id, ...document.data() } as BoardSignalConversationMessage)));
  return {
    thread: { id: thread.id, ...thread.data() },
    messages: hydrated,
  };
}

export async function replyToFounder(
  token: DecodedIdToken,
  threadIdInput: unknown,
  bodyInput: unknown,
  attachmentInput?: unknown,
  clientMessageIdInput?: unknown,
) {
  const account = await accountForToken(token);
  const threadId = safeId(validateText(threadIdInput, "Thread ID", 700));
  const body = normalizeChatMessageBody(bodyInput, 2000);
  const requestedAttachment = attachmentInput === undefined || attachmentInput === null ? undefined : validateBoardSignalChatAttachment(attachmentInput);
  requireChatMessageContent(body, requestedAttachment);

  const db = getAdminDb();
  const threadRef = db.collection("users").doc(account.uid).collection("conversations").doc(threadId);
  const thread = await threadRef.get();
  if (!thread.exists || thread.data()?.allowReply !== true) {
    throw Object.assign(new Error("Replies are not enabled for this conversation."), { status: 403 });
  }
  const messageId = stableMessageId(`${account.uid}:${threadId}:player`, clientMessageIdInput);
  const existing = await threadRef.collection("messages").doc(messageId).get();
  if (existing.exists) return hydrateConversationMessage({ id: existing.id, ...existing.data() } as BoardSignalConversationMessage);

  const actor = playerChatUploadActor(account);
  const claim: BoardSignalAttachmentClaim = { kind: "player_reply", id: messageId, threadId, recipientUid: "founder" };
  let attachment: BoardSignalChatAttachment | undefined;
  if (requestedAttachment) attachment = await claimBoardSignalChatAttachment(requestedAttachment, actor, claim);

  const createdAt = new Date().toISOString();
  const message: BoardSignalConversationMessage = {
    id: messageId,
    userId: account.uid,
    threadId,
    body,
    senderType: "player",
    createdAt,
    campaignId: typeof thread.data()?.campaignId === "string" ? thread.data()!.campaignId : undefined,
    ...(attachment ? { attachment } : {}),
  };
  try {
    const batch = db.batch();
    batch.set(threadRef.collection("messages").doc(messageId), clean(message), { merge: false });
    batch.set(threadRef, { updatedAt: createdAt, unreadForFounder: true, lastSenderType: "player" }, { merge: true });
    await batch.commit();
    return hydrateConversationMessage(message);
  } catch (reason) {
    if (attachment) await cleanupClaimedAttachmentAfterFailedMessage(actor, attachment, claim).catch(() => false);
    throw reason;
  }
}

export async function registerPlayerPushToken(token: DecodedIdToken, fcmTokenInput: unknown, userAgentInput?: unknown) {
  // FCM registration-token delivery is intentionally retained for Firebase Web 11/Admin 13 stability.
  // Move to FID registration in one deliberate Firebase/Node maintenance patch; do not run token + FID paths together.
  const account = await accountForToken(token);
  const fcmToken = validateText(fcmTokenInput, "Browser push token", 4096);
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()) {
    throw Object.assign(new Error("Browser alerts are unavailable until BoardSignal push configuration is completed."), { status: 503 });
  }
  const id = safeId(Buffer.from(fcmToken).toString("base64url").slice(0, 180));
  const now = new Date().toISOString();
  await getAdminDb().collection("users").doc(account.uid).collection("pushTokens").doc(id).set(clean({
    token: fcmToken,
    createdAt: now,
    updatedAt: now,
    userAgent: String(userAgentInput ?? "").slice(0, 500),
  }), { merge: true });
  await getAdminDb().collection("users").doc(account.uid).set({
    notificationPreferences: { ...account.notificationPreferences, browserPush: true },
  }, { merge: true });
  return { id, configured: true };
}

export async function unregisterPlayerPushToken(token: DecodedIdToken, fcmTokenInput?: unknown) {
  const account = await accountForToken(token);
  const collection = getAdminDb().collection("users").doc(account.uid).collection("pushTokens");
  if (typeof fcmTokenInput === "string" && fcmTokenInput.trim()) {
    const id = safeId(Buffer.from(fcmTokenInput.trim()).toString("base64url").slice(0, 180));
    await collection.doc(id).delete().catch(() => undefined);
  } else {
    const all = await collection.get();
    const batch = getAdminDb().batch();
    all.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
  await getAdminDb().collection("users").doc(account.uid).set({
    notificationPreferences: { ...account.notificationPreferences, browserPush: false },
  }, { merge: true });
  return { removed: true };
}

async function allActiveAccounts() {
  const users = await getAdminDb().collection("users").get();
  return users.docs
    .map((document) => document.data() as BoardSignalAccount)
    .filter((account) => account.role === "player" && account.accessTier === "founding_beta" && account.accessStatus === "active");
}

async function audienceForSegment(segment: CommunicationSegment, accounts: BoardSignalAccount[]) {
  const db = getAdminDb();
  if (segment === "episode_forming") return accounts.filter((account) => account.currentEpisodeSummary?.status === "forming");
  if (segment === "blue_available") return accounts.filter((account) => Boolean(account.previousBlue?.title));
  if (segment === "inactive_recently") {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return accounts.filter((account) => !account.lastSeenAt || Date.parse(account.lastSeenAt) < cutoff);
  }
  if (segment === "new_players") {
    const checks = await Promise.all(accounts.map(async (account) => ({
      account,
      desks: (await db.collection("users").doc(account.uid).collection("desks").limit(1).get()).size,
    })));
    return checks.filter((item) => item.desks === 0).map((item) => item.account);
  }
  if (segment === "desk_ready" || segment === "latest_desk_not_opened") {
    const checks = await Promise.all(accounts.map(async (account) => {
      const desks = await db.collection("users").doc(account.uid).collection("desks").orderBy("periodEnd", "desc").limit(1).get();
      const latest = desks.docs[0]?.data() as { publishedAt?: string } | undefined;
      const ready = Boolean(latest);
      const unopened = Boolean(latest?.publishedAt && (!account.lastSeenAt || account.lastSeenAt < latest.publishedAt));
      return { account, ready, unopened };
    }));
    return checks.filter((item) => segment === "desk_ready" ? item.ready : item.unopened).map((item) => item.account);
  }
  if (segment === "pending_feedback") {
    const checks = await Promise.all(accounts.map(async (account) => {
      const inbox = await db.collection("users").doc(account.uid).collection("inbox").where("type", "==", "feedback_request").limit(10).get();
      return { account, pending: inbox.docs.some((document) => !document.data().readAt) };
    }));
    return checks.filter((item) => item.pending).map((item) => item.account);
  }
  if (segment === "universe_top3") {
    const checks = await Promise.all(accounts.map(async (account) => {
      const desks = await db.collection("users").doc(account.uid).collection("desks").orderBy("periodEnd", "desc").limit(1).get();
      const latest = desks.docs[0]?.data() as { desk?: BoardSignalDesk } | undefined;
      const view = latest?.desk ? buildPlayerUniverseView(foundingBetaField, latest.desk) : undefined;
      return { account, topThree: Boolean(view?.standings.some((standing) => standing.rank <= 3)) };
    }));
    return checks.filter((item) => item.topThree).map((item) => item.account);
  }
  return [];
}

export async function resolveFounderAudience(draft: Pick<CommunicationCampaignDraft, "audienceKind" | "userIds" | "segment">) {
  const accounts = await allActiveAccounts();
  if (draft.audienceKind === "all_active_beta") return accounts;
  if (draft.audienceKind === "one" || draft.audienceKind === "selected") {
    const wanted = new Set((draft.userIds ?? []).filter(Boolean));
    return accounts.filter((account) => wanted.has(account.uid));
  }
  if (draft.audienceKind === "segment" && draft.segment) return audienceForSegment(draft.segment, accounts);
  return [];
}

export async function previewFounderCampaign(draft: CommunicationCampaignDraft) {
  if (draft.attachment) await validateChatAttachmentOwnership(draft.attachment, founderChatUploadActor());
  const audience = await resolveFounderAudience(draft);
  const deliveryStatus = getBoardSignalDeliveryStatus();
  let pushEligibleCount = 0;
  if (draft.channels.browserPush && deliveryStatus.browserPushConfigured) {
    const tokenChecks = await Promise.all(audience.map(async (account) => {
      if (!account.notificationPreferences?.browserPush || !preferenceAllowsMessage(account.notificationPreferences, draft.type)) return false;
      const tokens = await getAdminDb().collection("users").doc(account.uid).collection("pushTokens").limit(1).get();
      return !tokens.empty;
    }));
    pushEligibleCount = tokenChecks.filter(Boolean).length;
  }
  const emailEligibleCount = draft.channels.email && deliveryStatus.emailConfigured
    ? audience.filter((account) => accountCanReceiveBoardSignalEmail(account, draft.type)).length
    : 0;
  return {
    audienceCount: audience.length,
    pushEligibleCount,
    emailEligibleCount,
    deliveryStatus,
    users: audience.map((account) => ({
      uid: account.uid,
      username: account.chessCom.canonicalUsername,
      preferredContactMethod: account.preferredContactMethod,
      preferredContactValue: account.betaContactConsent ? account.preferredContactValue : undefined,
    })),
  };
}

async function sendPushToAccount(account: BoardSignalAccount, type: BoardSignalMessageType, title: string, body: string, link?: string, options: { forceVisible?: boolean; bypassTypePreference?: boolean } = {}) {
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() || !account.notificationPreferences?.browserPush) {
    return { eligible: false, delivered: 0, failed: 0 };
  }
  if (!options.bypassTypePreference && !preferenceAllowsMessage(account.notificationPreferences, type)) return { eligible: false, delivered: 0, failed: 0 };
  const tokens = await getAdminDb().collection("users").doc(account.uid).collection("pushTokens").get();
  if (tokens.empty) return { eligible: false, delivered: 0, failed: 0 };
  const payload = pushPayload(type, title, body, options.forceVisible === true);
  let delivered = 0;
  let failed = 0;
  for (const tokenDoc of tokens.docs) {
    const fcmToken = String(tokenDoc.data().token ?? "");
    if (!fcmToken) continue;
    try {
      await getAdminMessaging().send({
        token: fcmToken,
        notification: payload,
        webpush: { fcmOptions: { link: messageLink(type, link) } },
        data: { type, link: messageLink(type, link) },
      });
      delivered += 1;
    } catch (error) {
      failed += 1;
      const code = String((error as { code?: string }).code ?? "");
      if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
        await tokenDoc.ref.delete().catch(() => undefined);
      }
    }
  }
  return { eligible: true, delivered, failed };
}

export async function sendFounderCampaign(draft: CommunicationCampaignDraft) {
  const title = validateText(draft.title, "Message title", 140);
  const body = normalizeChatMessageBody(draft.body, 4000);
  const requestedAttachment = draft.attachment ? validateBoardSignalChatAttachment(draft.attachment) : undefined;
  requireChatMessageContent(body, requestedAttachment);
  const audience = await resolveFounderAudience(draft);
  if (!audience.length) throw Object.assign(new Error("This audience currently contains no active Founding Access players."), { status: 400 });
  const db = getAdminDb();
  const campaignId = randomUUID();
  const createdAt = new Date().toISOString();
  const actor = founderChatUploadActor();
  const claim: BoardSignalAttachmentClaim = { kind: "founder_campaign", id: campaignId };
  let attachment: BoardSignalChatAttachment | undefined;
  if (requestedAttachment) attachment = await claimBoardSignalChatAttachment(requestedAttachment, actor, claim);
  let persistedAny = false;
  let sentCount = 0;
  let pushEligibleCount = 0;
  let pushDelivered = 0;
  let pushFailed = 0;
  let emailEligibleCount = 0;
  let emailDelivered = 0;
  let emailFailed = 0;

  try {
    for (const account of audience) {
      if (!preferenceAllowsMessage(account.notificationPreferences, draft.type) && draft.type !== "custom") continue;
      const messageId = randomUUID();
      const threadId = draft.allowReply ? safeId(`${campaignId}_${account.uid}`) : undefined;
      const message: BoardSignalInboxMessage = {
        id: messageId,
        userId: account.uid,
        type: draft.type,
        title,
        body,
        link: messageLink(draft.type, draft.link),
        actionLabel: draft.actionLabel,
        createdAt,
        senderType: "founder",
        campaignId,
        threadId,
        allowReply: draft.allowReply,
        ...(attachment ? { attachment } : {}),
      };
      const recipientBatch = db.batch();
      recipientBatch.set(db.collection("users").doc(account.uid).collection("inbox").doc(messageId), clean(message));
      if (threadId) {
        const threadRef = db.collection("users").doc(account.uid).collection("conversations").doc(threadId);
        recipientBatch.set(threadRef, clean({
          id: threadId,
          userId: account.uid,
          campaignId,
          allowReply: true,
          title,
          createdAt,
          updatedAt: createdAt,
          unreadForFounder: false,
          lastSenderType: "founder",
        }));
        const first: BoardSignalConversationMessage = { id: messageId, userId: account.uid, threadId, body, senderType: "founder", createdAt, campaignId, ...(attachment ? { attachment } : {}) };
        recipientBatch.set(threadRef.collection("messages").doc(messageId), clean(first));
      }
      await recipientBatch.commit();
      persistedAny = true;
      sentCount += 1;
      const deliveryBody = safePrivateMessagePreview(body, attachment);
      if (draft.channels.browserPush) {
        const push = await sendPushToAccount(account, draft.type, title, deliveryBody, message.link);
        if (push.eligible) pushEligibleCount += 1;
        pushDelivered += push.delivered;
        pushFailed += push.failed;
      }
      if (draft.channels.email) {
        const emailResult = await sendEmailToAccount(account, draft.type, title, deliveryBody, message.link);
        if (emailResult.eligible) emailEligibleCount += 1;
        emailDelivered += emailResult.delivered;
        emailFailed += emailResult.failed;
      }
    }

    const campaign = clean({
      id: campaignId,
      ...draft,
      title,
      body,
      ...(attachment ? { attachment } : {}),
      createdAt,
      audienceCount: audience.length,
      sentCount,
      readCount: 0,
      pushEligibleCount,
      pushDelivered,
      pushFailed,
      emailEligibleCount,
      emailDelivered,
      emailFailed,
    });
    await db.collection("communications").doc(campaignId).set(campaign);
    persistedAny = true;
    return campaign;
  } catch (reason) {
    if (attachment && !persistedAny) await cleanupClaimedAttachmentAfterFailedMessage(actor, attachment, claim).catch(() => false);
    throw reason;
  }
}

export async function listFounderCommunications() {
  const db = getAdminDb();
  const [campaigns, users] = await Promise.all([
    db.collection("communications").orderBy("createdAt", "desc").limit(50).get(),
    db.collection("users").get(),
  ]);
  const accounts = users.docs.map((document) => document.data() as BoardSignalAccount)
    .filter((account) => account.role === "player" && account.accessTier === "founding_beta");
  const conversations: Array<Record<string, unknown>> = [];
  for (const account of accounts) {
    const threads = await db.collection("users").doc(account.uid).collection("conversations").orderBy("updatedAt", "desc").limit(20).get();
    threads.docs.forEach((thread) => conversations.push({
      ...thread.data(),
      username: account.chessCom.canonicalUsername,
    }));
  }
  conversations.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  return {
    campaigns: campaigns.docs.map((document) => document.data()),
    conversations: conversations.slice(0, 100),
    players: accounts.map((account) => ({ uid: account.uid, username: account.chessCom.canonicalUsername })),
    deliveryStatus: await getFounderDeliveryStatus(),
  };
}

export async function founderConversation(uidInput: unknown, threadIdInput: unknown) {
  const uid = safeId(validateText(uidInput, "User ID", 700));
  const threadId = safeId(validateText(threadIdInput, "Thread ID", 700));
  const db = getAdminDb();
  const accountSnapshot = await db.collection("users").doc(uid).get();
  if (!accountSnapshot.exists) throw Object.assign(new Error("The player account was not found."), { status: 404 });
  const account = accountSnapshot.data() as BoardSignalAccount;
  const threadRef = db.collection("users").doc(uid).collection("conversations").doc(threadId);
  const thread = await threadRef.get();
  if (!thread.exists) throw Object.assign(new Error("The conversation was not found."), { status: 404 });
  const messages = await threadRef.collection("messages").orderBy("createdAt", "asc").limit(200).get();
  await threadRef.set({ unreadForFounder: false }, { merge: true });
  return {
    player: { uid, username: account.chessCom.canonicalUsername },
    thread: { id: thread.id, ...thread.data() },
    messages: await Promise.all(messages.docs.map(async (document) => hydrateConversationMessage({ id: document.id, ...document.data() } as BoardSignalConversationMessage))),
  };
}

export async function founderReply(
  uidInput: unknown,
  threadIdInput: unknown,
  bodyInput: unknown,
  attachmentInput?: unknown,
  clientMessageIdInput?: unknown,
) {
  const uid = safeId(validateText(uidInput, "User ID", 700));
  const threadId = safeId(validateText(threadIdInput, "Thread ID", 700));
  const body = normalizeChatMessageBody(bodyInput, 2000);
  const requestedAttachment = attachmentInput === undefined || attachmentInput === null ? undefined : validateBoardSignalChatAttachment(attachmentInput);
  requireChatMessageContent(body, requestedAttachment);
  const db = getAdminDb();
  const accountSnapshot = await db.collection("users").doc(uid).get();
  if (!accountSnapshot.exists) throw Object.assign(new Error("The player account was not found."), { status: 404 });
  const account = accountSnapshot.data() as BoardSignalAccount;
  const threadRef = db.collection("users").doc(uid).collection("conversations").doc(threadId);
  const thread = await threadRef.get();
  if (!thread.exists || thread.data()?.allowReply !== true) throw Object.assign(new Error("Replies are not enabled for this conversation."), { status: 403 });
  const id = stableMessageId(`${uid}:${threadId}:founder`, clientMessageIdInput);
  const existing = await threadRef.collection("messages").doc(id).get();
  if (existing.exists) {
    const message = await hydrateConversationMessage({ id: existing.id, ...existing.data() } as BoardSignalConversationMessage);
    return { message, push: { eligible: false, delivered: 0, failed: 0 }, email: { eligible: false, delivered: 0, failed: 0 } };
  }

  const actor = founderChatUploadActor();
  const claim: BoardSignalAttachmentClaim = { kind: "founder_reply", id, threadId, recipientUid: uid };
  let attachment: BoardSignalChatAttachment | undefined;
  if (requestedAttachment) attachment = await claimBoardSignalChatAttachment(requestedAttachment, actor, claim);

  const createdAt = new Date().toISOString();
  const message: BoardSignalConversationMessage = { id, userId: uid, threadId, body, senderType: "founder", createdAt, campaignId: thread.data()?.campaignId, ...(attachment ? { attachment } : {}) };
  const inbox: BoardSignalInboxMessage = {
    id,
    userId: uid,
    type: "custom",
    title: String(thread.data()?.title ?? "Founder reply"),
    body,
    createdAt,
    senderType: "founder",
    campaignId: thread.data()?.campaignId,
    threadId,
    allowReply: true,
    ...(attachment ? { attachment } : {}),
  };
  try {
    const batch = db.batch();
    batch.set(threadRef.collection("messages").doc(id), clean(message));
    batch.set(threadRef, { updatedAt: createdAt, unreadForFounder: false, lastSenderType: "founder" }, { merge: true });
    batch.set(db.collection("users").doc(uid).collection("inbox").doc(id), clean(inbox));
    await batch.commit();
  } catch (reason) {
    if (attachment) await cleanupClaimedAttachmentAfterFailedMessage(actor, attachment, claim).catch(() => false);
    throw reason;
  }

  const link = boardSignalMessageLink("custom");
  const deliveryBody = safePrivateMessagePreview(body, attachment);
  const push = await sendPushToAccount(account, "custom", inbox.title, deliveryBody, link)
    .catch(() => ({ eligible: true, delivered: 0, failed: 1 }));
  const emailResult = await sendEmailToAccount(account, "custom", inbox.title, deliveryBody, link)
    .catch(() => ({ eligible: true, delivered: 0, failed: 1, configured: getBoardSignalDeliveryStatus().emailConfigured }));
  return { message: await hydrateConversationMessage(message), push, email: emailResult };
}

export async function sendAutomatedPlayerMessage(
  account: BoardSignalAccount,
  message: Pick<BoardSignalInboxMessage, "type" | "title" | "body" | "link" | "actionLabel" | "allowReply">,
  eventKey: string,
  pushAllowed: boolean,
) {
  if (!preferenceAllowsMessage(account.notificationPreferences, message.type)) {
    return { sent: false, pushEligible: false, pushDelivered: 0, pushFailed: 0 };
  }
  const id = `auto_${createHash("sha256").update(eventKey).digest("hex").slice(0, 40)}`;
  const createdAt = new Date().toISOString();
  const inbox: BoardSignalInboxMessage = {
    id,
    userId: account.uid,
    ...message,
    link: messageLink(message.type, message.link),
    createdAt,
    senderType: "system",
    allowReply: false,
  };
  await getAdminDb().collection("users").doc(account.uid).collection("inbox").doc(id).set(clean(inbox), { merge: false });
  const push = pushAllowed
    ? await sendPushToAccount(account, message.type, message.title, message.body, inbox.link)
    : { eligible: false, delivered: 0, failed: 0 };
  const emailResult = await sendEmailToAccount(account, message.type, message.title, message.body, inbox.link);
  return {
    sent: true,
    pushEligible: push.eligible,
    pushDelivered: push.delivered,
    pushFailed: push.failed,
    emailEligible: emailResult.eligible,
    emailDelivered: emailResult.delivered,
    emailFailed: emailResult.failed,
  };
}

export async function sendFounderTestBrowserAlert(uidInput: unknown) {
  const uid = safeId(validateText(uidInput, "Player", 700));
  const snapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) throw Object.assign(new Error("That BoardSignal player was not found."), { status: 404 });
  const account = snapshot.data() as BoardSignalAccount;
  if (account.role !== "player" || account.accessStatus !== "active") throw Object.assign(new Error("That player is not eligible for a delivery test."), { status: 400 });
  if (!getBoardSignalDeliveryStatus().browserPushConfigured) return { status: "not_eligible" as const, delivered: 0, failed: 0, reason: "Browser Push configuration is required." };
  if (account.notificationPreferences?.browserPush !== true) return { status: "not_eligible" as const, delivered: 0, failed: 0, reason: "This player has not enabled browser alerts." };
  const push = await sendPushToAccount(
    account,
    "custom",
    "TEST · BoardSignal browser alert",
    "If you can see this, browser delivery is working for this device.",
    boardSignalMessageLink("custom"),
    { forceVisible: true, bypassTypePreference: true },
  );
  if (!push.eligible) return { status: "not_eligible" as const, delivered: 0, failed: 0, reason: "No registered browser device is available for this player." };
  return {
    status: push.delivered > 0 ? "delivered" as const : "failed" as const,
    delivered: push.delivered,
    failed: push.failed,
    ...(push.delivered > 0 ? {} : { reason: "Firebase did not confirm delivery to a registered device." }),
  };
}

export async function sendRelationshipNotification(
  account: BoardSignalAccount,
  input: { id: string; type: "friend_request" | "friend_accepted"; title: string; body: string; link: string; actionLabel: string },
) {
  const message: BoardSignalInboxMessage = {
    id: input.id,
    userId: account.uid,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    actionLabel: input.actionLabel,
    createdAt: new Date().toISOString(),
    senderType: "system",
    allowReply: false,
  };
  await getAdminDb().collection("users").doc(account.uid).collection("inbox").doc(input.id).set(clean(message), { merge: true });
  const push = account.notificationPreferences?.browserPush
    ? await sendPushToAccount(account, input.type, input.title, input.body, input.link)
    : { eligible: false, delivered: 0, failed: 0 };
  return { message, push };
}
