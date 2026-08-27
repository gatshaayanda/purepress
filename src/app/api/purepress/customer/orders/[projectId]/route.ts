import { requirePurePressCustomer } from "@/lib/purepress/auth/server";
import { purePressCustomerError, purePressCustomerJson } from "@/lib/purepress/server/customerHttp";
import { getPurePressCustomerOrder } from "@/lib/purepress/server/customerPortal";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const identity = await requirePurePressCustomer(request);
    const { projectId } = await context.params;
    const order = await getPurePressCustomerOrder(identity, projectId);
    return purePressCustomerJson({ order });
  } catch (error) {
    return purePressCustomerError(error);
  }
}
