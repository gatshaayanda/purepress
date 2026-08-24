import { NextResponse } from "next/server";
import { getPublicQuoteByToken } from "@/lib/purepress/server/quotes";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const quote = await getPublicQuoteByToken(token);
    return NextResponse.json({ quote }, { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status?: number }).status) || 404 : 404;
    return NextResponse.json({ error: status === 410 ? (reason instanceof Error ? reason.message : "This quotation link is no longer active.") : "Quotation link was not found." }, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
}
