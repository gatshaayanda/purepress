import { requirePurePressCustomer } from "@/lib/purepress/auth/server";
import { purePressCustomerError, purePressCustomerJson } from "@/lib/purepress/server/customerHttp";
import { createCustomerProofFileView } from "@/lib/purepress/server/customerPortal";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ projectId: string; index: string }> }) {
  try {
    const identity = await requirePurePressCustomer(request);
    const { projectId, index } = await context.params;
    const file = await createCustomerProofFileView(identity, projectId, index);
    return purePressCustomerJson(file);
  } catch (error) {
    return purePressCustomerError(error, "WE COULDN’T OPEN THIS ARTWORK FILE");
  }
}
