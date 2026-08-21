export const CHESSCOM_CALLBACK_PATH = "/api/auth/chesscom/callback";
export const CHESSCOM_CANONICAL_CALLBACK_URI = `https://www.adminhub-global.com${CHESSCOM_CALLBACK_PATH}`;
export const CHESSCOM_NON_WWW_CALLBACK_URI = `https://adminhub-global.com${CHESSCOM_CALLBACK_PATH}`;

const PRODUCTION_ORIGINS = new Set([
  "https://www.adminhub-global.com",
  "https://adminhub-global.com",
]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Accepts only the registered BoardSignal callback route. Production stays on
 * the canonical domain (with the registered apex compatibility variant), while
 * local HTTP origins remain available outside production.
 */
export function resolveChessComCallbackUri(
  configured: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  if (!configured?.trim()) return undefined;
  try {
    const url = new URL(configured.trim());
    if (url.username || url.password || url.search || url.hash || url.pathname !== CHESSCOM_CALLBACK_PATH) return undefined;
    if (PRODUCTION_ORIGINS.has(url.origin)) return `${url.origin}${CHESSCOM_CALLBACK_PATH}`;
    if (nodeEnv !== "production"
      && url.protocol === "http:"
      && LOCAL_HOSTS.has(url.hostname)) {
      return `${url.origin}${CHESSCOM_CALLBACK_PATH}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
