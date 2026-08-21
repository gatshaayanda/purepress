import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeChessComCode,
  fetchChessComOAuthProfile,
  getChessComOAuthConfig,
} from "@/lib/boardsignal/auth/chesscom";
import { openOAuthState } from "@/lib/boardsignal/auth/oauthState";
import {
  createAuthCompletionTicket,
  ensureStablePlayerAccount,
  markChessComOAuthLinked,
} from "@/lib/boardsignal/server/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function completionUrl(trustedRedirectUri: string, params: Record<string, string>) {
  const url = new URL("/boardsignal/auth/complete", new URL(trustedRedirectUri).origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

export async function GET(request: Request) {
  const config = getChessComOAuthConfig();
  const secret = process.env.BOARDSIGNAL_AUTH_STATE_SECRET;
  const query = new URL(request.url).searchParams;
  const cookieStore = await cookies();
  const sealed = cookieStore.get("boardsignal_oauth_state")?.value;
  let response: NextResponse;
  try {
    if (!config || !secret) throw new Error("Chess.com sign-in is not configured.");
    if (query.get("error")) throw new Error("Chess.com did not approve the sign-in request.");
    const state = query.get("state");
    const code = query.get("code");
    const stored = sealed ? openOAuthState(sealed, secret) : undefined;
    if (!state || !code || !stored || stored.state !== state) throw new Error("The Chess.com sign-in state could not be verified.");
    const accessToken = await exchangeChessComCode(config, code, stored.codeVerifier);
    const identity = await fetchChessComOAuthProfile(config, accessToken);
    const account = await ensureStablePlayerAccount(identity);
    await markChessComOAuthLinked(account.uid);
    const ticket = await createAuthCompletionTicket(account);
    response = NextResponse.redirect(completionUrl(config.redirectUri, { ticket }));
  } catch (error) {
    console.error("[BoardSignal Chess.com OAuth callback]", error);
    const trustedRedirectUri = config?.redirectUri ?? "https://www.adminhub-global.com/api/auth/chesscom/callback";
    response = NextResponse.redirect(completionUrl(trustedRedirectUri, { error: "CHESSCOM_SIGN_IN_FAILED" }));
  }
  response.cookies.set("boardsignal_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/chesscom",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}
