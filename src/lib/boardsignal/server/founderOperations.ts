import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { BoardSignalAccount, BoardSignalFounderContactMethod } from "../account";
import { originalBetaSourceInventory } from "../../../data/originalBetaHistory";
import {
  deriveFounderOperation,
  resolveOriginalBetaSourcePlayerKey,
  summarizeValidationEvidence,
  type FounderOperationComparableRow,
  type ValidationEvidence,
  type ValidationIdentityAlias,
  type ValidationOriginalProvenance,
} from "../founderOperationsLogic";
import { getAdminDb } from "../../../utils/firebaseAdmin";
import { inspectSafePublicCoverageForAccount } from "./publicCoverageRepair";

const MAX_ACTIVE_REVIEWS = 4;

type OriginalBetaMarker = { periodStart?: string; periodEnd?: string; retiredAt?: string };
type OperationsAccount = BoardSignalAccount & {
  originalBetaPlayer?: boolean;
  originalBetaHistoryPeriods?: Record<string, OriginalBetaMarker>;
};

type StoredReview = {
  deskKey?: string;
  periodEnd?: string;
  publishedAt?: string;
  summary?: { deskKey?: string; periodStart?: string; periodEnd?: string; periodLabel?: string };
  desk?: { source?: string; provenance?: { verified?: boolean } };
  originalBeta?: { seedHandle?: string; history?: { periodStart?: string; periodEnd?: string; periodLabel?: string } };
};

type PendingRequest = {
  id: string;
  chessPlayerId?: number;
  canonicalUsername?: string;
  preferredContactMethod?: string;
  preferredContactValue?: string;
  requestedAt?: string;
  status?: string;
  profileUrl?: string;
};

type ExceptionRow = { id: string; uid?: string; username?: string; title?: string; message?: string; createdAt?: string; resolvedAt?: string };

export type FounderOperationsRow = FounderOperationComparableRow & {
  playerId?: number;
  profileUrl?: string;
  avatar?: string;
  accountStatus?: string;
  identityStatus?: string;
  identityReviewStatus?: string;
  publicHighlightsStatus?: string;
  preferredContactMethod?: string;
  preferredContactValue?: string;
  latestReview?: { periodStart?: string; periodEnd?: string; periodLabel?: string; publishedAt?: string };
  reviewPeriods: Array<{ periodStart: string; periodEnd: string; periodLabel?: string; source: "original" | "live" }>;
  lastContactedAt?: string;
  lastContactMethod?: BoardSignalFounderContactMethod;
  followUpSnoozedUntil?: string;
  pendingRequestId?: string;
  exceptionTitles: string[];
  accessStatus?: string;
};

function normalize(value?: string) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

function validPeriod(data: StoredReview) {
  const history = data.originalBeta?.history;
  const start = history?.periodStart ?? data.summary?.periodStart;
  const end = history?.periodEnd ?? data.summary?.periodEnd ?? data.periodEnd;
  if (!start || !end) return undefined;
  const source = history ? "original" as const : data.desk?.source === "live" && data.desk?.provenance?.verified ? "live" as const : undefined;
  if (!source) return undefined;
  return { periodStart: start, periodEnd: end, periodLabel: history?.periodLabel ?? data.summary?.periodLabel, source };
}

function identityConflict(account: OperationsAccount) {
  return account.identityStatus === "revoked" || account.identityReviewStatus === "rejected";
}

