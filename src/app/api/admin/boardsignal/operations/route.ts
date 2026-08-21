import { NextResponse } from "next/server";
import { clearFounderFollowUpSnooze, founderOperationsSnapshot, markFounderContacted, snoozeFounderFollowUp } from "@/lib/boardsignal/server/founderOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" };
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }); }

export async function GET() {
  try { return response({ ok: true, operations: await founderOperationsSnapshot() }); }
  catch (error) { return response({ ok: false, error: error instanceof Error ? error.message : "Founder operations could not be loaded." }, 500); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; uid?: string; method?: string; days?: number };
    if (body.action === "markContacted") return response({ ok: true, founderOps: await markFounderContacted(body.uid, body.method) });
    if (body.action === "snooze") return response({ ok: true, founderOps: await snoozeFounderFollowUp(body.uid, body.days) });
    if (body.action === "clearSnooze") return response({ ok: true, result: await clearFounderFollowUpSnooze(body.uid) });
    return response({ ok: false, error: "Choose Mark Contacted, Snooze, or Clear Snooze." }, 400);
  } catch (error) {
    const status = Number((error as { status?: number })?.status ?? 500);
    return response({ ok: false, error: error instanceof Error ? error.message : "Founder operations could not be updated." }, status);
  }
}
