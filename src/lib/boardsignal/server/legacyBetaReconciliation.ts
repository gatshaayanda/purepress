import "server-only";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { BoardSignalAccount, StableChessComIdentity } from "../account";
import { firebaseUidForChessPlayer } from "../account";
import { retainLatestFour } from "../memory";
import type { CompletedReviewHistoryItem } from "../reviewHistory";
import type { UniverseParticipant } from "../universe";
import {
  findOriginalBetaSource,
  originalBetaHistoryItem,
  originalBetaReviewKey,
  originalBetaSourceInventory,
  originalBetaUniverseParticipant,
  type OriginalBetaSourceEntry,
  type OriginalBetaSourceRichness,
} from "../../../data/originalBetaHistory";
import { resolveChessComPlayer } from "../processor";
import { getAdminDb } from "../../../utils/firebaseAdmin";
import { betaMagicAccessCredential } from "./activation";
import { regenerateFoundingBetaMagicAccess } from "./betaRequests";
import { ensureStablePlayerAccount } from "./persistence";

const REVIEW_KIND = "original_beta_review_v1" as const;
const RICHNESS_RANK: Record<OriginalBetaSourceRichness | "LIVE_DESK", number> = {
  NARROW_SEED: 1,
  STRUCTURED_REVIEW: 2,
  FULL_DESK: 3,
  LIVE_DESK: 4,
};

export type OriginalBetaReconciliationStatus =
  | "SEED ONLY"
  | "LIVE · HISTORY MISSING"
  | "LIVE · RECONCILED"
  | "IDENTITY CHECK REQUIRED";

export type OriginalBetaCohort =
  | "A · SEED + EXISTING LIVE ACCOUNT"
  | "B · SEED ONLY"
  | "C · SEED + IDENTITY CONFLICT";

export type OriginalBetaInventoryRow = {
  handle: string;
  periodStart: string;
  periodEnd: string;
  games: number;
  record: string;
  sourceRichness: OriginalBetaSourceRichness;
  liveAccountStatus: "NONE" | "EXISTS";
  historicalReviewStatus: "MISSING" | "PRESENT" | "RETIRED";
  identityStatus?: string;
  identityReviewStatus?: string;
  legacyBetaAccessStatus?: "ACTIVE" | "REVOKED" | "MISSING" | "UNKNOWN";
  cohort: OriginalBetaCohort;
  seedReviewCount: number;
  liveCompletedReviewCount: number;
  storedCompletedReviewCount: number;
  missingHistoricalPeriods: string[];
  reconciledTotal: number;
  status: OriginalBetaReconciliationStatus;
  playerId?: number;
  uid?: string;
  canonicalUsername?: string;
  cadenceCompatible?: boolean;
  accessReady?: boolean;
  conflict?: string;
};

export type OriginalBetaReconcileSummary = {
  seededPlayersChecked: number;
  liveAccountsMatched: number;
  historicalReviewsAttached: number;
  historicalReviewsUpgraded: number;
  alreadyReconciled: number;
  retiredByRetention: number;
  seedOnly: number;
  identityConflicts: number;
  errors: Array<{ handle: string; error: string }>;
};

type OriginalBetaMarker = {
  periodStart: string;
  periodEnd: string;
  sourceRichness: OriginalBetaSourceRichness;
  reconciledAt: string;
  retiredAt?: string;
};

type OriginalBetaAccountData = BoardSignalAccount & {
  originalBetaPlayer?: boolean;
  originalBetaHistoryPeriods?: Record<string, OriginalBetaMarker>;
  personalRecords?: {
    desksCompleted: number;
    personalBestWinRun: number;
    largestPoolSpecificRatingClimb: Partial<Record<string, number>>;
    [key: string]: unknown;
  };
};

type StoredOriginalBetaReview = {
  recordKind: typeof REVIEW_KIND;
  deskKey: string;
  periodEnd: string;
  summary: {
    deskKey: string;
    periodStart: string;
    periodEnd: string;
    periodLabel: string;
  };
  originalBeta: {
    seedHandle: string;
    caseId: string;
    sourceRichness: OriginalBetaSourceRichness;
    sourceLabel: string;
    history: CompletedReviewHistoryItem;
    universeParticipant: UniverseParticipant;
    canonicalDesk?: unknown;
  };
  reconciledAt: string;
};

type LiveMatch = {
  account?: OriginalBetaAccountData;
  conflict?: string;
  identityVerified?: boolean;
};

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function safeDocumentId(value: string) {
  return value.replaceAll("/", "_").slice(0, 700);
}

function markerKey(entry: Pick<OriginalBetaSourceEntry, "periodStart" | "periodEnd">) {
  return `${entry.periodStart.replaceAll("-", "")}_${entry.periodEnd.replaceAll("-", "")}`;
}

