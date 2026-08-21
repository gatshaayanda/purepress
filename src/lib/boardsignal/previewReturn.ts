import { BETA_MAGIC_ACCESS_LIFETIME_MS } from "./activation";

export type BetaPreviewReturnRecord = {
  requestId: string;
  canonicalUsername: string;
  statusCredential: string;
  createdAt: string;
  expiresAt: string;
};

const STORAGE_KEY = "boardsignal-beta-preview-return-v1";

function validRecord(value: unknown): value is BetaPreviewReturnRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<BetaPreviewReturnRecord>;
  return typeof record.requestId === "string" && /^[A-Za-z0-9_-]{1,180}$/.test(record.requestId)
    && typeof record.canonicalUsername === "string" && record.canonicalUsername.length > 0 && record.canonicalUsername.length <= 80
    && typeof record.statusCredential === "string" && record.statusCredential.length >= 32 && record.statusCredential.length <= 160
    && typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt))
    && typeof record.expiresAt === "string" && Number.isFinite(Date.parse(record.expiresAt));
}

export function loadSavedBetaPreviewReturn(now = Date.now()): BetaPreviewReturnRecord | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (!validRecord(parsed) || Date.parse(parsed.expiresAt) <= now) {
      window.localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

export function saveBetaPreviewReturn(input: { requestId: string; canonicalUsername: string; statusCredential: string; createdAt?: string; expiresAt?: string }) {
  if (typeof window === "undefined") return undefined;
  const existing = loadSavedBetaPreviewReturn();
  const createdAt = input.createdAt ?? (existing?.requestId === input.requestId ? existing.createdAt : new Date().toISOString());
  if (existing && existing.requestId !== input.requestId && Date.parse(existing.createdAt) > Date.parse(createdAt)) return existing;
  const expiresAt = input.expiresAt ?? new Date(Date.parse(createdAt) + BETA_MAGIC_ACCESS_LIFETIME_MS).toISOString();
  const record: BetaPreviewReturnRecord = {
    requestId: input.requestId,
    canonicalUsername: input.canonicalUsername.slice(0, 80),
    statusCredential: input.statusCredential,
    createdAt,
    expiresAt,
  };
  if (!validRecord(record)) return undefined;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function clearSavedBetaPreviewReturn(requestId?: string) {
  if (typeof window === "undefined") return;
  if (!requestId) { window.localStorage.removeItem(STORAGE_KEY); return; }
  const current = loadSavedBetaPreviewReturn();
  if (!current || current.requestId === requestId) window.localStorage.removeItem(STORAGE_KEY);
}
