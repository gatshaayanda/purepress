import "server-only";

import { createHash } from "node:crypto";
import type { BoardSignalAccount, BoardSignalContactMethod, StableChessComIdentity } from "../account";
import { defaultNotificationPreferences } from "../account";
import type { BetaActivationReturnMethod, BetaPreviewStatus, BoardSignalBetaPreview } from "../activation";
import { resolveChessComPlayer } from "../processor";
import type { PublicUniverseEvent } from "../pulse";
import type { DocumentReference } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../../utils/firebaseAdmin";
import {
  betaMagicAccessCredential,
  buildSafeBetaPreview,
  createBetaPreviewStatusCredential,
  notifyFounderOfBetaRequest,
  verifyBetaPreviewStatusCredential,
} from "./activation";
import { createFoundingBetaAccess, loadExistingFoundingBetaAccess } from "./betaAccess";
import { ensureStablePlayerAccount } from "./persistence";
import { ensureSafePublicCoverageForAccount } from "./publicCoverageRepair";
import { deliverFoundingBetaIdentityConfirmation } from "./foundingBetaIdentityConfirmation";
import { writePublicUniverseEvent } from "./universePulse";

export type BetaRequestStatus = "pending" | "approved" | "rejected";

export type FoundingBetaRequest = {
  id: string;
  chessPlayerId: number;
  canonicalUsername: string;
  avatar?: string;
  profileUrl?: string;
  preferredContactMethod?: BoardSignalContactMethod;
  preferredContactValue?: string;
  betaContactConsent?: true;
  activationReturnMethod?: BetaActivationReturnMethod;
  activationReturnUpdatedAt?: string;
  activationDevice?: { token: string; registeredAt: string; updatedAt: string; userAgentSummary?: string } | null;
  approvalAlertDevice?: { token: string; registeredAt: string; updatedAt: string; userAgentSummary?: string } | null;
  approvalAlertEmail?: string;
  approvalAlertEmailConsent?: true;
  activationDeviceDelivery?: "delivered" | "failed" | "not_eligible";
  identityConfirmationDelivery?: { channel: "device" | "email" | "none"; status: "attempting" | "delivered" | "failed" | "not_eligible" | "not_configured"; attemptedAt?: string; deliveredAt?: string; playerAlreadyInside?: boolean; reason?: string };
  requestedAt: string;
  status: BetaRequestStatus;
  decidedAt?: string;
  source?: "boardSignalShare";
  shareMomentId?: string;
  statusTokenHash: string;
  previewSnapshot?: BoardSignalBetaPreview;
  previewGeneratedAt?: string;
  previewError?: string;
  firebaseUid?: string;
  claimedAt?: string;
  previewClaimConsumedAt?: string;
  provisionalClaimedAt?: string;
  identityReviewStatus?: "pending" | "confirmed" | "rejected";
  founderAlertRequest?: { status: "delivered" | "failed" | "not_eligible"; attemptedAt: string };
  founderAlertProvisionalClaim?: { status: "delivered" | "failed" | "not_eligible"; attemptedAt: string };
  revokedAt?: string;
  magicAccess?: {
    ticketHash: string;
    expiresAt: string;
    createdAt: string;
    requestId: string;
    playerId: number;
    uid: string;
    consumedAt?: string;
  };
  accessEmailDelivery?: "delivered" | "failed" | "not_eligible" | "not_configured";
  founderAlertSentAt?: string;
};

export type BetaRequestSubmission = {
  request: FoundingBetaRequest;
  statusToken?: string;
  preview?: BoardSignalBetaPreview;
  previewError?: string;
  existingState?: "active_account" | "pending" | "approved_unclaimed";
};

