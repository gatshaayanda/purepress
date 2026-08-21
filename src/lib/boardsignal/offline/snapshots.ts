import type { BoardSignalAccount } from "@/lib/boardsignal/account";
import type { FactualReviewDraft } from "@/lib/boardsignal/factualReview";
import type { CurrentEpisodeSummary, PersonalRecords, ProgressSeries, RecurringPattern } from "@/lib/boardsignal/memory";
import type { PlayerPulse, SafeShareMoment } from "@/lib/boardsignal/pulse";
import type { HeadToHeadPayload } from "@/lib/boardsignal/social";
import type { BoardSignalDesk, DeskEngineResult } from "@/lib/boardsignal/types";
import { getOfflineRecord, offlineKey, putOfflineRecord } from "./db";
import {
  BOARDSIGNAL_OFFLINE_MAX_DESKS,
  BOARDSIGNAL_OFFLINE_MAX_DRAFTS,
  BOARDSIGNAL_OFFLINE_MAX_SOCIAL_COMPARISONS,
  type OfflineDeskBundle,
  type OfflineDraft,
  type OfflineMeta,
  type OfflinePlayerRoomSnapshot,
  type OfflineSocialOverview,
  type OfflineSocialSnapshot,
} from "./types";

type OnlineSnapshotInput = {
  account: BoardSignalAccount;
  desks: Array<{ desk: BoardSignalDesk; engineResults: Record<string, DeskEngineResult>; summary: OfflineDeskBundle["summary"] }>;
  progress: ProgressSeries[];
  recurringPatterns: RecurringPattern[];
  personalRecords: PersonalRecords;
  currentEpisode?: CurrentEpisodeSummary;
  pendingFactualReview?: FactualReviewDraft;
  pulse?: PlayerPulse;
  shareMoments?: SafeShareMoment[];
};

const PLAYER_ROOM_KIND = "player-room";
const SOCIAL_KIND = "social";

export async function savePlayerRoomOfflineSnapshot(uid: string, input: OnlineSnapshotInput) {
  if (input.account.uid !== uid) throw new Error("Offline snapshot identity mismatch.");
  const now = new Date().toISOString();
  const desks = [...input.desks]
    .sort((a, b) => b.summary.periodEnd.localeCompare(a.summary.periodEnd))
    .slice(0, BOARDSIGNAL_OFFLINE_MAX_DESKS);
  const activeDeskKeys = new Set(desks.map((item) => item.summary.deskKey));
  const snapshot: OfflinePlayerRoomSnapshot = {
    version: 1,
    uid,
    canonicalUsername: input.account.chessCom.canonicalUsername,
    avatar: input.account.chessCom.avatar,
    savedAt: now,
    lastSyncedAt: now,
    desks,
    progress: input.progress.map((series) => ({ ...series, points: series.points.filter((point) => activeDeskKeys.has(point.deskKey)).slice(-BOARDSIGNAL_OFFLINE_MAX_DESKS) })),
    recurringPatterns: input.recurringPatterns,
    personalRecords: input.personalRecords,
    currentEpisode: input.currentEpisode,
    // A.1 durable factual readiness is safe to preserve offline, but it remains
    // explicitly engine-pending and can only resume through the existing online pipeline.
    pendingFactualReview: input.pendingFactualReview,
    pulse: input.pulse,
    shareMoments: (input.shareMoments ?? []).filter((item) => activeDeskKeys.has(item.deskKey)).slice(0, 12),
  };
  await putOfflineRecord("snapshots", { key: offlineKey(uid, PLAYER_ROOM_KIND), uid, kind: PLAYER_ROOM_KIND, updatedAt: now, payload: snapshot });
  const meta = await getOfflineMeta(uid);
  const firstReady = desks.length > 0 && !meta.offlineReadyAcknowledgedAt;
  await saveOfflineMeta(uid, {
    ...meta,
    uid,
    lastSyncedAt: now,
    ...(firstReady ? { offlineReadyAcknowledgedAt: now } : {}),
  });
  return { snapshot, firstReady };
}

export async function loadPlayerRoomOfflineSnapshot(uid: string) {
  return (await getOfflineRecord<OfflinePlayerRoomSnapshot>("snapshots", offlineKey(uid, PLAYER_ROOM_KIND), uid))?.payload;
}

