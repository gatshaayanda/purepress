import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  FOUNDER_SESSION_COOKIE,
  verifyFounderAuthorization,
} from "./src/lib/boardsignal/founderSession.mjs";

const PUREPRESS_OWNER_LOGIN_PATH = "/admin/login";

function isFounderRoute(pathname: string) {
  if (pathname === PUREPRESS_OWNER_LOGIN_PATH) return false;
  return pathname === "/admin"
    || pathname.startsWith("/admin/")
    || pathname.startsWith("/api/admin/boardsignal/")
    || pathname.startsWith("/api/admin/purepress/");
}

function isFounderApi(pathname: string) {
  return pathname.startsWith("/api/admin/boardsignal/")
    || pathname.startsWith("/api/admin/purepress/");
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (!isFounderRoute(pathname)) return NextResponse.next();

  const authorization = await verifyFounderAuthorization({
    sessionValue: req.cookies.get(FOUNDER_SESSION_COOKIE)?.value,
    authorization: req.headers.get("authorization"),
    adminPassword: process.env.ADMIN_PASSWORD,
  });
  if (authorization.authorized) return NextResponse.next();
  if (authorization.reason === "not_configured") {
    if (isFounderApi(pathname)) return NextResponse.json({ ok: false, error: "Founder authentication is not configured." }, { status: 503 });
    return new NextResponse("Founder authentication is not configured.", { status: 503 });
  }

  if (isFounderApi(pathname)) {
    return NextResponse.json({ ok: false, error: "Founder authentication is required." }, {
      status: 401,
      headers: { "Cache-Control": "no-store, private" },
    });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = PUREPRESS_OWNER_LOGIN_PATH;
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/boardsignal/:path*", "/api/admin/purepress/:path*"],
};
