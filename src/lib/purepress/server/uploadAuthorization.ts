import "server-only";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { JobFileCategory } from "../domain";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import { PUREPRESS_UPLOAD_POLICIES } from "../uploads";
import { requirePurePressCustomer, purePressCustomerCanAccessJob } from "../auth/server";
import { isPurePressAdmin } from "./adminAuth";
export type PurePressUploadActor = { role:"admin"; uid:"purepress-admin" } | { role:"customer"; uid:string; customerId?:string };
async function assertOperationalJob(jobId: string) {
  const snapshot = await getAdminDb().collection("projects").doc(jobId).get();
  if (!snapshot.exists || snapshot.data()?.purepress_schema !== PUREPRESS_PROJECT_SCHEMA) throw new Error("PurePress order context was not found.");
}
export async function authorizePurePressUpload(request: Request, category: JobFileCategory, jobId?: string): Promise<PurePressUploadActor> {
  const policy = PUREPRESS_UPLOAD_POLICIES[category];
  if (policy.roles.includes("admin") && await isPurePressAdmin(request)) {
    if (policy.requiresJob) { if (!jobId?.trim()) throw new Error("This PurePress upload requires an order context."); await assertOperationalJob(jobId.trim()); }
    return { role:"admin", uid:"purepress-admin" };
  }
  if (!policy.roles.includes("customer")) throw new Error("This PurePress upload category is admin-only.");
  const customer = await requirePurePressCustomer(request);
  if (policy.requiresJob) {
    if (!jobId?.trim()) throw new Error("This PurePress upload requires an order context.");
    if (!await purePressCustomerCanAccessJob(customer.uid, jobId)) throw new Error("The authenticated customer is not authorized for this order.");
  }
  return { role:"customer", uid:customer.uid, customerId:customer.customerId };
}
