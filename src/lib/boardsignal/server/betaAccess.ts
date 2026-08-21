import "server-only";

import type { BoardSignalAccount, FounderPlayerIdentityRow, StableChessComIdentity } from "../account";
import {
  createBetaAccessCredential,
  evaluateBetaAccessAttempt,
  isValidBetaAccessCode,
  type BetaAccessRecord,
} from "../auth/betaAccess";
import { resolveChessComPlayer } from "../processor";
import { getAdminAuth, getAdminDb } from "../../../utils/firebaseAdmin";
import { ensureStablePlayerAccount } from "./persistence";
import { inspectSafePublicCoverageForAccount } from "./publicCoverageRepair";

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{2,50}$/;

export type BetaAccessFailureCode = "BETA_ACCESS_INVALID" | "BETA_ACCESS_REVOKED" | "BETA_ACCESS_LOCKED";

function betaAccessError(code: BetaAccessFailureCode) {
  const status = code === "BETA_ACCESS_LOCKED" ? 429 : code === "BETA_ACCESS_REVOKED" ? 403 : 401;
  const message = code === "BETA_ACCESS_LOCKED"
    ? "Founding Access is temporarily locked after repeated unsuccessful attempts. Try again later or ask BoardSignal for a reset."
    : code === "BETA_ACCESS_REVOKED"
      ? "This Founding Access has been revoked. Ask BoardSignal for a new private access code."
      : "The Chess.com username and private access code did not match an active Founding Access account.";
  return Object.assign(new Error(message), { status, code });
}

function normalizeUsername(value: string) {
  const username = value.trim().replace(/^@/, "");
  if (!USERNAME_PATTERN.test(username)) {
    throw Object.assign(new Error("Enter a valid Chess.com username."), { status: 400, code: "INVALID_USERNAME" });
  }
  return username;
}

function validatePlayerId(value: unknown) {
  const playerId = Number(value);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw Object.assign(new Error("A stable Chess.com player ID is required."), { status: 400, code: "INVALID_PLAYER_ID" });
  }
  return playerId;
}

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function revokeExistingFirebaseSession(uid: string) {
  const auth = getAdminAuth();
  try {
    await auth.getUser(uid);
    await auth.revokeRefreshTokens(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
}

function stableIdentityFromResolved(resolved: Awaited<ReturnType<typeof resolveChessComPlayer>>): StableChessComIdentity {
  if (!Number.isSafeInteger(resolved.playerId) || !resolved.playerId) {
    throw Object.assign(new Error("Chess.com did not return the stable player ID BoardSignal requires."), { status: 422, code: "STABLE_PLAYER_ID_MISSING" });
  }
  return {
    playerId: resolved.playerId,
    canonicalUsername: resolved.username,
    avatar: resolved.avatar,
    profileUrl: resolved.profileUrl,
  };
}

export async function authenticateFoundingBetaAccess(usernameInput: string, accessCodeInput: string) {
  const username = normalizeUsername(usernameInput);
  const accessCode = accessCodeInput.trim();
  if (!isValidBetaAccessCode(accessCode)) throw betaAccessError("BETA_ACCESS_INVALID");

  const resolved = await resolveChessComPlayer(username);
  const identity = stableIdentityFromResolved(resolved);
  const db = getAdminDb();
  const accessRef = db.collection("betaAccess").doc(String(identity.playerId));
  const attempt = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(accessRef);
    if (!snapshot.exists) return { ok: false, code: "BETA_ACCESS_INVALID" as const };
    const record = snapshot.data() as BetaAccessRecord;
    if (record.playerId !== identity.playerId) return { ok: false, code: "BETA_ACCESS_INVALID" as const };
    const result = evaluateBetaAccessAttempt(record, accessCode);
    if (result.patch) {
      transaction.set(accessRef, clean({ ...result.patch, canonicalUsername: identity.canonicalUsername }), { merge: true });
    }
    return result;
  });

  if (!attempt.ok) throw betaAccessError(attempt.code);
  const account = await ensureStablePlayerAccount(identity);
  if (account.accessStatus !== "active") {
    throw Object.assign(new Error("This BoardSignal account is not active."), { status: 403, code: "ACCOUNT_NOT_ACTIVE" });
  }
  return { account, identity };
}

export async function createFoundingBetaAccess(usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  const resolved = await resolveChessComPlayer(username);
  const identity = stableIdentityFromResolved(resolved);
  const account = await ensureStablePlayerAccount(identity);
  const ref = getAdminDb().collection("betaAccess").doc(String(identity.playerId));
  const existing = await ref.get();
  if (existing.exists) {
    throw Object.assign(new Error("Founding Access already exists for this player. Use Reset Access to issue a new code."), { status: 409, code: "BETA_ACCESS_EXISTS" });
  }
  const credential = createBetaAccessCredential(identity);
  await ref.create(clean(credential.record));
  return { account, accessCode: credential.accessCode };
}

