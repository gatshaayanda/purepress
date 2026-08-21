import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { BoardSignalAccount } from "../account";
import type { BoardSignalInboxMessage, BoardSignalConversationMessage } from "../communications";
import {
  DEFAULT_GUIDE_PREFERENCES,
  boundedGuideMemory,
  deterministicGuideRenderer,
  expressedSentiment,
  isGuideWhatsNewMessage,
  runGuideBrain,
  sanitizeGuideConversation,
  type GuideContext,
  type GuideConversationTurn,
  type GuideConversationMemory,
  type GuidePreferences,
  type GuideQuestionCategory,
  type GuideResponse,
  type GuideTone,
  type GuideDetailLevel,
} from "../guide";
import type { PlayerPulse, SafeShareMoment } from "../pulse";
import type { BoardSignalDesk } from "../types";
import { accountForToken, loadPublishedDesks } from "./persistence";
import { listPlayerInbox } from "./communications";
import { getBoardSignalDeliveryStatus } from "./delivery";
import { isValidBoardSignalEmail } from "../delivery";
import { headToHead, socialOverview } from "./social";
import { listPlayerShareMoments } from "./universePulse";
import { verifyBetaPreviewStatusCredential } from "./activation";
import type { BoardSignalBetaPreview } from "../activation";

const MAX_MESSAGE = 1200;
const MAX_SUPPORT_MESSAGE = 1800;
const GUIDE_RELEASE_HINT = "friends-rivals-2026-08-12";
const TONES = new Set<GuideTone>(["Balanced", "Direct", "Analytical", "Sports Desk", "Encouraging"]);
const DETAILS = new Set<GuideDetailLevel>(["Short", "Standard", "Detailed"]);

