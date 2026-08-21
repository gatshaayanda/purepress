type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function boardSignalBadgingSupported() {
  if (typeof navigator === "undefined") return false;
  const badgeNavigator = navigator as BadgeNavigator;
  return typeof badgeNavigator.setAppBadge === "function" && typeof badgeNavigator.clearAppBadge === "function";
}

export async function syncBoardSignalAppBadge(unreadCount: number) {
  if (!boardSignalBadgingSupported()) return false;
  const badgeNavigator = navigator as BadgeNavigator;
  if (unreadCount > 0) await badgeNavigator.setAppBadge?.(Math.min(99, Math.max(1, Math.floor(unreadCount))));
  else await badgeNavigator.clearAppBadge?.();
  return true;
}

export async function clearBoardSignalAppBadge() {
  if (!boardSignalBadgingSupported()) return false;
  await (navigator as BadgeNavigator).clearAppBadge?.();
  return true;
}
