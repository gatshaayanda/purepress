import { NextResponse } from "next/server";
import { FOUNDER_SESSION_COOKIE } from "@/lib/boardsignal/founderSession.mjs";

export async function POST() {
  const res = NextResponse.json({ success: true });
  const clear = (name: string) => res.cookies.set({
    name,
    value: "",
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  clear(FOUNDER_SESSION_COOKIE);
  clear("admin_token");
  return res;
}