async function playerSnapshot(account: OperationsAccount) {
  const db = getAdminDb();
  const [desks, unread, publicHighlights] = await Promise.all([
    db.collection("users").doc(account.uid).collection("desks").orderBy("periodEnd", "desc").limit(MAX_ACTIVE_REVIEWS).get(),
    db.collection("users").doc(account.uid).collection("conversations").where("unreadForFounder", "==", true).get().catch(() => ({ size: 0 })),
    inspectSafePublicCoverageForAccount(account).catch(() => undefined),
  ]);
  const documents = desks.docs.map((document) => ({ id: document.id, data: document.data() as StoredReview }));
  const verifiedDocuments = documents.flatMap(({ data }) => {
    const period = validPeriod(data);
    return period ? [{ data, period }] : [];
  });
  const verified = verifiedDocuments.map(({ period }) => period);
  const latestVerified = verifiedDocuments[0];
  const originalBetaProvenance: ValidationOriginalProvenance[] = verifiedDocuments.flatMap(({ data, period }) => data.originalBeta?.seedHandle ? [{
    uid: account.uid,
    playerId: account.chessCom.playerId,
    seedHandle: data.originalBeta.seedHandle,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  }] : []);
  return {
    account,
    verified,
    originalBetaProvenance,
    latestReview: latestVerified ? {
      periodStart: latestVerified.period.periodStart,
      periodEnd: latestVerified.period.periodEnd,
      periodLabel: latestVerified.period.periodLabel,
      publishedAt: latestVerified.data.publishedAt,
    } : undefined,
    unreadReplies: Number((unread as { size?: number }).size ?? 0),
    unreadReplyAt: ((unread as { docs?: Array<{ data(): { updatedAt?: string } }> }).docs ?? []).map((document) => document.data().updatedAt).filter((value): value is string => Boolean(value)).sort()[0],
    publicHighlights,
  };
}

