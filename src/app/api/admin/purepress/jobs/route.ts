import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import {
  createOwnerOperationalJob,
  listOwnerOperationalJobs,
} from "@/lib/purepress/server/jobs";
import { PurePressJobValidationError } from "@/lib/purepress/jobDesk";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 24 * 1024;

export async function GET(request: Request) {
  try {
    await requirePurePressAdmin(request);
    const jobs = await listOwnerOperationalJobs();
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason
      ? Number((reason as { status?: number }).status) || 401
      : 401;
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not load the order desk." : "PurePress owner authorization is required." },
      { status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requirePurePressAdmin(request);
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Job request is too large." }, { status: 413 });
    }
    const body = JSON.parse(bodyText);
    const result = await createOwnerOperationalJob(body);
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (reason) {
    const status = reason instanceof PurePressJobValidationError
      ? reason.status
      : typeof reason === "object" && reason && "status" in reason
        ? Number((reason as { status?: number }).status) || 400
        : reason instanceof SyntaxError ? 400 : 500;
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not create this job." : reason instanceof Error ? reason.message : "Job creation was rejected." },
      { status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}
