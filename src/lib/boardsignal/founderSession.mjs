export const FOUNDER_SESSION_COOKIE = "boardsignal_founder_session";
export const FOUNDER_SESSION_VERSION = 1;
export const FOUNDER_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const SESSION_DOMAIN = "boardsignal-founder-session:v1:";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(adminPassword) {
  if (!adminPassword) throw new Error("Founder authentication is not configured.");
  const derived = await crypto.subtle.digest("SHA-256", encoder.encode(`${SESSION_DOMAIN}${adminPassword}`));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function createFounderSession(adminPassword, options = {}) {
  const nowMs = Number(options.nowMs ?? Date.now());
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + FOUNDER_SESSION_MAX_AGE_SECONDS;
  const payload = {
    v: FOUNDER_SESSION_VERSION,
    role: "founder",
    iat: issuedAt,
    exp: expiresAt,
    nonce: String(options.nonce ?? randomNonce()),
  };
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signedInput = `v${FOUNDER_SESSION_VERSION}.${encodedPayload}`;
  const key = await signingKey(adminPassword);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(signedInput)));
  return {
    value: `${signedInput}.${bytesToBase64Url(signature)}`,
    payload,
    maxAge: FOUNDER_SESSION_MAX_AGE_SECONDS,
    expires: new Date(expiresAt * 1000),
  };
}

export async function verifyFounderSession(value, adminPassword, options = {}) {
  try {
    if (!value || !adminPassword) return false;
    const parts = String(value).split(".");
    if (parts.length !== 3 || parts[0] !== `v${FOUNDER_SESSION_VERSION}`) return false;
    const [version, encodedPayload, encodedSignature] = parts;
    const signedInput = `${version}.${encodedPayload}`;
    const key = await signingKey(adminPassword);
    const signature = base64UrlToBytes(encodedSignature);
    const verified = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(signedInput));
    if (!verified) return false;
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload)));
    if (payload?.v !== FOUNDER_SESSION_VERSION || payload?.role !== "founder") return false;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= payload.iat) return false;
    if (payload.exp - payload.iat > FOUNDER_SESSION_MAX_AGE_SECONDS) return false;
    if (typeof payload.nonce !== "string" || payload.nonce.length < 8 || payload.nonce.length > 128) return false;
    const nowSeconds = Math.floor(Number(options.nowMs ?? Date.now()) / 1000);
    if (payload.iat > nowSeconds + 60 || payload.exp <= nowSeconds) return false;
    return true;
  } catch {
    return false;
  }
}

export function founderPasswordFromBasicHeader(authorization) {
  const match = /^Basic\s+(.+)$/i.exec(String(authorization ?? ""));
  if (!match) return undefined;
  try {
    const decoded = decoder.decode(base64UrlToBytes(match[1].replace(/\+/g, "-").replace(/\//g, "_")));
    const separator = decoded.indexOf(":");
    return separator >= 0 ? decoded.slice(separator + 1) : undefined;
  } catch {
    return undefined;
  }
}

export function verifyFounderBasicAuthorization(authorization, adminPassword) {
  const submitted = founderPasswordFromBasicHeader(authorization);
  return Boolean(adminPassword) && submitted !== undefined && submitted === adminPassword;
}

export async function verifyFounderAuthorization({ sessionValue, authorization, adminPassword, nowMs = Date.now() }) {
  if (!adminPassword) return { authorized: false, method: "none", reason: "not_configured" };
  if (sessionValue && await verifyFounderSession(sessionValue, adminPassword, { nowMs })) {
    return { authorized: true, method: "session" };
  }
  if (verifyFounderBasicAuthorization(authorization, adminPassword)) {
    return { authorized: true, method: "basic" };
  }
  return { authorized: false, method: "none", reason: "invalid" };
}
