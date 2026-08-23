import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import {
  getOwnerOperationalJob,
  updateOwnerOperationalJob,
} from "@/lib/purepress/server/jobs";
import { PurePressJobValidationError } from "@/lib/purepress/jobDesk";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 12 * 1024;

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const { projectId } = await context.params;
    const detail = await getOwnerOperationalJob(projectId);
    if (!detail) return NextResponse.json({ error: "PurePress job not found." }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "no-store, private" } });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason
      ? Number((reason as { status?: number }).status) || 401
      : 401;
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not load this job." : "PurePress owner authorization is required." },
      { status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const { projectId } = await context.params;
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Job update is too large." }, { status: 413 });
    }
    const body = JSON.parse(bodyText);
    const result = await updateOwnerOperationalJob(projectId, body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private" } });
  } catch (reason) {
    const status = reason instanceof PurePressJobValidationError
      ? reason.status
      : typeof reason === "object" && reason && "status" in reason
        ? Number((reason as { status?: number }).status) || 400
        : reason instanceof SyntaxError ? 400 : 500;
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not update this job." : reason instanceof Error ? reason.message : "Job update was rejected." },
      { status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}
