import "server-only";

import {
  FOUNDER_SESSION_COOKIE,
  verifyFounderAuthorization,
  verifyFounderBasicAuthorization,
} from "../founderSession.mjs";

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function requireFounderAuth(request: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw Object.assign(new Error("Founder authentication is not configured."), { status: 503 });
  const result = await verifyFounderAuthorization({
    sessionValue: cookieValue(request, FOUNDER_SESSION_COOKIE),
    authorization: request.headers.get("authorization"),
    adminPassword: expected,
  });
  if (!result.authorized) throw Object.assign(new Error("Founder authentication is required."), { status: 401 });
  return result;
}

// Backward-compatible helper for older server call sites during the rollout.
// New/updated routes should use requireFounderAuth so signed sessions work too.
export function requireFounderBasicAuth(request: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw Object.assign(new Error("Founder authentication is not configured."), { status: 503 });
  if (!verifyFounderBasicAuthorization(request.headers.get("authorization"), expected)) {
    throw Object.assign(new Error("Founder authentication was rejected."), { status: 403 });
  }
}
