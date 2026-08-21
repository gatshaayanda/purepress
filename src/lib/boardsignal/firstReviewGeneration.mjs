/**
 * Resolve the cadence used to acquire a Review. Authenticated LIVE accounts
 * may supply their durable account cadence. Historical seed cadence is only
 * consulted in explicit seed mode and can never silently steer LIVE users.
 */
export function resolveEffectiveCadenceAnchor(mode, explicitAccountCadenceAnchor, seedCadenceAnchor) {
  const explicit = typeof explicitAccountCadenceAnchor === "string" ? explicitAccountCadenceAnchor.trim() : "";
  if (explicit) return explicit;
  if (mode !== "seed") return undefined;
  const seeded = typeof seedCadenceAnchor === "string" ? seedCadenceAnchor.trim() : "";
  return seeded || undefined;
}

/** Build the existing public live-Review endpoint with an optional aligned cadence. */
export function buildLiveDeskRequestPath(username, cadenceAnchor) {
  const normalizedUsername = String(username ?? "").trim();
  const normalizedAnchor = typeof cadenceAnchor === "string" ? cadenceAnchor.trim() : "";
  const base = `/api/boardsignal/${encodeURIComponent(normalizedUsername)}`;
  return normalizedAnchor ? `${base}?anchorStart=${encodeURIComponent(normalizedAnchor)}` : base;
}

/**
 * A successful publication gets one mounted-session safety lock: while the
 * refreshed snapshot's latest Review is that exact publication, do not mount
 * another automatic generator for it. A later key or a new browser session is
 * eligible normally.
 */
export function shouldMountAutomaticReviewGenerator({
  generationRequired,
  latestDeskKey,
  publishedDeskKeyThisSession,
}) {
  if (!generationRequired) return false;
  if (publishedDeskKeyThisSession && latestDeskKey === publishedDeskKeyThisSession) return false;
  return true;
}