function periodFromStored(data: Record<string, any>) {
  const start = data.summary?.periodStart ?? data.desk?.period?.start ?? data.originalBeta?.history?.periodStart;
  const end = data.summary?.periodEnd ?? data.periodEnd ?? data.desk?.period?.end ?? data.originalBeta?.history?.periodEnd;
  return typeof start === "string" && typeof end === "string" ? { start, end } : undefined;
}

function storedRichness(data: Record<string, any>): OriginalBetaSourceRichness | "LIVE_DESK" | undefined {
  if (data.desk?.source === "live" && data.desk?.provenance?.verified === true) return "LIVE_DESK";
  const richness = data.originalBeta?.sourceRichness;
  return richness === "FULL_DESK" || richness === "STRUCTURED_REVIEW" || richness === "NARROW_SEED" ? richness : undefined;
}

function samePeriod(data: Record<string, any>, entry: OriginalBetaSourceEntry) {
  const period = periodFromStored(data);
  return period?.start === entry.periodStart && period.end === entry.periodEnd;
}

function daysBetween(a: string, b: string) {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return undefined;
  return Math.round((right - left) / (24 * 60 * 60 * 1000));
}

function cadenceCompatible(entry: OriginalBetaSourceEntry, cadenceAnchor?: string) {
  if (!cadenceAnchor) return true;
  const delta = daysBetween(entry.periodStart, cadenceAnchor);
  return delta !== undefined && Math.abs(delta) % 7 === 0;
}

function identityFromResolved(resolved: Awaited<ReturnType<typeof resolveChessComPlayer>>): StableChessComIdentity {
  if (!Number.isSafeInteger(resolved.playerId) || !resolved.playerId) {
    throw Object.assign(new Error("Chess.com did not return the stable player ID required for original-beta access."), {
      status: 422,
      code: "ORIGINAL_BETA_STABLE_ID_REQUIRED",
    });
  }
  return {
    playerId: resolved.playerId,
    canonicalUsername: resolved.username,
    avatar: resolved.avatar,
    profileUrl: resolved.profileUrl,
  };
}

async function loadUserAccounts() {
  const users = await getAdminDb().collection("users").get();
  return users.docs
    .map((document) => document.data() as OriginalBetaAccountData)
    .filter((account) => account.role === "player" && Number.isSafeInteger(account.chessCom?.playerId));
}

