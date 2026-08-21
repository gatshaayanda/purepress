import { NextResponse } from "next/server";
import { submitFoundingBetaRequest } from "@/lib/boardsignal/server/betaRequests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      ...(status === 429 ? { "Retry-After": "3600" } : {}),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      username?: unknown;
      preferredContactMethod?: unknown;
      preferredContactValue?: unknown;
      betaContactConsent?: unknown;
      source?: unknown;
      shareMomentId?: unknown;
    };
    const result = await submitFoundingBetaRequest({
      request,
      username: body.username,
      preferredContactMethod: body.preferredContactMethod,
      preferredContactValue: body.preferredContactValue,
      betaContactConsent: body.betaContactConsent,
      source: body.source,
      shareMomentId: body.shareMomentId,
    });
    return response({
      ok: true,
      existingState: result.existingState,
      statusToken: result.statusToken,
      preview: result.preview,
      previewError: result.previewError,
      request: {
        id: result.request.id,
        chessPlayerId: result.request.chessPlayerId,
        canonicalUsername: result.request.canonicalUsername,
        avatar: result.request.avatar,
        profileUrl: result.request.profileUrl,
        requestedAt: result.request.requestedAt,
        status: result.request.status,
      },
    }, result.existingState ? 200 : 201);
  } catch (error) {
    const status = Number((error as { status?: number }).status ?? 500);
    return response({ ok: false, code: String((error as { code?: string }).code ?? "BETA_REQUEST_FAILED"), error: error instanceof Error ? error.message : "Founding Access request could not be submitted." }, status);
  }
}
