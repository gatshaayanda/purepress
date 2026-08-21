import type { FactualReviewDraft } from "@/lib/boardsignal/factualReview";
import type { CurrentEpisodeSummary, DeskSummary, PersonalRecords, ProgressSeries, RecurringPattern } from "@/lib/boardsignal/memory";
import type { PlayerPulse, SafeShareMoment } from "@/lib/boardsignal/pulse";
import type { HeadToHeadPayload, SocialPlayerCard } from "@/lib/boardsignal/social";
import type { BoardSignalDesk, DeskEngineResult } from "@/lib/boardsignal/types";

export const BOARDSIGNAL_OFFLINE_DB_NAME = "boardsignal-offline-v1";
export const BOARDSIGNAL_OFFLINE_DB_VERSION = 1;
export const BOARDSIGNAL_OFFLINE_MAX_DESKS = 4;
export const BOARDSIGNAL_OFFLINE_MAX_DRAFTS = 4;
export const BOARDSIGNAL_OFFLINE_MAX_SOCIAL_COMPARISONS = 4;

export type OfflineDeskBundle = {
  desk: BoardSignalDesk;
  engineResults: Record<string, DeskEngineResult>;
  summary: DeskSummary;
};

export type OfflinePlayerRoomSnapshot = {
  version: 1;
  uid: string;
  canonicalUsername: string;
  avatar?: string;
  savedAt: string;
  lastSyncedAt: string;
  desks: OfflineDeskBundle[];
  progress: ProgressSeries[];
  recurringPatterns: RecurringPattern[];
  personalRecords: PersonalRecords;
  currentEpisode?: CurrentEpisodeSummary;
  pendingFactualReview?: FactualReviewDraft;
  pulse?: PlayerPulse;
  shareMoments: SafeShareMoment[];
};

export type OfflineSocialOverview = {
  friends: SocialPlayerCard[];
  incoming: SocialPlayerCard[];
  outgoing: SocialPlayerCard[];
  rivalWatch: Array<{ player: SocialPlayerCard; label: string; detail: string }>;
  socialPulse: Array<{ id: string; playerId: number; eyebrow: string; headline: string; supportingFact: string; publishedAt: string }>;
};

export type OfflineSocialSnapshot = {
  version: 1;
  uid: string;
  savedAt: string;
  overview?: OfflineSocialOverview;
  comparisons: HeadToHeadPayload[];
};

export type OfflineDraft = {
  id: string;
  uid: string;
  kind: "founder-message" | "guide-support";
  body: string;
  createdAt: string;
  updatedAt: string;
  pathname?: string;
  activeTab?: string;
};

export type OfflineMeta = {
  uid: string;
  lastSyncedAt?: string;
  offlineReadyAcknowledgedAt?: string;
  storagePersistRequestedAt?: string;
};

export type OfflineSnapshotKind = "player-room" | "social";

export type OfflineStoredRecord<T> = {
  key: string;
  uid: string;
  kind: string;
  updatedAt: string;
  payload: T;
};
