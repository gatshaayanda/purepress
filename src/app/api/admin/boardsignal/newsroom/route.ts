import { NextResponse } from "next/server";
import { founderNewsroomSummary } from "@/lib/boardsignal/server/newsroom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, summary: await founderNewsroomSummary() }, { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Founder Newsroom summary could not be loaded." }, { status: 500, headers: { "Cache-Control": "no-store, private" } });
  }
}
