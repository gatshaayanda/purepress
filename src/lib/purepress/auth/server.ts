import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminDb } from "@/utils/firebaseAdmin";

export interface PurePressCustomerIdentity {
  uid: string;
  email: string;
  displayName?: string;
  customerId: string;
}

export function bearerTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

export async function verifyPurePressFirebaseToken(request: Request): Promise<DecodedIdToken> {
  const token = bearerTokenFromRequest(request);
  if (!token) throw Object.assign(new Error("Firebase authentication is required."), { status: 401 });
  try {
    return await getAdminAuth().verifyIdToken(token, true);
  } catch {
    throw Object.assign(new Error("Firebase authentication was rejected."), { status: 401 });
  }
}

/**
 * Resolves the Firebase identity to a server-provisioned PurePress customer.
 * A valid Firebase login alone does not grant order access.
 */
export async function requirePurePressCustomer(request: Request): Promise<PurePressCustomerIdentity> {
  const token = await verifyPurePressFirebaseToken(request);
  const email = typeof token.email === "string" ? token.email.trim().toLowerCase() : "";
  if (!email) throw Object.assign(new Error("The Firebase account has no verified email identity."), { status: 403 });

  const profile = await getAdminDb().collection("purepressCustomerProfiles").doc(token.uid).get();
  if (!profile.exists) throw Object.assign(new Error("This Firebase account is not provisioned for PurePress customer access."), { status: 403 });
  const data = profile.data() ?? {};
  if (data.uid !== token.uid || String(data.email ?? "").trim().toLowerCase() !== email) {
    throw Object.assign(new Error("PurePress customer identity does not match the authenticated Firebase account."), { status: 403 });
  }

  return {
    uid: token.uid,
    email,
    displayName: typeof data.displayName === "string" ? data.displayName : undefined,
    customerId: typeof data.customerId === "string" && data.customerId.trim() ? data.customerId : token.uid,
  };
}

export async function purePressCustomerCanAccessJob(uid: string, jobId: string) {
  if (!uid.trim() || !jobId.trim()) return false;
  const access = await getAdminDb()
    .collection("purepressJobAccess")
    .doc(uid)
    .collection("jobs")
    .doc(jobId)
    .get();
  if (!access.exists) return false;
  const data = access.data() ?? {};
  return data.customerUid === uid && data.jobId === jobId;
}
