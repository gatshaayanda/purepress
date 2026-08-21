import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runBoardSignalReturnLoop } from "@/lib/boardsignal/server/returnLoop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameSecret(submitted: string, expected: string) {
  const left = Buffer.from(submitted);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "BoardSignal return-loop cron is disabled until CRON_SECRET is configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const authorization = request.headers.get("authorization") ?? "";
  const submitted = /^Bearer\s+(.+)$/i.exec(authorization)?.[1] ?? "";
  if (!submitted || !sameSecret(submitted, secret)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ ok: true, ...(await runBoardSignalReturnLoop()) }, { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "BoardSignal return loop failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
