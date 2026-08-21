import { NextResponse } from "next/server";
import {
  createFounderSession,
  FOUNDER_SESSION_COOKIE,
} from "@/lib/boardsignal/founderSession.mjs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  const password = String(body.password ?? "");
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await createFounderSession(expectedPassword);
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: FOUNDER_SESSION_COOKIE,
    value: session.value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
    expires: session.expires,
  });
  // The old random cookie was never authoritative. Clear it during migration.
  res.cookies.set({
    name: "admin_token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
