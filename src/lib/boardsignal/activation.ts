import type { UniverseRatingPool } from "./universe";

export type BetaPreviewPool = {
  pool: string;
  games: number;
  wins?: number;
  draws?: number;
  losses?: number;
  ratingStart?: number;
  ratingEnd?: number;
  ratingDelta?: number;
};

export type BetaPreviewUniverseStanding = {
  categoryId: string;
  categoryTitle: string;
  scopeLabel?: string;
  rank: number;
  denominator: number;
  valueLabel: string;
  label: "PROVISIONAL";
  nearestAbove?: { player: string; valueLabel: string };
};

export type BetaPreviewPublicPlayer = {
  playerId?: string;
  canonicalUsername: string;
  placement?: string;
  safeHighlight?: string;
  href?: string;
};

export type BetaPreviewActivity = {
  eventId: string;
  canonicalUsername: string;
  headline: string;
  supportingFact: string;
  publishedAt: string;
};

/**
 * Public-safe acquisition projection. This deliberately cannot contain a
 * BoardSignalDesk, private Signals, evidence, recurrence or contact data.
 */
export type BoardSignalBetaPreview = {
  canonicalUsername: string;
  requestedAt?: string;
  avatar?: string;
  playerId: number;
  profileUrl?: string;
  playableWeek: boolean;
  period?: {
    start: string;
    end: string;
    label: string;
    mode: "latest_completed" | "latest_active";
    disclosure?: string;
  };
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  pools: BetaPreviewPool[];
  primaryPool?: string;
  strongestWinRun?: number;
  activeDays?: number;
  safeHeadline: string;
  safeHighlight: string;
  universePreview: BetaPreviewUniverseStanding[];
  publicPlayers: BetaPreviewPublicPlayer[];
  recentUniverseActivity: BetaPreviewActivity[];
  generatedAt: string;
};

export type BetaActivationReturnMethod = "device" | "email" | "discord" | "telegram" | "return_here";

export type BetaPreviewRequestState = "preview_ready" | "approved" | "claimed" | "rejected" | "expired";
export type BetaIdentityReviewStatus = "pending" | "confirmed" | "rejected";

export type BetaPreviewStatus = {
  requestId: string;
  state: BetaPreviewRequestState;
  canonicalUsername: string;
  requestedAt?: string;
  avatar?: string;
  preview?: BoardSignalBetaPreview;
  previewError?: string;
  accessReady: boolean;
  provisionalAccessReady?: boolean;
  approvedAt?: string;
  claimedAt?: string;
  provisionalClaimedAt?: string;
  identityReviewStatus?: BetaIdentityReviewStatus;
  magicAccessExpiresAt?: string;
  emailDelivery?: "delivered" | "failed" | "not_eligible" | "not_configured";
  activationReturnMethod?: BetaActivationReturnMethod;
  preferredContactMethod?: "email" | "discord" | "telegram";
  preferredContactValue?: string;
  betaContactConsent?: true;
  deviceAlertsEnabled?: boolean;
  deviceDelivery?: "delivered" | "failed" | "not_eligible";
};

export const BETA_PREVIEW_STATUS_TOKEN_BYTES = 32;
export const BETA_MAGIC_ACCESS_TOKEN_BYTES = 32;
export const BETA_MAGIC_ACCESS_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const BETA_PREVIEW_POLL_MS = 25_000;

const FORBIDDEN_PREVIEW_KEYS = [
  "signals", "green", "amber", "red", "blue", "candidates", "evidence", "engineResults", "recurrence", "recurringPatterns",
  "preferredContactValue", "preferredContactMethod", "betaContactConsent", "accessCode", "passHash", "passSalt", "firebaseToken",
  "privateNotes", "privateMessage", "contact", "email", "discord", "telegram",
];

export function betaPreviewContainsPrivateFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const queue: unknown[] = [value];
  while (queue.length) {
    const current = queue.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) { queue.push(...current); continue; }
    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      const normalized = key.toLowerCase();
      if (FORBIDDEN_PREVIEW_KEYS.some((forbidden) => normalized === forbidden.toLowerCase())) return true;
      if (nested && typeof nested === "object") queue.push(nested);
    }
  }
  return false;
}

export function normalizePreviewRatingPool(value: string | undefined): UniverseRatingPool | undefined {
  const pool = String(value ?? "").toLowerCase();
  return pool === "rapid" || pool === "blitz" || pool === "bullet" ? pool : undefined;
}

export function validPreviewContactEmail(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
