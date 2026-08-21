import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { getAdminAuth } from "@/utils/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requirePurePressAdmin(request);
    const token = await getAdminAuth().createCustomToken("purepress-admin", {
      purepress_admin: true,
      // Preserve existing BoardSignal admin Firestore access while the portal is shared.
      admin: true,
    });
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status?: number }).status) || 401 : 401;
    return NextResponse.json(
      { error: reason instanceof Error ? reason.message : "PurePress admin authentication failed." },
      { status, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
