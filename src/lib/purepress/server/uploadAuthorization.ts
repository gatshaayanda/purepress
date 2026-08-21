import "server-only";

import type { JobFileCategory } from "../domain";
import { PUREPRESS_UPLOAD_POLICIES } from "../uploads";
import { requirePurePressCustomer, purePressCustomerCanAccessJob } from "../auth/server";
import { isPurePressAdmin } from "./adminAuth";

export type PurePressUploadActor =
  | { role: "admin"; uid: "purepress-admin" }
  | { role: "customer"; uid: string; customerId: string };

/**
 * Public intake uploads are deliberately not authorized yet. Patch B can add
 * a short-lived server-issued intake context without making UploadThing public.
 */
export async function authorizePurePressUpload(
  request: Request,
  category: JobFileCategory,
  jobId?: string
): Promise<PurePressUploadActor> {
  const policy = PUREPRESS_UPLOAD_POLICIES[category];

  if (policy.roles.includes("admin") && await isPurePressAdmin(request)) {
    if (policy.requiresJob && !jobId?.trim()) throw new Error("This PurePress upload requires an order context.");
    return { role: "admin", uid: "purepress-admin" };
  }

  if (!policy.roles.includes("customer")) throw new Error("This PurePress upload category is admin-only.");
  const customer = await requirePurePressCustomer(request);
  if (policy.requiresJob) {
    if (!jobId?.trim()) throw new Error("This PurePress upload requires an order context.");
    if (!await purePressCustomerCanAccessJob(customer.uid, jobId)) {
      throw new Error("The authenticated customer is not authorized for this order.");
    }
  }

  return { role: "customer", uid: customer.uid, customerId: customer.customerId };
}
