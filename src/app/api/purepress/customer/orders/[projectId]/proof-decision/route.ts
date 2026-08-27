import { requirePurePressCustomer } from "@/lib/purepress/auth/server";
import { decideAuthenticatedCustomerProof } from "@/lib/purepress/server/customerDecisions";
import { purePressCustomerError, purePressCustomerJson } from "@/lib/purepress/server/customerHttp";
import { requirePurePressCustomerOrderOwnership } from "@/lib/purepress/server/customerPortal";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const identity = await requirePurePressCustomer(request);
    const { projectId } = await context.params;
    await requirePurePressCustomerOrderOwnership(identity, projectId);
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return purePressCustomerJson({ error: "Your artwork response is too long." }, 413);
    }
    const body = JSON.parse(bodyText);
    const result = await decideAuthenticatedCustomerProof(identity, projectId, body);
    return purePressCustomerJson(result);
  } catch (error) {
    return purePressCustomerError(error, "WE COULDN’T RECORD YOUR ARTWORK RESPONSE");
  }
}
