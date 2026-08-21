export const PWA_ENGAGED_KEY = "boardsignal:pwa-engaged-at";
export const PWA_DISMISSED_KEY = "boardsignal:pwa-install-dismissed-at";
export const PWA_INSTALL_REQUEST_EVENT = "boardsignal:install-request";
export const PWA_ENGAGED_EVENT = "boardsignal:pwa-engaged";
export const PWA_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export function isStandaloneBoardSignal() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isIosInstallCandidate() {
  if (typeof navigator === "undefined" || isStandaloneBoardSignal()) return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios;
}

export function markBoardSignalPwaEngaged() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PWA_ENGAGED_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(PWA_ENGAGED_EVENT));
}

export function installDismissedRecently() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(PWA_DISMISSED_KEY);
  const when = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(when) && Date.now() - when < PWA_DISMISS_MS;
}
