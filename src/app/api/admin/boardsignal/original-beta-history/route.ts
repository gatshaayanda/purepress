import { NextResponse } from "next/server";
import {
  listOriginalBetaHistoryInventory,
  prepareOriginalBetaAppAccess,
  reconcileAllOriginalBetaHistory,
  reconcileOriginalBetaPlayer,
  regenerateOriginalBetaMagicAccess,
} from "@/lib/boardsignal/server/legacyBetaReconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" },
  });
}

function errorStatus(error: unknown) {
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

export async function GET() {
  try {
    return response({ ok: true, players: await listOriginalBetaHistoryInventory() });
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : "Original beta history could not be inventoried." }, errorStatus(error));
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: unknown; handle?: unknown };
    if (body.action === "reconcileAll") {
      return response({ ok: true, summary: await reconcileAllOriginalBetaHistory() });
    }
    if (body.action === "attach" && typeof body.handle === "string") {
      return response({ ok: true, reconciliation: await reconcileOriginalBetaPlayer(body.handle) });
    }
    if (body.action === "prepareAccess" && typeof body.handle === "string") {
      return response({ ok: true, access: await prepareOriginalBetaAppAccess(body.handle) });
    }
    if (body.action === "regenerateMagic" && typeof body.handle === "string") {
      return response({ ok: true, access: await regenerateOriginalBetaMagicAccess(body.handle) });
    }
    return response({ ok: false, error: "Choose reconcileAll, attach, prepareAccess, or regenerateMagic." }, 400);
  } catch (error) {
    return response({
      ok: false,
      code: String((error as { code?: string }).code ?? "ORIGINAL_BETA_RECONCILIATION_FAILED"),
      error: error instanceof Error ? error.message : "Original beta history could not be reconciled.",
    }, errorStatus(error));
  }
}
