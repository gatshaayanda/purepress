import { createHash, randomBytes } from "node:crypto";
import { getChessComOAuthStatus, type StableChessComIdentity } from "../account";
import { resolveChessComCallbackUri } from "./callbackUri";

export type ChessComOAuthConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string;
  redirectUri: string;
  usePkce: boolean;
};

export function getChessComOAuthConfig(
  env: Record<string, string | undefined> = process.env,
): ChessComOAuthConfig | undefined {
  const status = getChessComOAuthStatus(env);
  if (!status.enabled) return undefined;
  const redirectUri = resolveChessComCallbackUri(env.CHESSCOM_REDIRECT_URI, env.NODE_ENV);
  if (!redirectUri) return undefined;
  return {
    clientId: env.CHESSCOM_CLIENT_ID!,
    clientSecret: env.CHESSCOM_CLIENT_SECRET!,
    authorizeUrl: env.CHESSCOM_AUTHORIZE_URL!,
    tokenUrl: env.CHESSCOM_TOKEN_URL!,
    profileUrl: env.CHESSCOM_PROFILE_URL!,
    scopes: env.CHESSCOM_SCOPES!,
    redirectUri,
    usePkce: env.CHESSCOM_PKCE_ENABLED === "true",
  };
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildChessComAuthorizationUrl(
  config: ChessComOAuthConfig,
  state: string,
  codeChallenge?: string,
) {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  if (config.usePkce && codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url;
}

type ChessComTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function exchangeChessComCode(
  config: ChessComOAuthConfig,
  code: string,
  codeVerifier?: string,
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });
  if (config.usePkce && codeVerifier) body.set("code_verifier", codeVerifier);
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as ChessComTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? `Chess.com token exchange returned ${response.status}.`);
  }
  return payload.access_token;
}

export function parseChessComOAuthProfile(payload: unknown): StableChessComIdentity {
  if (!payload || typeof payload !== "object") throw new Error("Chess.com did not return a usable identity profile.");
  const record = payload as Record<string, unknown>;
  const playerId = Number(record.player_id ?? record.playerId ?? record.id);
  const canonicalUsername = String(record.username ?? record.user_name ?? "").trim();
  if (!Number.isSafeInteger(playerId) || playerId <= 0 || !canonicalUsername) {
    throw new Error("Chess.com OAuth did not return the stable player ID and canonical username BoardSignal requires.");
  }
  return {
    playerId,
    canonicalUsername,
    avatar: typeof record.avatar === "string" ? record.avatar : undefined,
    profileUrl: typeof record.url === "string" ? record.url : undefined,
  };
}

export async function fetchChessComOAuthProfile(
  config: ChessComOAuthConfig,
  accessToken: string,
) {
  const response = await fetch(config.profileUrl, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Chess.com profile request returned ${response.status}.`);
  return parseChessComOAuthProfile(await response.json());
}
