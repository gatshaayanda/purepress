import { NextResponse } from "next/server";
import { createQuoteIntakeSession } from "@/lib/purepress/server/quoteIntakeSessions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await createQuoteIntakeSession(request);
    return NextResponse.json(session, {
      status: 201,
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason
      ? Number((reason as { status?: number }).status) || 400
      : 500;
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not start the artwork intake." : reason instanceof Error ? reason.message : "Quote intake was rejected." },
      { status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}
