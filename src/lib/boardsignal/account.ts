import { resolveChessComCallbackUri } from "./auth/callbackUri";

export const FOUNDING_BETA_AGREEMENT_VERSION = "founding-beta-2026-08-12";

export type BoardSignalAccessTier = "founding_beta" | "paid";
export type BoardSignalAccessStatus = "active" | "paused" | "deleted";
export type BoardSignalContactMethod = "email" | "discord" | "telegram";
export type BoardSignalFounderContactMethod = "email" | "discord" | "telegram" | "chesscom" | "other";
export type BoardSignalIdentityStatus = "provisional" | "founder_reviewed" | "oauth_verified" | "revoked";
export type BoardSignalIdentityReviewStatus = "pending" | "confirmed" | "rejected";
export type BoardSignalPublicHighlightsStatus =
  | "live"
  | "waiting_identity_review"
  | "no_completed_review"
  | "no_safe_highlight"
  | "repair_needed"
  | "unavailable";

export type StableChessComIdentity = {
  playerId: number;
  canonicalUsername: string;
  avatar?: string;
  profileUrl?: string;
};

export type BoardSignalPrivacySettings = {
  publicPlayerPage: boolean;
  universeCoverage: boolean;
  additionalPositiveHighlights?: boolean;
  publicGameLinks?: boolean;
  expandedPublicProfile?: boolean;
};

export type BoardSignalNotificationPreferences = {
  email: boolean;
  browserPush: boolean;
  deskReady: boolean;
  episodeProgress: boolean;
  blueReminder: boolean;
  amberWatch: boolean;
  universeAchievement: boolean;
  founderUpdates: boolean;
};

export type BoardSignalAccount = {
  uid: string;
  role: "player";
  accessTier: BoardSignalAccessTier;
  accessStatus: BoardSignalAccessStatus;
  billingRequired: boolean;
  maxActiveDesks: 4;
  chessCom: StableChessComIdentity;
  chessComOAuthLinkedAt?: string;
  identityStatus?: BoardSignalIdentityStatus;
  identityReviewStatus?: BoardSignalIdentityReviewStatus;
  founderReviewedAt?: string;
  betaAgreementVersion?: string;
  betaAgreementAcceptedAt?: string;
  universeParticipationDisclosedAt?: string;
  preferencesConfirmedAt?: string;
  contactConfirmedAt?: string;
  preferredContactMethod?: BoardSignalContactMethod;
  preferredContactValue?: string;
  betaContactConsent?: boolean;
  privacy: BoardSignalPrivacySettings;
  notificationPreferences: BoardSignalNotificationPreferences;
  cadenceAnchor?: string;
  lastSeenAt?: string;
  founderOps?: {
    lastContactedAt?: string;
    lastContactMethod?: BoardSignalFounderContactMethod;
    followUpSnoozedUntil?: string;
  };
  latestProgressCheckedAt?: string;
  nextDeskDueAt?: string;
  previousBlue?: { title: string; copy: string };
  previousAmber?: { title: string; copy: string };
  currentEpisodeSummary?: import("./memory").CurrentEpisodeSummary;
  lastNotificationAt?: string;
  eligibleCoverageKeys: string[];
};

export type ChessComOAuthStatus = {
  enabled: boolean;
  provider: "chesscom";
  missing: string[];
  message: string;
};

export type FounderPublicHighlightsState = {
  status: BoardSignalPublicHighlightsStatus;
  retainedReviews: number;
  expectedCoverage: number;
  liveCoverage: number;
  repairAvailable: boolean;
};

export type FounderPlayerIdentityRow = {
  uid: string;
  username: string;
  playerId: number;
  avatar?: string;
  profileUrl?: string;
  betaAccessStatus: "active" | "revoked" | "not_created";
  accountStatus: BoardSignalAccessStatus;
  desksStored: number;
  latestDesk?: { deskKey: string; periodLabel: string; periodEnd: string };
  publicHighlights: FounderPublicHighlightsState;
  lastSeen?: string;
  oauthLinked: boolean;
  preferredContactMethod?: BoardSignalContactMethod;
  preferredContactValue?: string;
  betaContactConsent?: boolean;
  identityStatus?: BoardSignalIdentityStatus;
};

const REQUIRED_CHESSCOM_ENV = [
  "CHESSCOM_CLIENT_ID",
  "CHESSCOM_CLIENT_SECRET",
  "CHESSCOM_AUTHORIZE_URL",
  "CHESSCOM_TOKEN_URL",
  "CHESSCOM_PROFILE_URL",
  "CHESSCOM_SCOPES",
  "CHESSCOM_REDIRECT_URI",
  "BOARDSIGNAL_AUTH_STATE_SECRET",
  "FIREBASE_ADMIN_KEY",
] as const;

export function getChessComOAuthStatus(
  env: Record<string, string | undefined>,
): ChessComOAuthStatus {
  const missing: string[] = REQUIRED_CHESSCOM_ENV.filter((name) => !env[name]?.trim());
  if (env.CHESSCOM_REDIRECT_URI?.trim()
    && !resolveChessComCallbackUri(env.CHESSCOM_REDIRECT_URI, env.NODE_ENV)) {
    missing.push("CHESSCOM_REDIRECT_URI_REGISTERED_CALLBACK");
  }
  const explicitlyEnabled = env.CHESSCOM_OAUTH_ENABLED === "true";
  const enabled = explicitlyEnabled && missing.length === 0;
  return {
    enabled,
    provider: "chesscom",
    missing,
    message: enabled
      ? "Chess.com account ownership sign-in is configured."
      : explicitlyEnabled
        ? "Chess.com sign-in is unavailable because required provider configuration is incomplete."
        : "Chess.com sign-in is awaiting official provider approval. Founding Access remains available.",
  };
}

export function canonicalPlayerKey(identity: Pick<StableChessComIdentity, "playerId">) {
  return String(identity.playerId);
}

export function firebaseUidForChessPlayer(playerId: number) {
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw new Error("A stable Chess.com player ID is required.");
  }
  return `chesscom_${playerId}`;
}

export function defaultNotificationPreferences(): BoardSignalNotificationPreferences {
  return {
    email: false,
    browserPush: false,
    deskReady: true,
    episodeProgress: true,
    blueReminder: true,
    amberWatch: false,
    universeAchievement: true,
    founderUpdates: true,
  };
}

export function createFoundingBetaAccount(
  identity: StableChessComIdentity,
  now = new Date(),
): BoardSignalAccount {
  const normalizedUsername = identity.canonicalUsername.trim().toLowerCase();
  return {
    uid: firebaseUidForChessPlayer(identity.playerId),
    role: "player",
    accessTier: "founding_beta",
    accessStatus: "active",
    billingRequired: false,
    maxActiveDesks: 4,
    chessCom: identity,
    privacy: {
      publicPlayerPage: true,
      universeCoverage: true,
      additionalPositiveHighlights: false,
      publicGameLinks: false,
      expandedPublicProfile: false,
    },
    notificationPreferences: defaultNotificationPreferences(),
    lastSeenAt: now.toISOString(),
    eligibleCoverageKeys: [String(identity.playerId), normalizedUsername],
  };
}

export function hasAcceptedCurrentBetaAgreement(account: BoardSignalAccount) {
  return account.betaAgreementVersion === FOUNDING_BETA_AGREEMENT_VERSION
    && Boolean(account.betaAgreementAcceptedAt);
}