export async function loadExistingFoundingBetaAccess(playerIdInput: unknown) {
  const playerId = validatePlayerId(playerIdInput);
  const db = getAdminDb();
  const accessRef = db.collection("betaAccess").doc(String(playerId));
  const accessSnapshot = await accessRef.get();
  if (!accessSnapshot.exists) {
    throw Object.assign(new Error("No Founding Access record exists for this player."), { status: 404, code: "BETA_ACCESS_NOT_FOUND" });
  }
  const record = accessSnapshot.data() as BetaAccessRecord;
  if (record.playerId !== playerId) {
    throw Object.assign(new Error("The Founding Access record does not match this stable player ID."), { status: 409, code: "BETA_ACCESS_IDENTITY_MISMATCH" });
  }

  const mapSnapshot = await db.collection("chessPlayerAccounts").doc(String(playerId)).get();
  const mappedUid = typeof mapSnapshot.data()?.uid === "string" ? String(mapSnapshot.data()!.uid) : `chesscom_${playerId}`;
  const accountSnapshot = await db.collection("users").doc(mappedUid).get();
  const account = accountSnapshot.data() as BoardSignalAccount | undefined;
  if (!account || account.uid !== mappedUid || account.chessCom?.playerId !== playerId) {
    throw Object.assign(new Error("The existing Founding Access account could not be loaded for this stable player ID."), { status: 409, code: "BETA_ACCOUNT_NOT_FOUND" });
  }

  // Compatibility path only: reading an existing Beta Access record must never
  // rotate its hash/salt or revoke the player's already-valid Firebase session.
  return { account, record };
}

export async function resetFoundingBetaAccess(playerIdInput: unknown) {
  const playerId = validatePlayerId(playerIdInput);
  const db = getAdminDb();
  const ref = db.collection("betaAccess").doc(String(playerId));
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("No Founding Access record exists for this player."), { status: 404, code: "BETA_ACCESS_NOT_FOUND" });
  const previous = snapshot.data() as BetaAccessRecord;
  const accountSnapshot = await db.collection("users").doc(`chesscom_${playerId}`).get();
  const account = accountSnapshot.data() as BoardSignalAccount | undefined;
  const identity = account?.chessCom ?? { playerId, canonicalUsername: previous.canonicalUsername };
  const credential = createBetaAccessCredential(identity, new Date(), previous);
  await ref.set(clean(credential.record));
  if (account?.uid) await revokeExistingFirebaseSession(account.uid);
  return { account, accessCode: credential.accessCode };
}

export async function revokeFoundingBetaAccess(playerIdInput: unknown) {
  const playerId = validatePlayerId(playerIdInput);
  const ref = getAdminDb().collection("betaAccess").doc(String(playerId));
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("No Founding Access record exists for this player."), { status: 404, code: "BETA_ACCESS_NOT_FOUND" });
  await ref.set({ status: "revoked", failedAttempts: 0, lockedUntil: null }, { merge: true });
  await revokeExistingFirebaseSession(`chesscom_${playerId}`);
  return { playerId, status: "revoked" as const };
}

export async function listFounderPlayerIdentities(): Promise<FounderPlayerIdentityRow[]> {
  const db = getAdminDb();
  const [users, access] = await Promise.all([
    db.collection("users").get(),
    db.collection("betaAccess").get(),
  ]);
  const accessByPlayer = new Map(access.docs.map((document) => [document.id, document.data() as BetaAccessRecord]));
  const accounts = users.docs
    .map((document) => document.data() as BoardSignalAccount)
    .filter((account) => account.role === "player" && Number.isSafeInteger(account.chessCom?.playerId));

  return Promise.all(accounts.map(async (account) => {
    const publicHighlights = await inspectSafePublicCoverageForAccount(account);
    const betaAccess = accessByPlayer.get(String(account.chessCom.playerId));
    const betaAccessStatus: FounderPlayerIdentityRow["betaAccessStatus"] = betaAccess?.status ?? "not_created";
    return {
      uid: account.uid,
      username: account.chessCom.canonicalUsername,
      playerId: account.chessCom.playerId,
      avatar: account.chessCom.avatar,
      profileUrl: account.chessCom.profileUrl,
      betaAccessStatus,
      accountStatus: account.accessStatus,
      desksStored: publicHighlights.retainedReviews,
      latestDesk: publicHighlights.latestReview,
      publicHighlights: {
        status: publicHighlights.status,
        retainedReviews: publicHighlights.retainedReviews,
        expectedCoverage: publicHighlights.expectedCoverage,
        liveCoverage: publicHighlights.liveCoverage,
        repairAvailable: publicHighlights.repairAvailable,
      },
      lastSeen: account.lastSeenAt,
      oauthLinked: Boolean(account.chessComOAuthLinkedAt),
      preferredContactMethod: account.betaContactConsent === true ? account.preferredContactMethod : undefined,
      preferredContactValue: account.betaContactConsent === true ? account.preferredContactValue : undefined,
      betaContactConsent: account.betaContactConsent,
      identityStatus: account.identityStatus ?? (account.chessComOAuthLinkedAt ? "oauth_verified" : undefined),
    };
  })).then((rows) => rows.sort((a, b) => a.username.localeCompare(b.username)));
}
