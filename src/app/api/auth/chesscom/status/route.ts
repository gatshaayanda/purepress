import { NextResponse } from "next/server";
import { getChessComOAuthStatus } from "@/lib/boardsignal/account";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getChessComOAuthStatus(process.env);
  return NextResponse.json({
    ...status,
    devIdentityEnabled: process.env.NODE_ENV !== "production" && process.env.BOARDSIGNAL_DEV_AUTH_ENABLED === "true",
  }, { headers: { "Cache-Control": "no-store, private" } });
}
