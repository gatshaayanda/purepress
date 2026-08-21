import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { StableChessComIdentity } from "../account";

export const BETA_ACCESS_MAX_FAILED_ATTEMPTS = 5;
export const BETA_ACCESS_LOCK_MINUTES = 15;

const ACCESS_CODE_PATTERN = /^BS-[A-Za-z0-9_-]{24,64}$/;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export type BetaAccessStatus = "active" | "revoked";

export type BetaAccessRecord = {
  playerId: number;
  canonicalUsername: string;
  passHash: string;
  passSalt: string;
  status: BetaAccessStatus;
  createdAt: string;
  resetAt?: string;
  failedAttempts: number;
  lockedUntil?: string;
};

export type BetaAccessAttempt =
  | { ok: true; code: "BETA_ACCESS_ACCEPTED"; patch: Pick<BetaAccessRecord, "failedAttempts"> & { lockedUntil: null } }
  | { ok: false; code: "BETA_ACCESS_INVALID" | "BETA_ACCESS_REVOKED" | "BETA_ACCESS_LOCKED"; patch?: Omit<Partial<BetaAccessRecord>, "lockedUntil"> & { lockedUntil?: string | null } };

export function isValidBetaAccessCode(value: string) {
  return ACCESS_CODE_PATTERN.test(value);
}

export function generateBetaAccessCode() {
  return `BS-${randomBytes(24).toString("base64url")}`;
}

export function hashBetaAccessCode(accessCode: string, salt: string) {
  return scryptSync(accessCode, Buffer.from(salt, "base64url"), SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS).toString("base64url");
}

export function createBetaAccessCredential(
  identity: StableChessComIdentity,
  now = new Date(),
  existing?: Pick<BetaAccessRecord, "createdAt">,
) {
  const accessCode = generateBetaAccessCode();
  const passSalt = randomBytes(18).toString("base64url");
  const timestamp = now.toISOString();
  const record: BetaAccessRecord = {
    playerId: identity.playerId,
    canonicalUsername: identity.canonicalUsername,
    passHash: hashBetaAccessCode(accessCode, passSalt),
    passSalt,
    status: "active",
    createdAt: existing?.createdAt ?? timestamp,
    ...(existing ? { resetAt: timestamp } : {}),
    failedAttempts: 0,
  };
  return { accessCode, record };
}

export function verifyBetaAccessCode(accessCode: string, record: Pick<BetaAccessRecord, "passHash" | "passSalt">) {
  if (!isValidBetaAccessCode(accessCode)) return false;
  const expected = Buffer.from(record.passHash, "base64url");
  const submitted = Buffer.from(hashBetaAccessCode(accessCode, record.passSalt), "base64url");
  return expected.length === submitted.length && timingSafeEqual(expected, submitted);
}

export function evaluateBetaAccessAttempt(
  record: BetaAccessRecord,
  accessCode: string,
  now = new Date(),
): BetaAccessAttempt {
  if (record.status === "revoked") return { ok: false, code: "BETA_ACCESS_REVOKED" };

  const lockedUntil = record.lockedUntil ? new Date(record.lockedUntil) : undefined;
  if (lockedUntil && Number.isFinite(lockedUntil.getTime()) && lockedUntil.getTime() > now.getTime()) {
    return { ok: false, code: "BETA_ACCESS_LOCKED" };
  }

  if (verifyBetaAccessCode(accessCode, record)) {
    return { ok: true, code: "BETA_ACCESS_ACCEPTED", patch: { failedAttempts: 0, lockedUntil: null } };
  }

  const failuresBeforeAttempt = lockedUntil ? 0 : Math.max(0, record.failedAttempts || 0);
  const failedAttempts = failuresBeforeAttempt + 1;
  if (failedAttempts >= BETA_ACCESS_MAX_FAILED_ATTEMPTS) {
    return {
      ok: false,
      code: "BETA_ACCESS_LOCKED",
      patch: {
        failedAttempts: 0,
        lockedUntil: new Date(now.getTime() + BETA_ACCESS_LOCK_MINUTES * 60_000).toISOString(),
      },
    };
  }
  return { ok: false, code: "BETA_ACCESS_INVALID", patch: { failedAttempts, lockedUntil: null } };
}
