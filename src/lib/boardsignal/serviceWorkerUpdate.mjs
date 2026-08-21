export const SERVICE_WORKER_UPDATE_INTERVAL_MS = 15 * 60 * 1000;

export function shouldCheckServiceWorkerUpdate(lastCheckedAt, now = Date.now(), intervalMs = SERVICE_WORKER_UPDATE_INTERVAL_MS) {
  const last = Number(lastCheckedAt ?? 0);
  const current = Number(now);
  if (!Number.isFinite(current)) return false;
  if (!Number.isFinite(last) || last <= 0) return true;
  return current - last >= intervalMs;
}
