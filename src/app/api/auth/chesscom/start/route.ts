import { NextResponse } from "next/server";
import {
  buildChessComAuthorizationUrl,
  createPkcePair,
  getChessComOAuthConfig,
} from "@/lib/boardsignal/auth/chesscom";
import { newOAuthState, sealOAuthState } from "@/lib/boardsignal/auth/oauthState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getChessComOAuthConfig();
  const secret = process.env.BOARDSIGNAL_AUTH_STATE_SECRET;
  if (!config || !secret) {
    return NextResponse.json({ ok: false, code: "CHESSCOM_OAUTH_DISABLED", error: "Chess.com sign-in is awaiting official provider approval." }, { status: 503 });
  }
  const state = newOAuthState();
  const pkce = config.usePkce ? createPkcePair() : undefined;
  const sealed = sealOAuthState({ state, createdAt: Date.now(), codeVerifier: pkce?.verifier }, secret);
  const response = NextResponse.redirect(buildChessComAuthorizationUrl(config, state, pkce?.challenge));
  response.cookies.set("boardsignal_oauth_state", sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/chesscom",
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}