async function resolveExistingLiveAccount(
  entry: OriginalBetaSourceEntry,
  accounts?: OriginalBetaAccountData[],
  options: { resolveStableId?: boolean } = {},
): Promise<LiveMatch> {
  const db = getAdminDb();
  const normalizedHandle = entry.normalizedHandle;
  const alias = await db.collection("playerIdentityAliases").doc(normalizedHandle).get();
  const allAccounts = accounts ?? await loadUserAccounts();

  let account: OriginalBetaAccountData | undefined;
  let identityVerified = false;

  // A known stable player ID is stronger than historical username text. This is
  // especially important for established original testers such as hxertzzz, where
  // reconciliation must find the existing deterministic account even if metadata
  // still says "legacy / status not recorded" or the username later changes.
  if (entry.stablePlayerId) {
    const stableUid = firebaseUidForChessPlayer(entry.stablePlayerId);
    const mapping = await db.collection("chessPlayerAccounts").doc(String(entry.stablePlayerId)).get();
    if (mapping.exists && String(mapping.data()?.uid ?? "") !== stableUid) {
      return { conflict: "The known original-beta Chess.com player ID maps to a different BoardSignal UID." };
    }
    const byStableId = await db.collection("users").doc(stableUid).get();
    if (byStableId.exists) {
      const candidate = byStableId.data() as OriginalBetaAccountData;
      if (candidate.uid !== stableUid || candidate.chessCom?.playerId !== entry.stablePlayerId) {
        return { conflict: "The known original-beta Chess.com player ID conflicts with the existing live account." };
      }
      account = candidate;
      identityVerified = true;
    }
  }

  if (alias.exists) {
    const aliasUid = String(alias.data()?.uid ?? "");
    const aliasPlayerId = Number(alias.data()?.playerId);
    if (!aliasUid || !Number.isSafeInteger(aliasPlayerId) || aliasPlayerId <= 0) {
      return { conflict: "The historical username alias exists but does not contain one stable player identity." };
    }
    if (entry.stablePlayerId && aliasPlayerId !== entry.stablePlayerId) {
      return { conflict: "The historical username alias conflicts with the known original-beta Chess.com player ID." };
    }
    const snapshot = await db.collection("users").doc(aliasUid).get();
    if (!snapshot.exists) return { conflict: "The historical username alias points to a missing live account." };
    const aliasAccount = snapshot.data() as OriginalBetaAccountData;
    if (aliasAccount.uid !== aliasUid || aliasAccount.chessCom?.playerId !== aliasPlayerId) {
      return { conflict: "The historical username alias conflicts with the live account's stable player ID." };
    }
    if (account && account.uid !== aliasAccount.uid) {
      return { conflict: "The known stable identity and historical username alias point to different live accounts." };
    }
    account = aliasAccount;
    identityVerified = true;
  } else if (!account) {
    const matches = allAccounts.filter((candidate) => {
      const aliases = [candidate.chessCom.canonicalUsername, ...(candidate.eligibleCoverageKeys ?? []).filter((value) => typeof value === "string")];
      return aliases.some((value) => !/^\d+$/.test(String(value)) && normalizeUsername(String(value)) === normalizedHandle);
    });
    if (matches.length > 1) return { conflict: "More than one live account matches the historical username." };
    account = matches[0];
    identityVerified = Boolean(account);
  }

  if (account && entry.stablePlayerId && account.chessCom.playerId !== entry.stablePlayerId) {
    return { conflict: "The live account matched by username does not match the known original-beta Chess.com player ID." };
  }

  if (!account && options.resolveStableId) {
    const resolved = identityFromResolved(await resolveChessComPlayer(entry.handle));
    if (entry.stablePlayerId && resolved.playerId !== entry.stablePlayerId) {
      return { conflict: "Chess.com resolved the historical username to a different stable player ID than the verified original-beta identity." };
    }
    const mapping = await db.collection("chessPlayerAccounts").doc(String(resolved.playerId)).get();
    const stableUid = firebaseUidForChessPlayer(resolved.playerId);
    const mappedUid = mapping.exists && typeof mapping.data()?.uid === "string" ? String(mapping.data()!.uid) : stableUid;
    if (mappedUid !== stableUid) {
      return { conflict: "The resolved Chess.com player ID maps to a non-deterministic BoardSignal UID." };
    }
    const byStableId = await db.collection("users").doc(stableUid).get();
    if (byStableId.exists) {
      const candidate = byStableId.data() as OriginalBetaAccountData;
      if (candidate.uid !== stableUid || candidate.chessCom?.playerId !== resolved.playerId) {
        return { conflict: "The resolved Chess.com stable ID conflicts with the existing live account." };
      }
      account = candidate;
      identityVerified = true;
    }
  }

  if (!account) return {};
  const stableUid = firebaseUidForChessPlayer(account.chessCom.playerId);
  if (account.uid !== stableUid) return { conflict: "The live account UID does not match its stable Chess.com player ID." };
  if (account.accessStatus === "deleted" || account.identityStatus === "revoked") {
    return { conflict: "This historical player matches a deleted or revoked BoardSignal identity." };
  }
  if (account.identityReviewStatus === "rejected") {
    return { conflict: "This historical player matches a live identity whose Founder review was rejected." };
  }
  const mapping = await db.collection("chessPlayerAccounts").doc(String(account.chessCom.playerId)).get();
  if (mapping.exists && String(mapping.data()?.uid ?? "") !== account.uid) {
    return { conflict: "The stable Chess.com player mapping points to another BoardSignal UID." };
  }
  const legacy = await legacyBetaAccessState(entry, account);
  if (legacy.conflict) return { conflict: legacy.conflict };
  return { account, identityVerified };
}

async function completedReviewDocuments(uid: string) {
  return (await getAdminDb().collection("users").doc(uid).collection("desks").get()).docs;
}

async function deleteDeskTree(document: QueryDocumentSnapshot) {
  const evidence = await document.ref.collection("evidence").get();
  const db = getAdminDb();
  const batch = db.batch();
  evidence.docs.forEach((item) => batch.delete(item.ref));
  batch.delete(document.ref);
  await batch.commit();
}

function reviewEntry(document: QueryDocumentSnapshot) {
  const data = document.data() as Record<string, any>;
  return {
    deskKey: String(data.deskKey ?? data.summary?.deskKey ?? document.id),
    periodEnd: String(data.periodEnd ?? data.summary?.periodEnd ?? data.desk?.period?.end ?? ""),
    document,
  };
}

async function enforceLatestFour(uid: string) {
  const documents = await completedReviewDocuments(uid);
  const entries = documents.map(reviewEntry).filter((entry) => Boolean(entry.periodEnd));
  const retention = retainLatestFour(entries);
  for (const removed of retention.removed) await deleteDeskTree(removed.document);
  return { retained: retention.retained, removed: retention.removed };
}

async function updateReviewCount(uid: string, retainedCount: number, history: CompletedReviewHistoryItem[]) {
  const ref = getAdminDb().collection("users").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const account = snapshot.data() as OriginalBetaAccountData;
  const existing = account.personalRecords ?? {
    desksCompleted: 0,
    personalBestWinRun: 0,
    largestPoolSpecificRatingClimb: {},
  };
  const knownRuns = history.flatMap((item) => item.longestWinRun === undefined ? [] : [item.longestWinRun]);
  await ref.set(clean({
    personalRecords: {
      ...existing,
      desksCompleted: retainedCount,
      personalBestWinRun: Math.max(existing.personalBestWinRun ?? 0, ...knownRuns, 0),
    },
  }), { merge: true });
}

