import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { listOwnerQuotationStates } from "@/lib/purepress/server/quotes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePurePressAdmin(request);
    const states = await listOwnerQuotationStates();
    return NextResponse.json({ states }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status?: number }).status) || 401 : 401;
    return NextResponse.json({ error: status >= 500 ? "PurePress could not load quotation state." : "PurePress owner authorization is required." }, { status, headers: { "Cache-Control": "no-store, private" } });
  }
}
