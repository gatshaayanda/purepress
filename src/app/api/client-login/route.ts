import { NextResponse } from "next/server";

/**
 * The inherited password-map login is intentionally retired for PurePress.
 * Keeping the route avoids a hard 404 for old links while ensuring production
 * customer identity is established with Firebase Authentication instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy client-password login has been retired. PurePress customer access uses Firebase Authentication.",
      code: "PUREPRESS_FIREBASE_AUTH_REQUIRED",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, private" },
    }
  );
}