function recordFor(entry: OriginalBetaSourceEntry, account: OriginalBetaAccountData, now: string): StoredOriginalBetaReview {
  const history = originalBetaHistoryItem(entry, account.chessCom.playerId);
  const deskKey = originalBetaReviewKey(account.chessCom.playerId, entry);
  return {
    recordKind: REVIEW_KIND,
    deskKey,
    periodEnd: entry.periodEnd,
    summary: {
      deskKey,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      periodLabel: entry.period,
    },
    originalBeta: {
      seedHandle: entry.handle,
      caseId: entry.caseId,
      sourceRichness: entry.sourceRichness,
      sourceLabel: entry.sourceLabel,
      history,
      universeParticipant: originalBetaUniverseParticipant(entry, account.chessCom),
      ...(entry.canonicalDesk ? { canonicalDesk: entry.canonicalDesk } : {}),
    },
    reconciledAt: now,
  };
}

async function retainedHistory(uid: string): Promise<CompletedReviewHistoryItem[]> {
  const documents = await completedReviewDocuments(uid);
  return documents.flatMap((document) => {
    const data = document.data() as Record<string, any>;
    if (data.originalBeta?.history) return [data.originalBeta.history as CompletedReviewHistoryItem];
    if (data.summary && data.desk) {
      const summary = data.summary;
      return [{
        reviewKey: String(data.deskKey ?? summary.deskKey ?? document.id),
        periodStart: String(summary.periodStart ?? data.desk.period?.start ?? ""),
        periodEnd: String(summary.periodEnd ?? data.periodEnd ?? data.desk.period?.end ?? ""),
        periodLabel: String(summary.periodLabel ?? data.desk.period?.label ?? ""),
        source: "live" as const,
        sourceRichness: "LIVE_DESK" as const,
        provenanceLabel: String(data.desk.provenance?.sourceLabel ?? "Verified LIVE BoardSignal Desk"),
        games: Number(summary.games ?? data.desk.games ?? 0),
        wins: Number(summary.wins ?? data.desk.wins ?? 0),
        draws: Number(summary.draws ?? data.desk.draws ?? 0),
        losses: Number(summary.losses ?? data.desk.losses ?? 0),
        scorePct: Number(summary.scorePct ?? data.desk.score ?? 0),
        headline: String(data.desk.headline ?? "Completed Review"),
        pools: Array.isArray(summary.pools) ? summary.pools : [],
        longestWinRun: typeof summary.longestWinRun === "number" ? summary.longestWinRun : undefined,
        longestLossRun: typeof summary.longestLossRun === "number" ? summary.longestLossRun : undefined,
        signalFamilies: summary.signalFamilies ?? {},
      } satisfies CompletedReviewHistoryItem];
    }
    return [];
  }).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, 4);
}

