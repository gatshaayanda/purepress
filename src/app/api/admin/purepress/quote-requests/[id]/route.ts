import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { getOwnerQuoteRequest } from "@/lib/purepress/server/quoteRequests";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const { id } = await context.params;
    const quote = await getOwnerQuoteRequest(id);
    if (!quote) return NextResponse.json({ error: "Quote request not found." }, { status: 404 });
    return NextResponse.json(
      { quote },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason
      ? Number((reason as { status?: number }).status) || 401
      : 401;
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not load this quote request." : "PurePress owner authorization is required." },
      { status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}
