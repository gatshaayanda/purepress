import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getAdminDb } from "@/utils/firebaseAdmin";
import { QUOTE_ARTWORK_MAX_FILES } from "../uploads";

export const QUOTE_INTAKE_SESSIONS_COLLECTION = "purepressQuoteIntakeSessions";
export const QUOTE_JOB_FILES_COLLECTION = "purepressJobFiles";
export const QUOTE_INTAKE_TTL_MS = 15 * 60 * 1000;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const localRateWindow = new Map<string, number[]>();

export interface QuoteIntakeAuthorization {
  intakeId: string;
  scope: "quote_artwork";
  expiresAt: string;
}

interface StoredQuoteIntakeSession {
  scope: "quote_artwork";
  tokenHash: string;
  state: "active" | "consumed";
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  uploadCount: number;
  maxFiles: number;
  uploadedFileIds: string[];
  consumedAt?: string;
  quoteRequestId?: string;
}

function digestToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function tokenHashMatches(storedHash: unknown, token: string) {
  if (typeof storedHash !== "string" || !/^[a-f0-9]{64}$/.test(storedHash) || !token) return false;
  const expected = Buffer.from(storedHash, "hex");
  const supplied = Buffer.from(digestToken(token), "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function clientRateKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const vercelIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const agent = request.headers.get("user-agent")?.slice(0, 180) ?? "";
  return createHash("sha256").update(`${forwarded || vercelIp || "unknown"}|${agent}`).digest("hex");
}

function assertSessionCreationRate(request: Request) {
  const now = Date.now();
  const key = clientRateKey(request);
  const recent = (localRateWindow.get(key) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    throw Object.assign(new Error("Too many quote intake sessions. Please try again shortly."), { status: 429 });
  }
  recent.push(now);
  localRateWindow.set(key, recent);
}

export async function createQuoteIntakeSession(request: Request) {
  assertSessionCreationRate(request);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUOTE_INTAKE_TTL_MS);
  const intakeId = `qis_${randomBytes(16).toString("hex")}`;
  const token = randomBytes(32).toString("base64url");
  const record: StoredQuoteIntakeSession = {
    scope: "quote_artwork",
    tokenHash: digestToken(token),
    state: "active",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    uploadCount: 0,
    maxFiles: QUOTE_ARTWORK_MAX_FILES,
    uploadedFileIds: [],
  };
  await getAdminDb().collection(QUOTE_INTAKE_SESSIONS_COLLECTION).doc(intakeId).set(record);
  return { intakeId, token, expiresAt: record.expiresAt, scope: record.scope } as const;
}

export function assertStoredQuoteIntakeSession(
  data: Record<string, unknown>,
  token: string,
  expectedFileIds?: readonly string[],
) {
  if (data.scope !== "quote_artwork") throw Object.assign(new Error("Quote intake scope is invalid."), { status: 403 });
  if (data.state !== "active") throw Object.assign(new Error("This quote intake authorization has already been consumed."), { status: 409 });
  if (typeof data.expiresAt !== "string" || Date.parse(data.expiresAt) <= Date.now()) {
    throw Object.assign(new Error("This quote intake authorization has expired."), { status: 410 });
  }
  if (!tokenHashMatches(data.tokenHash, token)) {
    throw Object.assign(new Error("Quote intake authorization was rejected."), { status: 403 });
  }
  const uploadedFileIds = Array.isArray(data.uploadedFileIds)
    ? data.uploadedFileIds.filter((entry): entry is string => typeof entry === "string")
    : [];
  if (expectedFileIds) {
    const expected = [...expectedFileIds].sort();
    const actual = [...uploadedFileIds].sort();
    if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
      throw Object.assign(new Error("Artwork attachments do not belong to this quote intake session."), { status: 403 });
    }
  }
  return {
    scope: "quote_artwork" as const,
    expiresAt: data.expiresAt,
    uploadCount: typeof data.uploadCount === "number" ? data.uploadCount : uploadedFileIds.length,
    maxFiles: typeof data.maxFiles === "number" ? data.maxFiles : QUOTE_ARTWORK_MAX_FILES,
    uploadedFileIds,
  };
}

export async function authorizeQuoteArtworkUpload(request: Request): Promise<QuoteIntakeAuthorization> {
  const intakeId = request.headers.get("x-purepress-intake-id")?.trim() ?? "";
  const token = request.headers.get("x-purepress-intake-token")?.trim() ?? "";
  if (!intakeId || !token) throw Object.assign(new Error("Quote artwork authorization is required."), { status: 401 });
  const snapshot = await getAdminDb().collection(QUOTE_INTAKE_SESSIONS_COLLECTION).doc(intakeId).get();
  if (!snapshot.exists) throw Object.assign(new Error("Quote intake authorization was not found."), { status: 404 });
  const session = assertStoredQuoteIntakeSession(snapshot.data() ?? {}, token);
  if (session.uploadCount >= session.maxFiles) {
    throw Object.assign(new Error(`A quote can include at most ${session.maxFiles} artwork files.`), { status: 413 });
  }
  return { intakeId, scope: "quote_artwork", expiresAt: session.expiresAt };
}

export async function recordQuoteArtworkUpload(
  authorization: QuoteIntakeAuthorization,
  file: { key: string; name: string; type: string; size: number },
) {
  const db = getAdminDb();
  const sessionRef = db.collection(QUOTE_INTAKE_SESSIONS_COLLECTION).doc(authorization.intakeId);
  const jobFileRef = db.collection(QUOTE_JOB_FILES_COLLECTION).doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) throw new Error("Quote intake session no longer exists.");
    const data = sessionSnapshot.data() ?? {};
    if (data.scope !== "quote_artwork" || data.state !== "active") {
      throw new Error("Quote intake session is no longer active.");
    }
    if (typeof data.expiresAt !== "string" || Date.parse(data.expiresAt) <= Date.now()) {
      throw new Error("Quote intake session expired before upload completion.");
    }
    const uploaded = Array.isArray(data.uploadedFileIds)
      ? data.uploadedFileIds.filter((entry): entry is string => typeof entry === "string")
      : [];
    const maxFiles = typeof data.maxFiles === "number" ? data.maxFiles : QUOTE_ARTWORK_MAX_FILES;
    if (uploaded.length >= maxFiles) throw new Error("Quote artwork file limit has been reached.");

    transaction.set(jobFileRef, {
      id: jobFileRef.id,
      quoteIntakeSessionId: authorization.intakeId,
      category: "quote_artwork",
      fileKey: file.key,
      fileName: file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240),
      mimeType: file.type,
      sizeBytes: file.size,
      visibility: "internal",
      uploadedBy: "system",
      createdAt: now,
    });
    transaction.update(sessionRef, {
      uploadCount: uploaded.length + 1,
      uploadedFileIds: [...uploaded, jobFileRef.id],
      updatedAt: now,
    });
  });

  return { jobFileId: jobFileRef.id, fileName: file.name, published: false } as const;
}