async function legacyBetaAccessState(entry: OriginalBetaSourceEntry, account: OriginalBetaAccountData) {
  if (entry.stablePlayerId && entry.stablePlayerId !== account.chessCom.playerId) {
    return { status: "UNKNOWN" as const, conflict: "The verified original-beta player ID does not match this live account." };
  }
  const snapshot = await getAdminDb().collection("betaAccess").doc(String(account.chessCom.playerId)).get();
  if (!snapshot.exists) return { status: "MISSING" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const recordPlayerId = Number(data.playerId);
  if (!Number.isSafeInteger(recordPlayerId) || recordPlayerId !== account.chessCom.playerId) {
    return { status: "UNKNOWN" as const, conflict: "The legacy Beta Access record conflicts with the live account's stable Chess.com player ID." };
  }
  const status = String(data.status ?? "").toLowerCase();
  if (status === "active") return { status: "ACTIVE" as const };
  if (status === "revoked") return { status: "REVOKED" as const };
  return { status: "UNKNOWN" as const };
}

async function normalizeEstablishedLegacyIdentity(
  entry: OriginalBetaSourceEntry,
  account: OriginalBetaAccountData,
  identityVerified: boolean,
  now: string,
) {
  const legacy = await legacyBetaAccessState(entry, account);
  if (legacy.conflict) {
    throw Object.assign(new Error(legacy.conflict), { status: 409, code: "ORIGINAL_BETA_IDENTITY_CONFLICT" });
  }
  // Historical identity metadata debt is safe to normalize only when the seed
  // identity has already resolved to this stable live account AND the legacy Beta
  // Access record for that same player ID is still active. This is metadata repair,
  // not a new approval ceremony and it never rotates credentials or sessions.
  if (!identityVerified || legacy.status !== "ACTIVE") {
    return { account, normalized: false, legacyBetaAccessStatus: legacy.status };
  }
  const mapping = await getAdminDb().collection("chessPlayerAccounts").doc(String(account.chessCom.playerId)).get();
  if (!mapping.exists) {
    return { account, normalized: false, legacyBetaAccessStatus: legacy.status };
  }
  if (String(mapping.data()?.uid ?? "") !== account.uid) {
    throw Object.assign(new Error("The stable Chess.com mapping changed while original-beta identity metadata was being reconciled."), { status: 409, code: "ORIGINAL_BETA_IDENTITY_CONFLICT" });
  }
  if (account.identityStatus === "provisional") {
    return { account, normalized: false, legacyBetaAccessStatus: legacy.status };
  }

  const statusRepairable = !account.identityStatus || account.identityStatus === "founder_reviewed" || account.identityStatus === "oauth_verified";
  const reviewRepairable = !account.identityReviewStatus || account.identityReviewStatus === "confirmed";
  if (!statusRepairable || !reviewRepairable) {
    return { account, normalized: false, legacyBetaAccessStatus: legacy.status };
  }

  const patch: Partial<OriginalBetaAccountData> = {};
  if (!account.identityStatus) patch.identityStatus = "founder_reviewed";
  if (!account.identityReviewStatus) patch.identityReviewStatus = "confirmed";
  if ((patch.identityStatus === "founder_reviewed" || account.identityStatus === "founder_reviewed") && !account.founderReviewedAt) {
    patch.founderReviewedAt = now;
  }
  if (!Object.keys(patch).length) {
    return { account, normalized: false, legacyBetaAccessStatus: legacy.status };
  }
  await getAdminDb().collection("users").doc(account.uid).set(clean(patch), { merge: true });
  return {
    account: { ...account, ...patch },
    normalized: true,
    legacyBetaAccessStatus: legacy.status,
  };
}

export async function attachOriginalBetaHistory(
  entry: OriginalBetaSourceEntry,
  account: OriginalBetaAccountData,
  options: { identityVerified?: boolean } = {},
) {
  if (account.accessStatus === "deleted" || account.identityStatus === "revoked") {
    throw Object.assign(new Error("Deleted or revoked original-beta identities cannot be reconciled automatically."), {
      status: 409,
      code: "ORIGINAL_BETA_IDENTITY_REVOKED",
    });
  }
  const db = getAdminDb();
  const userRef = db.collection("users").doc(account.uid);
  const desksRef = userRef.collection("desks");
  const key = markerKey(entry);
  const now = new Date().toISOString();
  const normalizedIdentity = await normalizeEstablishedLegacyIdentity(entry, account, options.identityVerified === true, now);
  account = normalizedIdentity.account;
  const desiredRank = RICHNESS_RANK[entry.sourceRichness];
  const marker = account.originalBetaHistoryPeriods?.[key];
  if (marker?.retiredAt) {
    return {
      action: "already_reconciled" as const,
      retired: true,
      retainedCount: (await completedReviewDocuments(account.uid)).length,
      identityNormalized: normalizedIdentity.normalized,
      legacyBetaAccessStatus: normalizedIdentity.legacyBetaAccessStatus,
    };
  }

  const documents = await completedReviewDocuments(account.uid);
  const existing = documents.find((document) => samePeriod(document.data() as Record<string, any>, entry));
  const existingRank = existing ? RICHNESS_RANK[storedRichness(existing.data() as Record<string, any>) ?? "NARROW_SEED"] : 0;
  const existingIsLive = existing && storedRichness(existing.data() as Record<string, any>) === "LIVE_DESK";
  let action: "attached" | "upgraded" | "already_reconciled" = "already_reconciled";

  if (!existingIsLive && (!existing || existingRank < desiredRank)) {
    const target = existing?.ref ?? desksRef.doc(safeDocumentId(originalBetaReviewKey(account.chessCom.playerId, entry)));
    await target.set(clean(recordFor(entry, account, now)), { merge: false });
    action = existing ? "upgraded" : "attached";
  }

  const markerRecord: OriginalBetaMarker = {
    periodStart: entry.periodStart,
    periodEnd: entry.periodEnd,
    sourceRichness: existingIsLive ? entry.sourceRichness : entry.sourceRichness,
    reconciledAt: marker?.reconciledAt ?? now,
  };
  const updatedMarkers = { ...(account.originalBetaHistoryPeriods ?? {}), [key]: markerRecord };
  const cadencePatch = !account.cadenceAnchor ? { cadenceAnchor: entry.periodStart } : {};
  await userRef.set(clean({
    originalBetaPlayer: true,
    originalBetaHistoryPeriods: updatedMarkers,
    ...cadencePatch,
  }), { merge: true });

  const retention = await enforceLatestFour(account.uid);
  const desiredKey = originalBetaReviewKey(account.chessCom.playerId, entry);
  const removedDesired = retention.removed.some((item) => item.deskKey === desiredKey || samePeriod(item.document.data() as Record<string, any>, entry));
  if (removedDesired) {
    updatedMarkers[key] = { ...markerRecord, retiredAt: now };
    await userRef.set(clean({ originalBetaHistoryPeriods: updatedMarkers }), { merge: true });
  }
  const history = await retainedHistory(account.uid);
  await updateReviewCount(account.uid, retention.retained.length, history);
  return {
    action,
    retired: removedDesired,
    retainedCount: retention.retained.length,
    cadenceCompatible: cadenceCompatible(entry, account.cadenceAnchor),
    identityNormalized: normalizedIdentity.normalized,
    legacyBetaAccessStatus: normalizedIdentity.legacyBetaAccessStatus,
  };
}

function projectedRetainedCount(documents: QueryDocumentSnapshot[], entry: OriginalBetaSourceEntry) {
  if (documents.some((document) => samePeriod(document.data() as Record<string, any>, entry))) return Math.min(4, documents.length);
  const simulated = [
    ...documents.map((document) => ({ deskKey: reviewEntry(document).deskKey, periodEnd: reviewEntry(document).periodEnd })),
    { deskKey: `seed:${entry.periodStart}:${entry.periodEnd}`, periodEnd: entry.periodEnd },
  ].filter((item) => Boolean(item.periodEnd));
  return retainLatestFour(simulated).retained.length;
}

async function requestAccessReady(playerId: number) {
  const request = await getAdminDb().collection("betaRequests").doc(String(playerId)).get();
  if (!request.exists) return false;
  const magic = request.data()?.magicAccess as { expiresAt?: string; consumedAt?: string | null } | undefined;
  return request.data()?.status === "approved"
    && Boolean(magic?.expiresAt)
    && !magic?.consumedAt
    && Date.parse(String(magic?.expiresAt)) > Date.now();
}

export async function listOriginalBetaHistoryInventory(): Promise<OriginalBetaInventoryRow[]> {
  const sources = originalBetaSourceInventory();
  const accounts = await loadUserAccounts();
  const rows: OriginalBetaInventoryRow[] = [];
  for (const entry of sources) {
    const match = await resolveExistingLiveAccount(entry, accounts);
    if (match.conflict) {
      rows.push({
        handle: entry.handle,
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
        games: entry.games,
        record: entry.record,
        sourceRichness: entry.sourceRichness,
        liveAccountStatus: "NONE",
        historicalReviewStatus: "MISSING",
        cohort: "C · SEED + IDENTITY CONFLICT",
        seedReviewCount: 1,
        liveCompletedReviewCount: 0,
        storedCompletedReviewCount: 0,
        missingHistoricalPeriods: [entry.periodStart + " → " + entry.periodEnd],
        reconciledTotal: 1,
        status: "IDENTITY CHECK REQUIRED",
        playerId: entry.stablePlayerId,
        conflict: match.conflict,
      });
      continue;
    }
    const account = match.account;
    if (!account) {
      rows.push({
        handle: entry.handle,
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
        games: entry.games,
        record: entry.record,
        sourceRichness: entry.sourceRichness,
        liveAccountStatus: "NONE",
        historicalReviewStatus: "MISSING",
        cohort: "B · SEED ONLY",
        seedReviewCount: 1,
        liveCompletedReviewCount: 0,
        storedCompletedReviewCount: 0,
        missingHistoricalPeriods: [entry.periodStart + " → " + entry.periodEnd],
        reconciledTotal: 1,
        status: "SEED ONLY",
        playerId: entry.stablePlayerId,
      });
      continue;
    }
    const documents = await completedReviewDocuments(account.uid);
    const liveDocuments = documents.filter((document) => storedRichness(document.data() as Record<string, any>) === "LIVE_DESK");
    const existing = documents.find((document) => samePeriod(document.data() as Record<string, any>, entry));
    const retired = Boolean(account.originalBetaHistoryPeriods?.[markerKey(entry)]?.retiredAt);
    const accessReady = await requestAccessReady(account.chessCom.playerId);
    const legacyAccess = await legacyBetaAccessState(entry, account);
    const historicalReviewStatus = existing ? "PRESENT" as const : retired ? "RETIRED" as const : "MISSING" as const;
    const missing = historicalReviewStatus === "MISSING";
    rows.push({
      handle: entry.handle,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      games: entry.games,
      record: entry.record,
      sourceRichness: entry.sourceRichness,
      liveAccountStatus: "EXISTS",
      historicalReviewStatus,
      identityStatus: account.identityStatus,
      identityReviewStatus: account.identityReviewStatus,
      legacyBetaAccessStatus: legacyAccess.status,
      cohort: "A · SEED + EXISTING LIVE ACCOUNT",
      seedReviewCount: 1,
      liveCompletedReviewCount: liveDocuments.length,
      storedCompletedReviewCount: documents.length,
      missingHistoricalPeriods: missing ? [entry.periodStart + " → " + entry.periodEnd] : [],
      reconciledTotal: missing ? projectedRetainedCount(documents, entry) : Math.min(4, documents.length),
      status: missing ? "LIVE · HISTORY MISSING" : "LIVE · RECONCILED",
      playerId: account.chessCom.playerId,
      uid: account.uid,
      canonicalUsername: account.chessCom.canonicalUsername,
      cadenceCompatible: cadenceCompatible(entry, account.cadenceAnchor),
      accessReady,
    });
  }
  return rows;
}

export async function reconcileOriginalBetaPlayer(handle: string) {
  const entry = findOriginalBetaSource(handle);
  if (!entry) throw Object.assign(new Error("This player is not in the real original-beta registry."), { status: 404 });
  const match = await resolveExistingLiveAccount(entry, undefined, { resolveStableId: true });
  if (match.conflict) throw Object.assign(new Error(match.conflict), { status: 409, code: "ORIGINAL_BETA_IDENTITY_CONFLICT" });
  if (!match.account) throw Object.assign(new Error("This original beta player does not have a live BoardSignal account yet."), { status: 409, code: "ORIGINAL_BETA_SEED_ONLY" });
  return attachOriginalBetaHistory(entry, match.account, { identityVerified: match.identityVerified === true });
}

export async function reconcileAllOriginalBetaHistory(): Promise<OriginalBetaReconcileSummary> {
  const sources = originalBetaSourceInventory();
  const accounts = await loadUserAccounts();
  const summary: OriginalBetaReconcileSummary = {
    seededPlayersChecked: sources.length,
    liveAccountsMatched: 0,
    historicalReviewsAttached: 0,
    historicalReviewsUpgraded: 0,
    alreadyReconciled: 0,
    retiredByRetention: 0,
    seedOnly: 0,
    identityConflicts: 0,
    errors: [],
  };
  for (const entry of sources) {
    try {
      const match = await resolveExistingLiveAccount(entry, accounts, { resolveStableId: true });
      if (match.conflict) {
        summary.identityConflicts += 1;
        summary.errors.push({ handle: entry.handle, error: match.conflict });
        continue;
      }
      if (!match.account) {
        summary.seedOnly += 1;
        continue;
      }
      summary.liveAccountsMatched += 1;
      const result = await attachOriginalBetaHistory(entry, match.account, { identityVerified: match.identityVerified === true });
      if (result.action === "attached") summary.historicalReviewsAttached += 1;
      else if (result.action === "upgraded") summary.historicalReviewsUpgraded += 1;
      else summary.alreadyReconciled += 1;
      if (result.retired) summary.retiredByRetention += 1;
    } catch (error) {
      if ((error as { code?: string }).code === "ORIGINAL_BETA_IDENTITY_CONFLICT") summary.identityConflicts += 1;
      summary.errors.push({ handle: entry.handle, error: error instanceof Error ? error.message : "Unknown reconciliation error." });
    }
  }
  return summary;
}

async function compatibleMagicRequest(account: OriginalBetaAccountData, entry: OriginalBetaSourceEntry) {
  const db = getAdminDb();
  const requestId = String(account.chessCom.playerId);
  const ref = db.collection("betaRequests").doc(requestId);
  const snapshot = await ref.get();
  if (snapshot.exists) {
    const data = snapshot.data() as Record<string, any>;
    if (Number(data.chessPlayerId) !== account.chessCom.playerId) {
      throw Object.assign(new Error("The existing Founding Access request belongs to another stable player ID."), { status: 409, code: "ORIGINAL_BETA_REQUEST_CONFLICT" });
    }
    if (data.identityReviewStatus === "rejected" || data.status === "rejected") {
      throw Object.assign(new Error("This original beta identity has a rejected/revoked request and requires Founder review."), { status: 409, code: "ORIGINAL_BETA_IDENTITY_REJECTED" });
    }
    return { ref, requestId, exists: true, data };
  }
  return { ref, requestId, exists: false, data: undefined };
}

async function issueOriginalBetaMagic(
  account: OriginalBetaAccountData,
  entry: OriginalBetaSourceEntry,
  options: { allowPreparePromotion?: boolean } = {},
) {
  const request = await compatibleMagicRequest(account, entry);
  if (request.exists) {
    const existing = request.data!;
    const provisionalRecovery = existing.status === "pending"
      && Boolean(existing.provisionalClaimedAt)
      && existing.identityReviewStatus !== "rejected";
    if (existing.status === "approved" || provisionalRecovery) {
      const regenerated = await regenerateFoundingBetaMagicAccess(request.requestId);
      return { magicLink: regenerated.magicLink, magicAccessExpiresAt: regenerated.magicAccessExpiresAt };
    }
    if (!options.allowPreparePromotion) {
      throw Object.assign(new Error("This original beta player still has a pending Preview request. Use Prepare App Access to move them onto the direct original-tester path."), {
        status: 409,
        code: "ORIGINAL_BETA_PREPARE_REQUIRED",
      });
    }
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const magic = betaMagicAccessCredential(request.requestId, account.chessCom.playerId, account.uid, now);
  await request.ref.set(clean({
    id: request.requestId,
    chessPlayerId: account.chessCom.playerId,
    canonicalUsername: account.chessCom.canonicalUsername,
    avatar: account.chessCom.avatar,
    profileUrl: account.chessCom.profileUrl,
    requestedAt: typeof request.data?.requestedAt === "string" ? request.data.requestedAt : nowIso,
    status: "approved",
    decidedAt: nowIso,
    identityReviewStatus: "confirmed",
    firebaseUid: account.uid,
    statusTokenHash: "original-beta-founder-migration",
    magicAccess: { ...magic.record, consumedAt: null },
    claimedAt: null,
    previewClaimConsumedAt: null,
    originalBetaAccess: true,
  }), { merge: true });
  return { magicLink: magic.link, magicAccessExpiresAt: magic.expiresAt };
}

export async function prepareOriginalBetaAppAccess(handle: string) {
  const entry = findOriginalBetaSource(handle);
  if (!entry) throw Object.assign(new Error("This player is not in the real original-beta registry."), { status: 404 });

  // Prepare App Access is Cohort B only. If the seed already resolves to a live
  // account, history must be attached in place and existing access/session state
  // must remain untouched.
  const existing = await resolveExistingLiveAccount(entry, undefined, { resolveStableId: true });
  if (existing.conflict) throw Object.assign(new Error(existing.conflict), { status: 409, code: "ORIGINAL_BETA_IDENTITY_CONFLICT" });
  if (existing.account) {
    throw Object.assign(new Error("This original beta player already has a live BoardSignal account. Reconcile missing history in place; do not Prepare App Access."), {
      status: 409,
      code: "ORIGINAL_BETA_EXISTING_LIVE_ACCOUNT",
    });
  }

  const identity = identityFromResolved(await resolveChessComPlayer(entry.handle));
  if (entry.stablePlayerId && identity.playerId !== entry.stablePlayerId) {
    throw Object.assign(new Error("Chess.com resolved this seed to a different stable player ID than the verified original-beta identity."), {
      status: 409,
      code: "ORIGINAL_BETA_IDENTITY_CONFLICT",
    });
  }
  const uid = firebaseUidForChessPlayer(identity.playerId);
  const db = getAdminDb();
  const mapping = await db.collection("chessPlayerAccounts").doc(String(identity.playerId)).get();
  if (mapping.exists && String(mapping.data()?.uid ?? "") !== uid) {
    throw Object.assign(new Error("Chess.com stable identity is already mapped to another BoardSignal UID."), { status: 409, code: "ORIGINAL_BETA_IDENTITY_CONFLICT" });
  }
  const user = await db.collection("users").doc(uid).get();
  if (user.exists) {
    throw Object.assign(new Error("This original beta identity became an existing live account before access preparation completed. Re-run reconciliation instead."), {
      status: 409,
      code: "ORIGINAL_BETA_EXISTING_LIVE_ACCOUNT",
    });
  }

  let account = await ensureStablePlayerAccount(identity) as OriginalBetaAccountData;
  const founderReviewedAt = account.founderReviewedAt ?? new Date().toISOString();
  await db.collection("users").doc(account.uid).set(clean({
    identityStatus: account.identityStatus === "oauth_verified" ? "oauth_verified" : "founder_reviewed",
    identityReviewStatus: "confirmed",
    founderReviewedAt,
    originalBetaPlayer: true,
  }), { merge: true });
  account = {
    ...account,
    identityStatus: account.identityStatus === "oauth_verified" ? "oauth_verified" : "founder_reviewed",
    identityReviewStatus: "confirmed",
    founderReviewedAt,
    originalBetaPlayer: true,
  };
  const reconciliation = await attachOriginalBetaHistory(entry, account, { identityVerified: true });
  const access = await issueOriginalBetaMagic(account, entry, { allowPreparePromotion: true });
  return {
    player: { username: account.chessCom.canonicalUsername, playerId: account.chessCom.playerId, uid: account.uid },
    reconciliation,
    ...access,
  };
}

export async function regenerateOriginalBetaMagicAccess(handle: string) {
  const entry = findOriginalBetaSource(handle);
  if (!entry) throw Object.assign(new Error("This player is not in the real original-beta registry."), { status: 404 });
  const existing = await resolveExistingLiveAccount(entry, undefined, { resolveStableId: true });
  if (existing.conflict) throw Object.assign(new Error(existing.conflict), { status: 409, code: "ORIGINAL_BETA_IDENTITY_CONFLICT" });
  if (!existing.account) throw Object.assign(new Error("Prepare App Access before generating a recovery link for this seed-only player."), { status: 409 });
  return issueOriginalBetaMagic(existing.account, entry);
}

export const ORIGINAL_BETA_RECONCILIATION_CONSTANTS = {
  REVIEW_KIND,
  RICHNESS_RANK,
} as const;
