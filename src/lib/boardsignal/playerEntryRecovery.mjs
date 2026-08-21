export const RECOVERABLE_PREVIEW_CLAIM_CODES = new Set([
  "ACCESS_ALREADY_CLAIMED",
  "ESTABLISHED_ACCOUNT_EXISTS",
]);

export function stableFirebaseUidForPlayerId(playerId) {
  const numeric = Number(playerId);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return undefined;
  return `chesscom_${numeric}`;
}

export function decidePreviewEntry({ expectedUid, currentUid, claimCode = "" }) {
  const expected = String(expectedUid ?? "").trim();
  const current = String(currentUid ?? "").trim();
  const code = String(claimCode ?? "").trim();
  if (!expected) return { action: "identity_error" };
  if (current) {
    if (current === expected) return { action: "resume", sameUidResume: true };
    return { action: "cross_account", sameUidResume: false };
  }
  if (RECOVERABLE_PREVIEW_CLAIM_CODES.has(code)) {
    return { action: "recovery", sameUidResume: false, code };
  }
  return { action: "claim", sameUidResume: false };
}

export function credentialMatchesExpectedUid(expectedUid, actualUid) {
  return Boolean(expectedUid) && String(expectedUid) === String(actualUid ?? "");
}
