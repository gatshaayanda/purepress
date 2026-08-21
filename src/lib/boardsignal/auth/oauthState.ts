import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type OAuthStatePayload = {
  state: string;
  createdAt: number;
  codeVerifier?: string;
};

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function newOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function sealOAuthState(payload: OAuthStatePayload, secret: string) {
  if (secret.length < 32) throw new Error("BOARDSIGNAL_AUTH_STATE_SECRET must be at least 32 characters.");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function openOAuthState(value: string, secret: string, now = Date.now()) {
  const [encoded, supplied] = value.split(".");
  if (!encoded || !supplied) return undefined;
  const expected = signature(encoded, secret);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload.state || !payload.createdAt || now - payload.createdAt > 10 * 60 * 1000) return undefined;
    return payload;
  } catch {
    return undefined;
  }
}