export async function founderOperationsSnapshot(now = new Date()) {
  const db = getAdminDb();
  const originalSources = originalBetaSourceInventory();
  const aliasLookups = Promise.all(originalSources.map(async (entry): Promise<ValidationIdentityAlias | undefined> => {
    const snapshot = await db.collection("playerIdentityAliases").doc(entry.normalizedHandle).get();
    if (!snapshot.exists) return undefined;
    const data = snapshot.data();
    const playerId = Number(data?.playerId);
    return {
      normalizedHandle: entry.normalizedHandle,
      uid: typeof data?.uid === "string" ? data.uid : undefined,
      playerId: Number.isSafeInteger(playerId) && playerId > 0 ? playerId : undefined,
    };
  }));
  const [users, requestSnapshot, exceptionSnapshot, aliasResults] = await Promise.all([
    db.collection("users").get(),
    db.collection("betaRequests").get(),
    db.collection("exceptions").orderBy("createdAt", "desc").limit(100).get().catch(() => ({ docs: [] })),
    aliasLookups,
  ]);
  const identityAliases = aliasResults.filter((alias): alias is ValidationIdentityAlias => Boolean(alias));
  const accounts = users.docs.map((document) => document.data() as OperationsAccount).filter((account) => account.role === "player");
  const activeAccounts = accounts.filter((account) => account.accessTier === "founding_beta" && account.accessStatus === "active");
  const pendingRequests = requestSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() } as PendingRequest))
    .filter((request) => request.status === "pending")
    .sort((a, b) => String(b.requestedAt ?? "").localeCompare(String(a.requestedAt ?? "")));
  const exceptions = exceptionSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() } as ExceptionRow))
    .filter((item) => !item.resolvedAt);

  const snapshots = await Promise.all(accounts.map((account) => playerSnapshot(account)));
  const activeIds = new Set(activeAccounts.map((account) => account.uid));
  const pendingByPlayer = new Map<string, PendingRequest>();
  for (const request of pendingRequests) {
    if (request.chessPlayerId) pendingByPlayer.set(`id:${request.chessPlayerId}`, request);
    if (request.canonicalUsername) pendingByPlayer.set(`name:${normalize(request.canonicalUsername)}`, request);
  }
  const exceptionsByUid = new Map<string, ExceptionRow[]>();
  const exceptionsByName = new Map<string, ExceptionRow[]>();
  for (const item of exceptions) {
    if (item.uid) exceptionsByUid.set(item.uid, [...(exceptionsByUid.get(item.uid) ?? []), item]);
    if (item.username) {
      const key = normalize(item.username);
      exceptionsByName.set(key, [...(exceptionsByName.get(key) ?? []), item]);
    }
  }

  const rows: FounderOperationsRow[] = snapshots.filter((snapshot) => activeIds.has(snapshot.account.uid)).map((snapshot) => {
    const account = snapshot.account;
    const pending = pendingByPlayer.get(`id:${account.chessCom.playerId}`) ?? pendingByPlayer.get(`name:${normalize(account.chessCom.canonicalUsername)}`);
    const playerExceptions = [
      ...(exceptionsByUid.get(account.uid) ?? []),
      ...(exceptionsByName.get(normalize(account.chessCom.canonicalUsername)) ?? []),
    ].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
    const derived = deriveFounderOperation({
      uid: account.uid,
      username: account.chessCom.canonicalUsername,
      preferredContactValue: account.preferredContactValue,
      lastSeenAt: account.lastSeenAt,
      nextDeskDueAt: account.nextDeskDueAt ?? account.currentEpisodeSummary?.nextDeskDueAt,
      forming: account.currentEpisodeSummary?.status === "forming",
      latestReview: snapshot.latestReview,
      unreadReplies: snapshot.unreadReplies,
      unreadReplyAt: snapshot.unreadReplyAt,
      pendingRequest: Boolean(pending),
      pendingRequestAt: pending?.requestedAt,
      exceptionAt: playerExceptions.map((item) => item.createdAt).filter((value): value is string => Boolean(value)).sort()[0],
      exceptionCount: playerExceptions.length,
      identityConflict: identityConflict(account),
      founderOps: account.founderOps,
    }, now);
    return {
      ...derived,
      uid: account.uid,
      username: account.chessCom.canonicalUsername,
      playerId: account.chessCom.playerId,
      profileUrl: account.chessCom.profileUrl || `https://www.chess.com/member/${encodeURIComponent(account.chessCom.canonicalUsername)}`,
      avatar: account.chessCom.avatar,
      reviewCount: snapshot.verified.length,
      reviewPeriods: snapshot.verified,
      latestReview: snapshot.latestReview,
      nextDeskDueAt: account.nextDeskDueAt ?? account.currentEpisodeSummary?.nextDeskDueAt,
      lastSeenAt: account.lastSeenAt,
      unreadReplies: snapshot.unreadReplies,
      exceptionCount: playerExceptions.length,
      exceptionTitles: playerExceptions.map((item) => item.title ?? item.message ?? "BoardSignal exception"),
      identityConflict: identityConflict(account),
      pendingRequest: Boolean(pending),
      pendingRequestId: pending?.id,
      forming: account.currentEpisodeSummary?.status === "forming",
      preferredContactMethod: account.preferredContactMethod,
      preferredContactValue: account.preferredContactValue,
      accountStatus: account.accessStatus,
      accessStatus: account.accessStatus,
      identityStatus: account.identityStatus,
      identityReviewStatus: account.identityReviewStatus,
      publicHighlightsStatus: snapshot.publicHighlights?.status ?? (snapshot.verified.length ? "status unavailable" : "no_completed_review"),
      lastContactedAt: account.founderOps?.lastContactedAt,
      lastContactMethod: account.founderOps?.lastContactMethod,
      followUpSnoozedUntil: account.founderOps?.followUpSnoozedUntil,
    };
  });

  const representedPending = new Set(rows.flatMap((row) => row.pendingRequestId ? [row.pendingRequestId] : []));
  for (const request of pendingRequests.filter((item) => !representedPending.has(item.id))) {
    const derived = deriveFounderOperation({
      uid: `request:${request.id}`,
      username: request.canonicalUsername ?? "Pending player",
      preferredContactValue: request.preferredContactValue,
      pendingRequest: true,
      pendingRequestAt: request.requestedAt,
    }, now);
    rows.push({
      ...derived,
      uid: `request:${request.id}`,
      username: request.canonicalUsername ?? "Pending player",
      playerId: request.chessPlayerId,
      profileUrl: request.profileUrl ?? (request.canonicalUsername ? `https://www.chess.com/member/${encodeURIComponent(request.canonicalUsername)}` : undefined),
      reviewCount: 0,
      reviewPeriods: [],
      unreadReplies: 0,
      exceptionCount: 0,
      exceptionTitles: [],
      identityConflict: false,
      pendingRequest: true,
      pendingRequestId: request.id,
      forming: false,
      preferredContactMethod: request.preferredContactMethod,
      preferredContactValue: request.preferredContactValue,
    });
  }

  const evidence: ValidationEvidence[] = [];
  const reconciledOriginalProvenance = snapshots.flatMap((snapshot) => snapshot.originalBetaProvenance);
  for (const entry of originalSources) {
    evidence.push({
      playerKey: resolveOriginalBetaSourcePlayerKey(entry, accounts, identityAliases, reconciledOriginalProvenance),
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      source: "original",
    });
  }
  for (const snapshot of snapshots) {
    const playerKey = `id:${snapshot.account.chessCom.playerId}`;
    for (const review of snapshot.verified) evidence.push({ playerKey, periodStart: review.periodStart, periodEnd: review.periodEnd, source: review.source });
  }
  const originalToLive = activeAccounts.filter((account) => account.originalBetaPlayer || Object.keys(account.originalBetaHistoryPeriods ?? {}).length > 0).map((account) => `id:${account.chessCom.playerId}`);
  const validation = {
    ...summarizeValidationEvidence(evidence, originalToLive),
    dataCompleteness: "Verified Reviews counts durable evidence currently reconstructable from active Review storage plus Original Beta source history. BoardSignal retains at most four active Review records per account, so older digital Reviews may have legitimately expired and are not fabricated into lifetime totals.",
  };

  const metrics = {
    activePlayers: activeAccounts.length,
    reviewsForming: rows.filter((row) => row.forming).length,
    reviewsReady: rows.filter((row) => row.readyNotSeen).length,
    followUpsDue: rows.filter((row) => row.followUpStatus === "due").length,
    notSeenRecently: rows.filter((row) => row.notSeenRecently && !row.uid.startsWith("request:")).length,
    unreadReplies: rows.reduce((sum, row) => sum + row.unreadReplies, 0),
  };
  const attention = {
    newRequests: pendingRequests.length,
    followUpsDue: metrics.followUpsDue,
    unreadReplies: metrics.unreadReplies,
    exceptions: rows.filter((row) => row.exceptionCount > 0 || row.reviewCheckRequired).length,
    identityConflicts: rows.filter((row) => row.identityConflict).length,
  };
  return { generatedAt: now.toISOString(), attention, metrics, validation, rows };
}

