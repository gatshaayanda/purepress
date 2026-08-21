import { NextResponse } from "next/server";
import { listFounderCoverageBundle, updateFounderCoverage, updateFounderUniverseEvent } from "@/lib/boardsignal/server/coverageEditor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } }); }

export async function GET() {
  try { return response({ ok: true, ...(await listFounderCoverageBundle()) }); }
  catch (error) { return response({ ok: false, error: error instanceof Error ? error.message : "Coverage could not be loaded." }, 500); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      target?: "coverage" | "event";
      action?: "feature" | "updateEditorial" | "remove" | "setLead" | "hide" | "restore";
      id?: string;
      featured?: boolean;
      featuredOrder?: number;
      editorialTitle?: unknown;
      editorialContext?: unknown;
    };
    if (!body.action || !body.id) return response({ ok: false, error: "Coverage action and ID are required." }, 400);
    if (body.target === "event") {
      if (!["feature", "setLead", "hide", "restore"].includes(body.action)) return response({ ok: false, error: "Unsupported Universe event action." }, 400);
      return response({ ok: true, result: await updateFounderUniverseEvent({ action: body.action as "feature" | "setLead" | "hide" | "restore", id: body.id }) });
    }
    if (!["feature", "updateEditorial", "remove", "setLead"].includes(body.action)) return response({ ok: false, error: "Unsupported coverage action." }, 400);
    return response({ ok: true, result: await updateFounderCoverage({ ...body, action: body.action as "feature" | "updateEditorial" | "remove" | "setLead", id: body.id }) });
  } catch (error) { return response({ ok: false, error: error instanceof Error ? error.message : "Coverage could not be updated." }, Number((error as { status?: number }).status ?? 500)); }
}