export async function saveSocialOverviewOfflineSnapshot(uid: string, overview: OfflineSocialOverview) {
  const previous = await loadSocialOfflineSnapshot(uid);
  const now = new Date().toISOString();
  const snapshot: OfflineSocialSnapshot = { version: 1, uid, savedAt: now, overview, comparisons: previous?.comparisons?.slice(0, BOARDSIGNAL_OFFLINE_MAX_SOCIAL_COMPARISONS) ?? [] };
  await putOfflineRecord("snapshots", { key: offlineKey(uid, SOCIAL_KIND), uid, kind: SOCIAL_KIND, updatedAt: now, payload: snapshot });
  return snapshot;
}

export async function saveSocialComparisonOfflineSnapshot(uid: string, comparison: HeadToHeadPayload) {
  const previous = await loadSocialOfflineSnapshot(uid);
  const now = new Date().toISOString();
  const others = (previous?.comparisons ?? []).filter((item) => item.right.playerId !== comparison.right.playerId);
  const snapshot: OfflineSocialSnapshot = { version: 1, uid, savedAt: now, overview: previous?.overview, comparisons: [comparison, ...others].slice(0, BOARDSIGNAL_OFFLINE_MAX_SOCIAL_COMPARISONS) };
  await putOfflineRecord("snapshots", { key: offlineKey(uid, SOCIAL_KIND), uid, kind: SOCIAL_KIND, updatedAt: now, payload: snapshot });
  return snapshot;
}

export async function loadSocialOfflineSnapshot(uid: string) {
  return (await getOfflineRecord<OfflineSocialSnapshot>("snapshots", offlineKey(uid, SOCIAL_KIND), uid))?.payload;
}

export async function getOfflineMeta(uid: string): Promise<OfflineMeta> {
  return (await getOfflineRecord<OfflineMeta>("meta", offlineKey(uid, "meta"), uid))?.payload ?? { uid };
}

export async function saveOfflineMeta(uid: string, meta: OfflineMeta) {
  const now = new Date().toISOString();
  await putOfflineRecord("meta", { key: offlineKey(uid, "meta"), uid, kind: "meta", updatedAt: now, payload: { ...meta, uid } });
}

export async function saveOfflineDraft(draft: OfflineDraft) {
  const now = new Date().toISOString();
  await putOfflineRecord("drafts", { key: offlineKey(draft.uid, "draft", draft.id), uid: draft.uid, kind: "draft", updatedAt: now, payload: { ...draft, body: draft.body.slice(0, 4000), updatedAt: now } });
  // Bound draft count by pruning oldest records for this UID using known slots maintained by a compact index.
  const metaKey = offlineKey(draft.uid, "draft-index");
  const current = (await getOfflineRecord<string[]>("meta", metaKey, draft.uid))?.payload ?? [];
  const next = [draft.id, ...current.filter((id) => id !== draft.id)].slice(0, BOARDSIGNAL_OFFLINE_MAX_DRAFTS);
  await putOfflineRecord("meta", { key: metaKey, uid: draft.uid, kind: "draft-index", updatedAt: now, payload: next });
  for (const id of current.filter((id) => !next.includes(id))) {
    const { deleteOfflineRecord } = await import("./db");
    await deleteOfflineRecord("drafts", offlineKey(draft.uid, "draft", id));
  }
  return next;
}

export async function loadOfflineDrafts(uid: string) {
  const index = (await getOfflineRecord<string[]>("meta", offlineKey(uid, "draft-index"), uid))?.payload ?? [];
  const drafts = await Promise.all(index.map(async (id) => (await getOfflineRecord<OfflineDraft>("drafts", offlineKey(uid, "draft", id), uid))?.payload));
  return drafts.filter((item): item is OfflineDraft => Boolean(item));
}

export async function deleteOfflineDraft(uid: string, id: string) {
  const { deleteOfflineRecord } = await import("./db");
  await deleteOfflineRecord("drafts", offlineKey(uid, "draft", id));
  const metaKey = offlineKey(uid, "draft-index");
  const current = (await getOfflineRecord<string[]>("meta", metaKey, uid))?.payload ?? [];
  const next = current.filter((item) => item !== id).slice(0, BOARDSIGNAL_OFFLINE_MAX_DRAFTS);
  await putOfflineRecord("meta", { key: metaKey, uid, kind: "draft-index", updatedAt: new Date().toISOString(), payload: next });
}

export async function requestPersistentStorageBestEffort(uid: string) {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  const meta = await getOfflineMeta(uid);
  if (meta.storagePersistRequestedAt) return Boolean(await navigator.storage.persisted?.());
  const granted = await navigator.storage.persist().catch(() => false);
  await saveOfflineMeta(uid, { ...meta, uid, storagePersistRequestedAt: new Date().toISOString() });
  return granted;
}