async function accountForFounderOps(uidInput: unknown) {
  const uid = String(uidInput ?? "").trim();
  if (!uid || uid.startsWith("request:") || uid.includes("/")) throw Object.assign(new Error("A valid BoardSignal player is required."), { status: 400 });
  const ref = getAdminDb().collection("users").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The BoardSignal player account was not found."), { status: 404 });
  const account = snapshot.data() as OperationsAccount;
  if (account.role !== "player") throw Object.assign(new Error("The BoardSignal player account was not found."), { status: 404 });
  return { ref, account };
}

export async function markFounderContacted(uidInput: unknown, methodInput: unknown, now = new Date()) {
  const method = String(methodInput ?? "") as BoardSignalFounderContactMethod;
  if (!["email", "discord", "telegram", "chesscom", "other"].includes(method)) throw Object.assign(new Error("Choose a valid contact method."), { status: 400 });
  const { ref, account } = await accountForFounderOps(uidInput);
  const founderOps = { ...(account.founderOps ?? {}), lastContactedAt: now.toISOString(), lastContactMethod: method };
  await ref.set({ founderOps }, { merge: true });
  return founderOps;
}

export async function snoozeFounderFollowUp(uidInput: unknown, daysInput: unknown, now = new Date()) {
  const days = Number(daysInput);
  if (![1, 3, 7].includes(days)) throw Object.assign(new Error("Choose a 1, 3, or 7 day snooze."), { status: 400 });
  const { ref, account } = await accountForFounderOps(uidInput);
  const founderOps = { ...(account.founderOps ?? {}), followUpSnoozedUntil: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString() };
  await ref.set({ founderOps }, { merge: true });
  return founderOps;
}

export async function clearFounderFollowUpSnooze(uidInput: unknown) {
  const { ref } = await accountForFounderOps(uidInput);
  await ref.update({ "founderOps.followUpSnoozedUntil": FieldValue.delete() });
  return { cleared: true };
}
