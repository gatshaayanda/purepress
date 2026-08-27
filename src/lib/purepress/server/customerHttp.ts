import "server-only";

import { NextResponse } from "next/server";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export function purePressCustomerJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: PRIVATE_HEADERS });
}

export function purePressCustomerError(reason: unknown, fallback = "We couldn’t load your latest order.") {
  const status = typeof reason === "object" && reason && "status" in reason
    ? Number((reason as { status?: number }).status) || 500
    : 500;
  const message = status === 401
    ? "YOUR SIGN-IN HAS EXPIRED"
    : status === 404
      ? "WE COULDN’T FIND THIS ORDER FOR YOUR ACCOUNT"
      : status >= 500
        ? fallback
        : reason instanceof Error
          ? reason.message
          : fallback;
  return purePressCustomerJson({ error: message, code: status === 401 ? "sign_in_expired" : "customer_request_failed" }, status);
}