function nowIso() { return new Date().toISOString(); }
function clean<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined)) as T;
}
function safeText(input: unknown, limit: number) { return String(input ?? "").trim().slice(0, limit); }
function safePath(input: unknown) {
  const value = safeText(input, 300);
  return value.startsWith("/") ? value : "/";
}
function safeActiveTab(input: unknown) {
  const value = safeText(input, 40).toLowerCase();
  return ["desk", "progress", "universe", "friends", "head-to-head", "inbox", "profile", "agreement", "beta-request"].includes(value) ? value : undefined;
}
function safeVisibleEntityId(input: unknown) {
  const value = Number(input);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export type GuidePlayerRoomCapture = {
  currentEpisode?: GuideContext["currentEpisode"];
  latestDesk?: BoardSignalDesk;
  recentDeskLabels: string[];
  pulse?: PlayerPulse;
  shareMoments?: Array<SafeShareMoment & { activeDesk?: boolean }>;
};

export async function recordGuidePlayerRoomSnapshot(account: BoardSignalAccount, capture: GuidePlayerRoomCapture) {
  const pulseFacts = [
    ...(capture.pulse?.sinceAway ? [capture.pulse.sinceAway] : []),
    ...(capture.pulse?.boardMoved ?? []),
    ...(capture.pulse?.proximity ?? []),
    ...(capture.pulse?.fieldMoved ?? []).map((event) => ({ eyebrow: "THE FIELD MOVED", title: event.headline, body: event.supportingFact })),
  ].slice(0, 10).map((item) => ({ eyebrow: item.eyebrow, title: item.title ?? "", body: item.body ?? "", facts: "facts" in item ? item.facts : undefined }));
  const latestDesk = capture.latestDesk ? {
    periodLabel: capture.latestDesk.period.label,
    headline: capture.latestDesk.headline,
    summary: capture.latestDesk.summary,
    games: capture.latestDesk.games,
    wins: capture.latestDesk.wins,
    draws: capture.latestDesk.draws,
    losses: capture.latestDesk.losses,
    score: capture.latestDesk.score,
    primaryPool: capture.latestDesk.primaryPool,
    blue: capture.latestDesk.signals.blue ? { title: capture.latestDesk.signals.blue.title, copy: capture.latestDesk.signals.blue.copy } : undefined,
    amber: capture.latestDesk.signals.amber ? { title: capture.latestDesk.signals.amber.title, copy: capture.latestDesk.signals.amber.copy } : undefined,
    red: capture.latestDesk.signals.red ? { title: capture.latestDesk.signals.red.title, copy: capture.latestDesk.signals.red.copy } : undefined,
  } : undefined;
  await getAdminDb().collection("users").doc(account.uid).collection("guide").doc("session").set(clean({
    updatedAt: nowIso(),
    currentEpisode: capture.currentEpisode,
    latestDesk,
    recentDeskLabels: capture.recentDeskLabels.slice(0, 4),
    pulseFacts,
    standings: (capture.pulse?.standings ?? []).slice(0, 12).map((standing) => ({
      categoryTitle: standing.categoryTitle,
      scopeLabel: standing.scopeLabel,
      rank: standing.rank,
      denominator: standing.denominator,
      valueLabel: standing.valueLabel,
    })),
    shareMoments: (capture.shareMoments ?? []).filter((moment) => moment.safePublic).slice(0, 3).map((moment) => ({
      id: moment.id, headline: moment.headline, supportingFact: moment.supportingFact, statValue: moment.statValue, statLabel: moment.statLabel,
    })),
  }), { merge: false });
}

async function loadGuidePreferences(uid: string): Promise<GuidePreferences> {
  const snapshot = await getAdminDb().collection("users").doc(uid).collection("guide").doc("profile").get();
  const data = snapshot.data() as Partial<GuidePreferences> | undefined;
  return { ...DEFAULT_GUIDE_PREFERENCES, ...(data ?? {}) };
}

async function loadGuideMemory(uid: string): Promise<GuideConversationMemory> {
  const snapshot = await getAdminDb().collection("users").doc(uid).collection("guide").doc("memory").get();
  const data = snapshot.data() as Partial<GuideConversationMemory> | undefined;
  return { recentTopics: [], productSignals: [], ...(data ?? {}) };
}

function latestAnnouncement(messages: BoardSignalInboxMessage[]) {
  // "What's new?" is product-release context, not the player's general Founder
  // conversation. Generic/custom support or test messages remain in Inbox but
  // must never masquerade as a BoardSignal product announcement.
  const message = messages.find((item) => isGuideWhatsNewMessage(item));
  return message ? { id: message.id, title: message.title, body: message.body, link: message.link, actionLabel: message.actionLabel, createdAt: message.createdAt } : undefined;
}

async function buildAuthenticatedContext(token: DecodedIdToken, pathname: string, activeTab?: string, message = "", visibleEntityId?: number, recentConversation: GuideConversationTurn[] = []): Promise<{ account: BoardSignalAccount; context: GuideContext }> {
  const account = await accountForToken(token);
  const db = getAdminDb();
  const [sessionDoc, preferences, inbox, social] = await Promise.all([
    db.collection("users").doc(account.uid).collection("guide").doc("session").get(),
    loadGuidePreferences(account.uid),
    listPlayerInbox(token).catch(() => ({ messages: [] as BoardSignalInboxMessage[], unreadCount: 0 })),
    socialOverview(account).catch(() => ({ friends: [], incoming: [], outgoing: [], rivalWatch: [], socialPulse: [] })),
  ]);
  const session = (sessionDoc.data() ?? {}) as DocumentData;
  let comparison;
  const friend = social.friends.find((item) => item.playerId === visibleEntityId || message.toLowerCase().includes(item.canonicalUsername.toLowerCase()));
  if (friend) comparison = await headToHead(account, friend.playerId).catch(() => undefined);

  // Backfill useful account facts if the player has not opened the current Player Room since this patch.
  let latestDesk = session.latestDesk as GuideContext["latestDesk"] | undefined;
  let recentDeskLabels = Array.isArray(session.recentDeskLabels) ? session.recentDeskLabels as string[] : undefined;
  let shareMoments = Array.isArray(session.shareMoments) ? session.shareMoments as GuideContext["shareMoments"] : undefined;
  if (!latestDesk || !recentDeskLabels || !shareMoments) {
    const desks = await loadPublishedDesks(account.uid).catch(() => []);
    const latest = desks[0]?.desk;
    if (latest && !latestDesk) latestDesk = {
      periodLabel: latest.period.label, headline: latest.headline, summary: latest.summary, games: latest.games, wins: latest.wins,
      draws: latest.draws, losses: latest.losses, score: latest.score, primaryPool: latest.primaryPool,
      blue: latest.signals.blue ? { title: latest.signals.blue.title, copy: latest.signals.blue.copy } : undefined,
      amber: latest.signals.amber ? { title: latest.signals.amber.title, copy: latest.signals.amber.copy } : undefined,
      red: latest.signals.red ? { title: latest.signals.red.title, copy: latest.signals.red.copy } : undefined,
    };
    recentDeskLabels ??= desks.map((item) => item.summary.periodLabel).slice(0, 4);
    if (!shareMoments) {
      shareMoments = (await listPlayerShareMoments(account.chessCom.playerId).catch(() => [])).slice(0, 3).map((moment) => ({ id: moment.id, headline: moment.headline, supportingFact: moment.supportingFact, statValue: moment.statValue, statLabel: moment.statLabel }));
    }
  }

  return {
    account,
    context: {
      authenticated: true,
      pathname,
      activeTab,
      canonicalUsername: account.chessCom.canonicalUsername,
      currentEpisode: (session.currentEpisode ?? account.currentEpisodeSummary) as GuideContext["currentEpisode"],
      latestDesk,
      recentDeskLabels,
      pulseFacts: Array.isArray(session.pulseFacts) ? session.pulseFacts as GuideContext["pulseFacts"] : [],
      standings: Array.isArray(session.standings) ? session.standings as GuideContext["standings"] : [],
      shareMoments,
      friends: social.friends,
      incomingRequests: social.incoming,
      outgoingRequests: social.outgoing,
      rivalWatch: social.rivalWatch,
      comparison,
      unreadInboxCount: inbox.unreadCount,
      latestAnnouncement: latestAnnouncement(inbox.messages),
      notificationPreferences: account.notificationPreferences,
      deliveryStatus: getBoardSignalDeliveryStatus(),
      emailAccountReady: account.betaContactConsent === true && account.preferredContactMethod === "email" && isValidBoardSignalEmail(account.preferredContactValue) && account.notificationPreferences.email === true,
      preferences,
      tourState: (await db.collection("users").doc(account.uid).collection("guide").doc("state").get()).data()?.tourState ?? "unseen",
      releaseHintDismissed: (await db.collection("users").doc(account.uid).collection("guide").doc("state").get()).data()?.releaseHintDismissed === GUIDE_RELEASE_HINT,
      recentConversation,
      contextUpdatedAt: typeof session.updatedAt === "string" ? session.updatedAt : account.lastSeenAt,
    },
  };
}

function guidePreviewContext(preview: BoardSignalBetaPreview, request?: Record<string, unknown>): GuideContext["previewContext"] {
  const primary = preview.pools.find((pool) => pool.pool === preview.primaryPool) ?? preview.pools[0];
  return {
    canonicalUsername: preview.canonicalUsername, playableWeek: preview.playableWeek, periodLabel: preview.period?.label, disclosure: preview.period?.disclosure,
    games: preview.games, wins: preview.wins, draws: preview.draws, losses: preview.losses, score: preview.score, primaryPool: preview.primaryPool, primaryPoolDelta: primary?.ratingDelta,
    strongestWinRun: preview.strongestWinRun, safeHeadline: preview.safeHeadline, safeHighlight: preview.safeHighlight, generatedAt: preview.generatedAt,
    universePreview: preview.universePreview.map((item) => ({ categoryTitle: item.categoryTitle, scopeLabel: item.scopeLabel, rank: item.rank, denominator: item.denominator, valueLabel: item.valueLabel, nearestAbove: item.nearestAbove })),
    activationReturnMethod: ["device", "email", "discord", "telegram", "return_here"].includes(String(request?.activationReturnMethod ?? "")) ? request?.activationReturnMethod as "device" | "email" | "discord" | "telegram" | "return_here" : undefined,
    deviceAlertsEnabled: Boolean((request?.activationDevice as Record<string, unknown> | undefined)?.registeredAt),
  };
}

export async function guideResponse(input: { token?: DecodedIdToken; message?: unknown; pathname?: unknown; activeTab?: unknown; visibleEntityId?: unknown; recentConversation?: unknown; mode?: unknown; previewRequestId?: unknown; previewStatusToken?: unknown }) : Promise<GuideResponse> {
  const message = safeText(input.message, MAX_MESSAGE);
  const pathname = safePath(input.pathname);
  const activeTab = safeActiveTab(input.activeTab);
  const visibleEntityId = safeVisibleEntityId(input.visibleEntityId);
  const recentConversation = sanitizeGuideConversation(input.recentConversation);
  if (!input.token) {
    if (input.mode === "beta_preview") {
      const requestId = safeText(input.previewRequestId, 180);
      const verified = await verifyBetaPreviewStatusCredential(requestId, input.previewStatusToken);
      const preview = verified.request.previewSnapshot as BoardSignalBetaPreview | undefined;
      if (!preview) throw Object.assign(new Error("This BoardSignal preview is not ready yet."), { status: 409 });
      const context: GuideContext = { authenticated: false, mode: "beta_preview", previewContext: guidePreviewContext(preview, verified.request), pathname, activeTab: "beta-request", recentConversation, deliveryStatus: getBoardSignalDeliveryStatus(), contextUpdatedAt: preview.generatedAt };
      return deterministicGuideRenderer.render(runGuideBrain(message, context));
    }
    const context: GuideContext = { authenticated: false, pathname, activeTab, recentConversation, deliveryStatus: getBoardSignalDeliveryStatus() };
    return deterministicGuideRenderer.render(runGuideBrain(message, context));
  }
  const { account, context } = await buildAuthenticatedContext(input.token, pathname, activeTab, message, visibleEntityId, recentConversation);
  const brain = runGuideBrain(message, context);
  const response = deterministicGuideRenderer.render(brain);
  await recordGuideInteraction(account, response.category ?? "general", brain.intent, message);
  return response;
}

async function recordGuideInteraction(account: BoardSignalAccount, category: GuideQuestionCategory, topic: string, message: string) {
  const db = getAdminDb();
  const memory = boundedGuideMemory(await loadGuideMemory(account.uid), topic, category === "general" ? undefined : category);
  const sentiment = expressedSentiment(message);
  const updatedAt = nowIso();
  const next = clean({ ...memory, ...(sentiment ? { recentSentiment: sentiment, recentSentimentAt: updatedAt } : {}), updatedAt });
  await Promise.all([
    db.collection("users").doc(account.uid).collection("guide").doc("memory").set(next, { merge: true }),
    incrementGuideAnalytics(category),
  ]).catch(() => undefined);
}

async function incrementGuideAnalytics(category: GuideQuestionCategory) {
  const period = new Date().toISOString().slice(0, 10);
  await getAdminDb().collection("guideAnalytics").doc(period).set({
    period,
    usage: FieldValue.increment(1),
    categories: { [category]: FieldValue.increment(1) },
    updatedAt: nowIso(),
  }, { merge: true });
}

export async function getGuideProfileState(token: DecodedIdToken) {
  const account = await accountForToken(token);
  const [preferences, state] = await Promise.all([
    loadGuidePreferences(account.uid),
    getAdminDb().collection("users").doc(account.uid).collection("guide").doc("state").get(),
  ]);
  return { preferences, tourState: state.data()?.tourState ?? "unseen", releaseHintDismissed: state.data()?.releaseHintDismissed === GUIDE_RELEASE_HINT };
}

export async function saveGuidePreference(token: DecodedIdToken, input: { confirmed?: unknown; preferredTone?: unknown; preferredDetailLevel?: unknown; preferredAddress?: unknown }) {
  if (input.confirmed !== true) throw Object.assign(new Error("Guide preference changes require explicit confirmation."), { status: 400 });
  const account = await accountForToken(token);
  const current = await loadGuidePreferences(account.uid);
  const preferredTone = typeof input.preferredTone === "string" && TONES.has(input.preferredTone as GuideTone) ? input.preferredTone as GuideTone : current.preferredTone;
  const preferredDetailLevel = typeof input.preferredDetailLevel === "string" && DETAILS.has(input.preferredDetailLevel as GuideDetailLevel) ? input.preferredDetailLevel as GuideDetailLevel : current.preferredDetailLevel;
  const preferredAddress = safeText(input.preferredAddress, 60) || current.preferredAddress;
  const next: GuidePreferences = { ...current, preferredTone, preferredDetailLevel, preferredAddress, lastExplicitToneFeedback: `Confirmed ${preferredTone}`, updatedAt: nowIso() };
  await getAdminDb().collection("users").doc(account.uid).collection("guide").doc("profile").set(clean(next), { merge: true });
  return next;
}

export async function updateGuideState(token: DecodedIdToken, input: { confirmed?: unknown; tourState?: unknown; releaseHint?: unknown }) {
  if (input.confirmed !== true) throw Object.assign(new Error("This guide action requires explicit confirmation."), { status: 400 });
  const account = await accountForToken(token);
  const data: Record<string, unknown> = { updatedAt: nowIso() };
  if (["completed", "dismissed"].includes(String(input.tourState))) data.tourState = String(input.tourState);
  if (input.releaseHint === "dismiss") data.releaseHintDismissed = GUIDE_RELEASE_HINT;
  await getAdminDb().collection("users").doc(account.uid).collection("guide").doc("state").set(data, { merge: true });
  return data;
}

export async function recordGuideFeedback(token: DecodedIdToken, input: { helpful?: unknown; category?: unknown; note?: unknown }) {
  const account = await accountForToken(token);
  const id = randomUUID();
  const helpful = input.helpful === true ? true : input.helpful === false ? false : undefined;
  await getAdminDb().collection("users").doc(account.uid).collection("guideFeedback").doc(id).set(clean({
    id, userId: account.uid, helpful, category: safeText(input.category, 60) || "general", note: safeText(input.note, 500) || undefined, createdAt: nowIso(),
  }));
  await getAdminDb().collection("guideAnalytics").doc(new Date().toISOString().slice(0, 10)).set({ feedback: FieldValue.increment(1), updatedAt: nowIso() }, { merge: true }).catch(() => undefined);
  return { id };
}

export async function createGuideHandoff(token: DecodedIdToken, input: { confirmed?: unknown; message?: unknown; pathname?: unknown; activeTab?: unknown; category?: unknown; errorCode?: unknown }) {
  if (input.confirmed !== true) throw Object.assign(new Error("Message Ayanda requires explicit confirmation."), { status: 400 });
  const account = await accountForToken(token);
  const body = safeText(input.message, MAX_SUPPORT_MESSAGE) || "I need help with BoardSignal.";
  const pathname = safePath(input.pathname);
  const activeTab = safeActiveTab(input.activeTab);
  const category = safeText(input.category, 60) || "support_request";
  const errorCode = safeText(input.errorCode, 80) || undefined;
  const db = getAdminDb();
  const threadId = `guide_${randomUUID()}`;
  const messageId = randomUUID();
  const createdAt = nowIso();
  const latestDesk = (await loadPublishedDesks(account.uid).catch(() => []))[0];
  const contextLines = [
    `Player: ${account.chessCom.canonicalUsername}`,
    `Page: ${pathname}${activeTab ? ` / ${activeTab}` : ""}`,
    `Latest completed Review: ${latestDesk?.summary.periodLabel ?? "none"}`,
    `Current episode: ${account.currentEpisodeSummary?.status ?? "unknown"}${account.currentEpisodeSummary?.games !== undefined ? ` · ${account.currentEpisodeSummary.games} games` : ""}`,
    `Category: ${category}`,
    ...(errorCode ? [`Error code: ${errorCode}`] : []),
  ];
  const founderBody = `${body}\n\nContext:\n${contextLines.join("\n")}`;
  const threadRef = db.collection("users").doc(account.uid).collection("conversations").doc(threadId);
  await threadRef.set({ id: threadId, userId: account.uid, title: "Ask BoardSignal support", allowReply: true, createdAt, updatedAt: createdAt, unreadForFounder: true, lastSenderType: "player", source: "ask_boardsignal", supportCategory: category });
  const message: BoardSignalConversationMessage = { id: messageId, userId: account.uid, threadId, body: founderBody, senderType: "player", createdAt };
  await threadRef.collection("messages").doc(messageId).set(message);
  await db.collection("users").doc(account.uid).collection("guide").doc("memory").set({ recentSupportIssue: category, unresolvedQuestion: body, updatedAt: createdAt }, { merge: true });
  return { threadId, messageId };
}

export async function founderGuideSummary() {
  const db = getAdminDb();
  const [users, analytics] = await Promise.all([
    db.collection("users").get(),
    db.collection("guideAnalytics").orderBy("period", "desc").limit(14).get().catch(() => ({ docs: [] })),
  ]);
  const accounts = users.docs.map((doc) => doc.data() as BoardSignalAccount).filter((account) => account.role === "player" && account.accessStatus === "active");
  const relationshipPulse = [] as Array<Record<string, unknown>>;
  let unresolvedSupport = 0;
  let feedbackCount = 0;
  for (const account of accounts) {
    const [memoryDoc, prefDoc, feedback, threads] = await Promise.all([
      db.collection("users").doc(account.uid).collection("guide").doc("memory").get(),
      db.collection("users").doc(account.uid).collection("guide").doc("profile").get(),
      db.collection("users").doc(account.uid).collection("guideFeedback").limit(20).get(),
      db.collection("users").doc(account.uid).collection("conversations").where("unreadForFounder", "==", true).get(),
    ]);
    const memory = memoryDoc.data() as GuideConversationMemory | undefined;
    const prefs = { ...DEFAULT_GUIDE_PREFERENCES, ...(prefDoc.data() as Partial<GuidePreferences> | undefined) };
    const now = Date.now();
    feedbackCount += feedback.docs.filter((doc) => now - Date.parse(String(doc.data().createdAt ?? "")) < 14 * 24 * 60 * 60 * 1000).length;
    const openAskThreads = threads.docs.filter((doc) => doc.data().source === "ask_boardsignal");
    unresolvedSupport += openAskThreads.length;
    const hasRecentSentiment = Boolean(memory?.recentSentimentAt) && now - Date.parse(String(memory?.recentSentimentAt)) < 14 * 24 * 60 * 60 * 1000;
    if (memory?.updatedAt || memory?.recentSupportIssue || memory?.productSignals?.length) relationshipPulse.push({
      username: account.chessCom.canonicalUsername,
      expressedSentiment: hasRecentSentiment ? memory?.recentSentiment ?? "neutral" : "neutral",
      engagement: account.lastSeenAt && now - Date.parse(account.lastSeenAt) < 7 * 24 * 60 * 60 * 1000 ? "active" : "quiet recently",
      oftenAsksAbout: (memory.productSignals ?? []).slice(0, 3),
      preferredCommunication: `${prefs.preferredTone} / ${prefs.preferredDetailLevel}`,
      openSupportIssue: openAskThreads.length ? memory?.recentSupportIssue ?? "Open Ask BoardSignal handoff" : "None",
      lastAskBoardSignalInteraction: memory.recentTopics?.[0] ?? "None",
      recommendedFounderContext: memory.productSignals?.[0] ? `Player has recently asked about ${memory.productSignals[0].replaceAll("_", " ")}.` : "No specific product context recorded.",
    });
  }
  const categories: Record<string, number> = {};
  let usage = 0;
  for (const doc of analytics.docs) {
    const data = doc.data() as { usage?: number; categories?: Record<string, number> };
    usage += Number(data.usage ?? 0);
    for (const [key, value] of Object.entries(data.categories ?? {})) categories[key] = (categories[key] ?? 0) + Number(value ?? 0);
  }
  return {
    usage,
    topQuestionCategories: Object.entries(categories).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([category, count]) => ({ category, count })),
    unresolvedSupportHandoffs: unresolvedSupport,
    recentFeedbackCount: feedbackCount,
    relationshipPulse: relationshipPulse.slice(0, 12),
  };
}