const CONTACT_METHODS = new Set<BoardSignalContactMethod>(["email", "discord", "telegram"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function identityFromResolved(resolved: Awaited<ReturnType<typeof resolveChessComPlayer>>): StableChessComIdentity {
  if (!Number.isSafeInteger(resolved.playerId) || !resolved.playerId) {
    throw Object.assign(new Error("Chess.com did not return the stable player ID BoardSignal requires."), { status: 422 });
  }
  return { playerId: resolved.playerId, canonicalUsername: resolved.username, avatar: resolved.avatar, profileUrl: resolved.profileUrl };
}

function validateContact(methodValue: unknown, contactValue: unknown, consentValue: unknown) {
  const method = String(methodValue ?? "").toLowerCase() as BoardSignalContactMethod;
  const value = String(contactValue ?? "").trim();
  if (!CONTACT_METHODS.has(method)) throw Object.assign(new Error("Choose Email, Discord or Telegram."), { status: 400 });
  if (consentValue !== true) throw Object.assign(new Error("Contact consent is required for a Founding Access request."), { status: 400 });
  if (value.length < 2 || value.length > 160) throw Object.assign(new Error("Enter one reachable contact value."), { status: 400 });
  if (method === "email" && !EMAIL_PATTERN.test(value)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
  return { method, value };
}

function clientKey(request: Request) {
  const raw = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

async function enforceRequestRateLimit(request: Request, now = new Date()) {
  const db = getAdminDb();
  const bucket = now.toISOString().slice(0, 10);
  const ref = db.collection("betaRequestRateLimits").doc(`${bucket}_${clientKey(request)}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count ?? 0);
    if (count >= 5) throw Object.assign(new Error("Too many Founding Access requests were submitted from this connection today. Try again later."), { status: 429 });
    transaction.set(ref, { count: count + 1, bucket, updatedAt: now.toISOString() }, { merge: true });
  });
}

async function existingStableAccount(identity: StableChessComIdentity) {
  const db = getAdminDb();
  const map = await db.collection("chessPlayerAccounts").doc(String(identity.playerId)).get();
  const uid = typeof map.data()?.uid === "string" ? String(map.data()!.uid) : `chesscom_${identity.playerId}`;
  const user = await db.collection("users").doc(uid).get();
  return user.exists ? user.data() as BoardSignalAccount : undefined;
}

async function generateAndStorePreview(ref: DocumentReference, identity: StableChessComIdentity) {
  try {
    const preview = await buildSafeBetaPreview(identity);
    await ref.set(clean({ previewSnapshot: preview, previewGeneratedAt: preview.generatedAt, previewError: null }), { merge: true });
    return { preview };
  } catch (error) {
    const previewError = error instanceof Error ? error.message : "Chess.com did not return the preview yet.";
    await ref.set({ previewError, previewGeneratedAt: new Date().toISOString() }, { merge: true });
    return { previewError };
  }
}

export async function submitFoundingBetaRequest(input: {
  request: Request;
  username: unknown;
  preferredContactMethod?: unknown;
  preferredContactValue?: unknown;
  betaContactConsent?: unknown;
  source?: unknown;
  shareMomentId?: unknown;
}): Promise<BetaRequestSubmission> {
  await enforceRequestRateLimit(input.request);
  const requestedUsername = String(input.username ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_-]{2,50}$/.test(requestedUsername)) throw Object.assign(new Error("Enter a valid Chess.com username."), { status: 400 });
  const hasLegacyContactInput = input.preferredContactMethod !== undefined || input.preferredContactValue !== undefined || input.betaContactConsent !== undefined;
  const contact = hasLegacyContactInput ? validateContact(input.preferredContactMethod, input.preferredContactValue, input.betaContactConsent) : undefined;
  const identity = identityFromResolved(await resolveChessComPlayer(requestedUsername));
  const db = getAdminDb();
  const id = String(identity.playerId);
  const ref = db.collection("betaRequests").doc(id);
  const existingAccount = await existingStableAccount(identity);
  if (existingAccount?.accessStatus === "active") {
    return {
      request: {
        id,
        chessPlayerId: identity.playerId,
        canonicalUsername: identity.canonicalUsername,
        avatar: identity.avatar,
        profileUrl: identity.profileUrl,
        ...(contact ? { preferredContactMethod: contact.method, preferredContactValue: contact.value, betaContactConsent: true as const } : {}),
        requestedAt: existingAccount.lastSeenAt ?? new Date().toISOString(),
        status: "approved",
        statusTokenHash: "",
        firebaseUid: existingAccount.uid,
      },
      existingState: "active_account",
    };
  }

  const previousSnapshot = await ref.get();
  const previous = previousSnapshot.exists ? previousSnapshot.data() as FoundingBetaRequest : undefined;
  if (previous && ["pending", "approved"].includes(previous.status)) {
    let preview = previous.previewSnapshot;
    let previewError = previous.previewError;
    if (!preview) {
      const generated = await generateAndStorePreview(ref, identity);
      preview = generated.preview;
      previewError = generated.previewError;
    }
    // Never issue a new claim-capable status credential from username + contact knowledge alone.
    // The original opaque credential remains the possession factor for an open Preview tab;
    // otherwise access recovery goes through the configured delivery/founder path.
    return {
      request: { ...previous, previewSnapshot: preview, previewError },
      preview,
      previewError,
      existingState: previous.status === "pending" ? "pending" : "approved_unclaimed",
    };
  }

  const now = new Date().toISOString();
  const source = input.source === "boardSignalShare" ? "boardSignalShare" as const : undefined;
  const shareMomentId = source && /^[A-Za-z0-9_-]{3,220}$/.test(String(input.shareMomentId ?? "")) ? String(input.shareMomentId) : undefined;
  const credential = createBetaPreviewStatusCredential();
  const record: FoundingBetaRequest = {
    id,
    chessPlayerId: identity.playerId,
    canonicalUsername: identity.canonicalUsername,
    avatar: identity.avatar,
    profileUrl: identity.profileUrl,
    ...(contact ? { preferredContactMethod: contact.method, preferredContactValue: contact.value, betaContactConsent: true as const, activationReturnMethod: contact.method as BetaActivationReturnMethod } : {}),
    requestedAt: now,
    status: "pending",
    identityReviewStatus: "pending",
    source,
    shareMomentId,
    statusTokenHash: credential.hash,
  };
  await ref.set(clean(record));
  const generated = await generateAndStorePreview(ref, identity);
  const founderAlertAttemptedAt = new Date().toISOString();
  const founderAlert = await notifyFounderOfBetaRequest({ requestId: id, canonicalUsername: identity.canonicalUsername, previewReady: Boolean(generated.preview) }).catch(() => ({ delivered: 0, failed: 1, eligible: true }));
  const founderAlertRequest = {
    status: (founderAlert.delivered > 0 ? "delivered" : founderAlert.eligible ? "failed" : "not_eligible") as "delivered" | "failed" | "not_eligible",
    attemptedAt: founderAlertAttemptedAt,
  };
  await ref.set({ founderAlertRequest, ...(founderAlert.delivered > 0 ? { founderAlertSentAt: founderAlertAttemptedAt } : {}) }, { merge: true }).catch(() => undefined);
  const finalRecord = { ...record, founderAlertRequest, previewSnapshot: generated.preview, previewGeneratedAt: generated.preview?.generatedAt, previewError: generated.previewError };
  return { request: finalRecord, statusToken: credential.token, preview: generated.preview, previewError: generated.previewError };
}

export async function retryFoundingBetaPreview(requestId: string) {
  const ref = getAdminDb().collection("betaRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The Founding Access request was not found."), { status: 404 });
  const request = snapshot.data() as FoundingBetaRequest;
  const identity: StableChessComIdentity = { playerId: request.chessPlayerId, canonicalUsername: request.canonicalUsername, avatar: request.avatar, profileUrl: request.profileUrl };
  return generateAndStorePreview(ref, identity);
}

export async function updateFoundingBetaReturnPreference(input: { requestId: string; statusToken: unknown; method: unknown; contactValue?: unknown; betaContactConsent?: unknown }) {
  const verified = await verifyBetaPreviewStatusCredential(input.requestId, input.statusToken);
  const snapshot = await verified.ref.get();
  const request = snapshot.data() as FoundingBetaRequest;
  if (request.status !== "pending") throw Object.assign(new Error("Return settings can only change while this Preview is pending."), { status: 409, code: "PREVIEW_RETURN_LOCKED" });
  const method = String(input.method ?? "") as BetaActivationReturnMethod;
  if (!["device", "email", "discord", "telegram", "return_here"].includes(method)) throw Object.assign(new Error("Choose how BoardSignal should bring you back."), { status: 400 });
  const now = new Date().toISOString();
  if (method === "email") {
    const contact = validateContact(method, input.contactValue, input.betaContactConsent);
    // F.2: this is a narrow one-time Founder-review confirmation address.
    // Do not silently turn it into the Player Room's ongoing email preference.
    await verified.ref.set(clean({
      activationReturnMethod: method,
      activationReturnUpdatedAt: now,
      approvalAlertEmail: contact.value,
      approvalAlertEmailConsent: true,
      activationDevice: null,
      approvalAlertDevice: null,
    }), { merge: true });
  } else if (method === "discord" || method === "telegram") {
    // Legacy compatibility: preserve historical contact methods when an older
    // client submits them, but F.2 does not advertise them as automatic alerts.
    const contact = validateContact(method, input.contactValue, input.betaContactConsent);
    await verified.ref.set(clean({ activationReturnMethod: method, activationReturnUpdatedAt: now, preferredContactMethod: contact.method, preferredContactValue: contact.value, betaContactConsent: true, activationDevice: null, approvalAlertDevice: null }), { merge: true });
  } else if (method === "return_here") {
    await verified.ref.set(clean({ activationReturnMethod: method, activationReturnUpdatedAt: now, activationDevice: null, approvalAlertDevice: null }), { merge: true });
  } else {
    throw Object.assign(new Error("Use Notify this device to enable device alerts."), { status: 400, code: "PREVIEW_DEVICE_ACTION_REQUIRED" });
  }
  const refreshed = await verified.ref.get();
  return refreshed.data() as FoundingBetaRequest;
}

export async function rememberFoundingBetaApprovalDevice(input: { requestId: string; statusToken: unknown }) {
  const verified = await verifyBetaPreviewStatusCredential(input.requestId, input.statusToken);
  const snapshot = await verified.ref.get();
  const request = snapshot.data() as FoundingBetaRequest;
  if (request.status !== "pending" || request.activationReturnMethod !== "device" || !request.activationDevice?.token) {
    return request;
  }
  // Keep a server-owned copy specifically for the one Founder-review alert.
  // Provisional claim may retire the Preview activationDevice, but this copy
  // remains until the player changes away from Device or delivery completes.
  await verified.ref.set(clean({ approvalAlertDevice: request.activationDevice }), { merge: true });
  return { ...request, approvalAlertDevice: request.activationDevice };
}

export function withFoundingBetaApprovalAlertStatus(status: BetaPreviewStatus, request: FoundingBetaRequest): BetaPreviewStatus {
  if (request.activationReturnMethod !== "email" || request.approvalAlertEmailConsent !== true || !request.approvalAlertEmail) return status;
  return {
    ...status,
    preferredContactMethod: "email",
    preferredContactValue: request.approvalAlertEmail,
    betaContactConsent: true,
  };
}

export async function listFoundingBetaRequests(status?: BetaRequestStatus) {
  const snapshot = await getAdminDb().collection("betaRequests").get();
  return snapshot.docs.map((document) => document.data() as FoundingBetaRequest).filter((request) => !status || request.status === status).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

function newPlayerUniverseEvent(request: FoundingBetaRequest, decidedAt: string): PublicUniverseEvent {
  return {
    eventId: createHash("sha256").update(`new-player:${request.chessPlayerId}`).digest("hex"),
    eventType: "new_player",
    playerId: String(request.chessPlayerId),
    canonicalUsername: request.canonicalUsername,
    avatar: request.avatar,
    occurredAt: decidedAt,
    publishedAt: decidedAt,
    headline: `${request.canonicalUsername} has entered the BoardSignal Universe.`,
    supportingFact: "First Review forming.",
    dataMode: "live",
    finality: "official",
    safePublic: true,
  };
}

function accessMessage(username: string, link: string) {
  return `Your BoardSignal is ready — open your private Player Room here:\n${link}`;
}

async function reconcileConfirmedPublicHighlights(account: BoardSignalAccount) {
  try {
    return await ensureSafePublicCoverageForAccount(account);
  } catch (error) {
    return {
      status: "repair_needed" as const,
      repairAvailable: true,
      error: error instanceof Error ? error.message : "Public highlights could not be reconciled.",
    };
  }
}

export async function approveFoundingBetaRequest(requestId: string) {
  const db = getAdminDb();
  const ref = db.collection("betaRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The Founding Access request was not found."), { status: 404 });
  const request = snapshot.data() as FoundingBetaRequest;
  if (request.status !== "pending") throw Object.assign(new Error(`This request is already ${request.status}.`), { status: 409 });

  // Approval reuses the stable Chess.com identity already verified at request time.
  // Do not make a second username lookup the authority for account ownership.
  const identity: StableChessComIdentity = {
    playerId: request.chessPlayerId,
    canonicalUsername: request.canonicalUsername,
    avatar: request.avatar,
    profileUrl: request.profileUrl,
  };
  const stableAccount = await ensureStablePlayerAccount(identity);
  if (stableAccount.uid !== `chesscom_${request.chessPlayerId}` || stableAccount.chessCom.playerId !== request.chessPlayerId) {
    throw Object.assign(new Error("The Founding Access request no longer matches its stable BoardSignal identity."), { status: 409, code: "BETA_IDENTITY_MISMATCH" });
  }

  let result: { account?: BoardSignalAccount; accessCode?: string };
  try {
    result = await createFoundingBetaAccess(request.canonicalUsername);
  } catch (error) {
    if (String((error as { code?: string }).code) !== "BETA_ACCESS_EXISTS") throw error;
    // Legacy compatibility: an existing fallback credential is already valid.
    // Reuse it without rotating its hash/salt and without revoking Firebase sessions.
    const existing = await loadExistingFoundingBetaAccess(request.chessPlayerId);
    result = { account: existing.account };
  }
  if (!result.account) throw Object.assign(new Error("The existing Founding Access identity could not be loaded."), { status: 409 });
  const account = result.account;
  if (account.uid !== stableAccount.uid || account.uid !== `chesscom_${request.chessPlayerId}` || account.chessCom.playerId !== request.chessPlayerId) {
    throw Object.assign(new Error("The Founding Access result no longer matches its verified request identity."), { status: 409, code: "BETA_IDENTITY_MISMATCH" });
  }
  const decidedAt = new Date().toISOString();
  const currentPreferences = account.notificationPreferences ?? defaultNotificationPreferences();
  const validExternalContact = Boolean(request.preferredContactMethod && request.preferredContactValue && request.betaContactConsent === true);
  const completedReturnDecision = Boolean(request.activationReturnMethod || validExternalContact);
  const notificationPreferences = {
    ...defaultNotificationPreferences(),
    ...currentPreferences,
    // This one-time approval-alert choice does not opt the player into ongoing email notifications.
    email: currentPreferences.email ?? false,
    browserPush: currentPreferences.browserPush ?? false,
    deskReady: currentPreferences.deskReady ?? true,
    episodeProgress: currentPreferences.episodeProgress ?? true,
    blueReminder: currentPreferences.blueReminder ?? true,
    universeAchievement: currentPreferences.universeAchievement ?? true,
    founderUpdates: currentPreferences.founderUpdates ?? true,
  };
  const confirmedAccount: BoardSignalAccount = {
    ...account,
    ...(validExternalContact ? { preferredContactMethod: request.preferredContactMethod, preferredContactValue: request.preferredContactValue, betaContactConsent: true } : {}),
    ...(completedReturnDecision ? { contactConfirmedAt: account.contactConfirmedAt ?? decidedAt, preferencesConfirmedAt: account.preferencesConfirmedAt ?? decidedAt } : {}),
    universeParticipationDisclosedAt: account.universeParticipationDisclosedAt ?? decidedAt,
    identityStatus: "founder_reviewed",
    identityReviewStatus: "confirmed",
    founderReviewedAt: account.founderReviewedAt ?? decidedAt,
    privacy: { ...account.privacy, publicPlayerPage: true, universeCoverage: true },
    notificationPreferences,
  };
  await db.collection("users").doc(account.uid).set(clean({
    ...(validExternalContact ? { preferredContactMethod: request.preferredContactMethod, preferredContactValue: request.preferredContactValue, betaContactConsent: true } : {}),
    ...(completedReturnDecision ? { contactConfirmedAt: account.contactConfirmedAt ?? decidedAt, preferencesConfirmedAt: account.preferencesConfirmedAt ?? decidedAt } : {}),
    universeParticipationDisclosedAt: account.universeParticipationDisclosedAt ?? decidedAt,
    identityStatus: "founder_reviewed",
    identityReviewStatus: "confirmed",
    founderReviewedAt: account.founderReviewedAt ?? decidedAt,
    privacy: { ...account.privacy, publicPlayerPage: true, universeCoverage: true },
    notificationPreferences,
  }), { merge: true });
  await db.collection("publicPlayers").doc(String(request.chessPlayerId)).set(clean({
    chessPlayerId: String(request.chessPlayerId), username: request.canonicalUsername, usernameKey: request.canonicalUsername.toLowerCase(), avatar: request.avatar, profileUrl: request.profileUrl, pageEnabled: true,
  }), { merge: true });
  const publicHighlights = await reconcileConfirmedPublicHighlights(confirmedAccount);

  await writePublicUniverseEvent(newPlayerUniverseEvent(request, decidedAt));
  const magic = betaMagicAccessCredential(request.id, request.chessPlayerId, account.uid, new Date(decidedAt));
  await ref.set({ status: "approved", identityReviewStatus: "confirmed", decidedAt, firebaseUid: account.uid, magicAccess: magic.record, claimedAt: null, previewClaimConsumedAt: null }, { merge: true });

  // Shared Founder-confirmation delivery policy. Identity truth is already committed;
  // notification delivery is secondary and may fail without rolling approval back.
  const identityConfirmationDelivery = await deliverFoundingBetaIdentityConfirmation({
    requestId: request.id,
    playerAlreadyInside: false,
    magicLink: magic.link,
  }).catch(() => ({ channel: "none" as const, status: "failed" as const }));
  const accessEmailDelivery: FoundingBetaRequest["accessEmailDelivery"] = identityConfirmationDelivery.channel === "email"
    ? identityConfirmationDelivery.status === "delivered" ? "delivered"
      : identityConfirmationDelivery.status === "not_configured" ? "not_configured"
        : identityConfirmationDelivery.status === "not_eligible" ? "not_eligible" : "failed"
    : "not_eligible";
  const deviceDelivery: FoundingBetaRequest["activationDeviceDelivery"] = identityConfirmationDelivery.channel === "device"
    ? identityConfirmationDelivery.status === "delivered" ? "delivered"
      : identityConfirmationDelivery.status === "not_eligible" || identityConfirmationDelivery.status === "not_configured" ? "not_eligible" : "failed"
    : "not_eligible";

  return {
    request: { ...request, status: "approved" as const, identityReviewStatus: "confirmed" as const, decidedAt, firebaseUid: account.uid, magicAccess: magic.record, identityConfirmationDelivery, accessEmailDelivery, activationDeviceDelivery: deviceDelivery },
    account: confirmedAccount,
    accessCode: result.accessCode,
    magicLink: magic.link,
    magicAccessExpiresAt: magic.expiresAt,
    approvalMessage: accessMessage(request.canonicalUsername, magic.link),
    accessEmailDelivery,
    deviceDelivery,
    identityConfirmationDelivery,
    publicHighlights,
  };
}

export async function confirmFoundingBetaIdentity(requestId: string) {
  const db = getAdminDb();
  const ref = db.collection("betaRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The Founding Access request was not found."), { status: 404 });
  const request = snapshot.data() as FoundingBetaRequest;
  if (request.status === "approved" && request.identityReviewStatus === "confirmed") {
    const playerAlreadyInside = Boolean(request.provisionalClaimedAt || request.claimedAt);
    const identityConfirmationDelivery = await deliverFoundingBetaIdentityConfirmation({ requestId, playerAlreadyInside })
      .catch(() => request.identityConfirmationDelivery ?? { channel: "none" as const, status: "failed" as const });
    return { request: { ...request, identityConfirmationDelivery }, identityConfirmationDelivery, alreadyConfirmed: true, playerAlreadyInside };
  }
  if (request.status !== "pending" || request.identityReviewStatus === "rejected") {
    throw Object.assign(new Error("This Founding Access identity cannot be confirmed from its current state."), { status: 409 });
  }

  // If the player has not entered yet, preserve the existing reviewed-approval
  // flow so historical magic/Beta recovery remains compatible.
  if (!request.provisionalClaimedAt) {
    const approved = await approveFoundingBetaRequest(requestId);
    return { ...approved, alreadyConfirmed: false, playerAlreadyInside: false };
  }

  const uid = request.firebaseUid ?? `chesscom_${request.chessPlayerId}`;
  const userRef = db.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  const account = userSnapshot.data() as BoardSignalAccount | undefined;
  if (!account || account.uid !== uid || account.chessCom?.playerId !== request.chessPlayerId || account.identityStatus !== "provisional") {
    throw Object.assign(new Error("The provisional Player Room no longer matches this stable request identity."), { status: 409, code: "PROVISIONAL_IDENTITY_MISMATCH" });
  }
  const decidedAt = new Date().toISOString();
  const confirmedAccount: BoardSignalAccount = {
    ...account,
    identityStatus: "founder_reviewed",
    identityReviewStatus: "confirmed",
    founderReviewedAt: decidedAt,
    universeParticipationDisclosedAt: account.universeParticipationDisclosedAt ?? decidedAt,
    privacy: { ...account.privacy, publicPlayerPage: true, universeCoverage: true },
  };
  await userRef.set(clean({
    identityStatus: "founder_reviewed",
    identityReviewStatus: "confirmed",
    founderReviewedAt: decidedAt,
    universeParticipationDisclosedAt: account.universeParticipationDisclosedAt ?? decidedAt,
    privacy: { ...account.privacy, publicPlayerPage: true, universeCoverage: true },
  }), { merge: true });
  await db.collection("publicPlayers").doc(String(request.chessPlayerId)).set(clean({
    chessPlayerId: String(request.chessPlayerId),
    username: request.canonicalUsername,
    usernameKey: request.canonicalUsername.toLowerCase(),
    avatar: request.avatar,
    profileUrl: request.profileUrl,
    pageEnabled: true,
  }), { merge: true });
  const publicHighlights = await reconcileConfirmedPublicHighlights(confirmedAccount);
  await ref.set({ status: "approved", identityReviewStatus: "confirmed", decidedAt }, { merge: true });
  await writePublicUniverseEvent(newPlayerUniverseEvent(request, decidedAt));
  const identityConfirmationDelivery = await deliverFoundingBetaIdentityConfirmation({ requestId, playerAlreadyInside: true })
    .catch(() => ({ channel: "none" as const, status: "failed" as const }));
  return {
    request: { ...request, status: "approved" as const, identityReviewStatus: "confirmed" as const, decidedAt, identityConfirmationDelivery },
    account: confirmedAccount,
    publicHighlights,
    identityConfirmationDelivery,
    alreadyConfirmed: false,
    playerAlreadyInside: true,
  };
}

export async function revokeProvisionalFoundingBetaIdentity(requestId: string) {
  const db = getAdminDb();
  const ref = db.collection("betaRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The Founding Access request was not found."), { status: 404 });
  const request = snapshot.data() as FoundingBetaRequest;
  if (!request.provisionalClaimedAt) {
    if (request.status === "pending") return rejectFoundingBetaRequest(requestId);
    throw Object.assign(new Error("Only an active provisional Player Room can be revoked here."), { status: 409 });
  }
  const uid = request.firebaseUid ?? `chesscom_${request.chessPlayerId}`;
  const userRef = db.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  const account = userSnapshot.data() as BoardSignalAccount | undefined;
  if (!account || account.chessCom?.playerId !== request.chessPlayerId || account.identityStatus !== "provisional") {
    throw Object.assign(new Error("This request is not an active provisional BoardSignal identity."), { status: 409, code: "PROVISIONAL_REVOKE_BLOCKED" });
  }
  const revokedAt = new Date().toISOString();
  await userRef.set({ identityStatus: "revoked", identityReviewStatus: "rejected", accessStatus: "paused" }, { merge: true });
  await ref.set({ status: "rejected", identityReviewStatus: "rejected", decidedAt: revokedAt, revokedAt, activationDevice: null }, { merge: true });
  await getAdminAuth().revokeRefreshTokens(uid);
  return { request: { ...request, status: "rejected" as const, identityReviewStatus: "rejected" as const, decidedAt: revokedAt, revokedAt }, uid, revokedAt };
}

export async function regenerateFoundingBetaMagicAccess(requestId: string) {
  const ref = getAdminDb().collection("betaRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The Founding Access request was not found."), { status: 404 });
  const request = snapshot.data() as FoundingBetaRequest;
  const provisionalRecovery = request.status === "pending" && Boolean(request.provisionalClaimedAt) && request.identityReviewStatus !== "rejected";
  if (!(request.status === "approved" || provisionalRecovery)) throw Object.assign(new Error("Private recovery access is not available for this request yet."), { status: 409 });
  const uid = request.firebaseUid ?? `chesscom_${request.chessPlayerId}`;
  const magic = betaMagicAccessCredential(request.id, request.chessPlayerId, uid);
  await ref.set(clean({ magicAccess: { ...magic.record, consumedAt: null }, claimedAt: null, previewClaimConsumedAt: null }), { merge: true });
  return { request, magicLink: magic.link, magicAccessExpiresAt: magic.expiresAt, approvalMessage: accessMessage(request.canonicalUsername, magic.link) };
}

export async function rejectFoundingBetaRequest(requestId: string) {
  const ref = getAdminDb().collection("betaRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The Founding Access request was not found."), { status: 404 });
  const request = snapshot.data() as FoundingBetaRequest;
  if (request.status !== "pending") throw Object.assign(new Error(`This request is already ${request.status}.`), { status: 409 });
  const decidedAt = new Date().toISOString();
  await ref.set({ status: "rejected", decidedAt, activationDevice: null }, { merge: true });
  return { ...request, status: "rejected" as const, decidedAt };
}
