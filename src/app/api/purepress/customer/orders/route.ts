import { requirePurePressCustomer } from "@/lib/purepress/auth/server";
import { purePressCustomerError, purePressCustomerJson } from "@/lib/purepress/server/customerHttp";
import { listPurePressCustomerOrders } from "@/lib/purepress/server/customerPortal";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requirePurePressCustomer(request);
    const orders = await listPurePressCustomerOrders(identity);
    return purePressCustomerJson({ orders });
  } catch (error) {
    return purePressCustomerError(error, "WE COULDN’T LOAD YOUR LATEST ORDERS");
  }
}
