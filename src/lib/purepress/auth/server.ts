import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminDb } from "@/utils/firebaseAdmin";

export interface PurePressCustomerIdentity {
  uid: string;
  email: string;
  displayName?: string;
  customerId?: string;
}

export function normalizePurePressServerEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function bearerTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

export async function verifyPurePressFirebaseToken(request: Request): Promise<DecodedIdToken> {
  const token = bearerTokenFromRequest(request);
  if (!token) throw Object.assign(new Error("Your sign-in has expired."), { status: 401 });
  try {
    return await getAdminAuth().verifyIdToken(token, true);
  } catch {
    throw Object.assign(new Error("Your sign-in has expired."), { status: 401 });
  }
}

/**
 * Authentication only. Order authorization is performed separately against the
 * canonical PurePress customer/job relationship. A client-supplied UID, email,
 * cookie or project ID never becomes identity here.
 */
export async function requirePurePressCustomer(request: Request): Promise<PurePressCustomerIdentity> {
  const token = await verifyPurePressFirebaseToken(request);
  const email = normalizePurePressServerEmail(token.email);
  if (!email || token.email_verified !== true) {
    throw Object.assign(new Error("Use the verified email address for your PurePress order."), { status: 403 });
  }

  const profile = await getAdminDb().collection("purepressCustomerProfiles").doc(token.uid).get();
  const data = profile.exists ? profile.data() ?? {} : {};
  const profileEmail = normalizePurePressServerEmail(data.email);
  if (profile.exists && (data.uid !== token.uid || (profileEmail && profileEmail !== email))) {
    throw Object.assign(new Error("We could not confirm this PurePress sign-in."), { status: 403 });
  }

  return {
    uid: token.uid,
    email,
    displayName: typeof token.name === "string" && token.name.trim()
      ? token.name.trim().slice(0, 120)
      : typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim().slice(0, 120)
        : undefined,
    customerId: typeof data.customerId === "string" && data.customerId.trim() ? data.customerId.trim() : undefined,
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
