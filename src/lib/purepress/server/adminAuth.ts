import "server-only";

import { getAdminAuth } from "@/utils/firebaseAdmin";
import { bearerTokenFromRequest } from "../auth/server";
import { requireFounderAuth } from "@/lib/boardsignal/server/founderAuth";

export interface PurePressAdminAuthorization {
  authorized: true;
  source: "firebase-claim" | "legacy-admin-session";
  uid?: string;
}

async function purePressAdminFromFirebase(request: Request): Promise<PurePressAdminAuthorization | null> {
  const token = bearerTokenFromRequest(request);
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    if (decoded.purepress_admin === true || decoded.admin === true) {
      return { authorized: true, source: "firebase-claim", uid: decoded.uid };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * PurePress-facing admin boundary. During transition it accepts the already
 * protected AdminHub/BoardSignal signed admin session and converts it to a
 * product-neutral authorization result. New PurePress code should call this
 * abstraction rather than founder-specific helpers directly.
 */
export async function requirePurePressAdmin(request: Request): Promise<PurePressAdminAuthorization> {
  const firebaseAdmin = await purePressAdminFromFirebase(request);
  if (firebaseAdmin) return firebaseAdmin;
  await requireFounderAuth(request);
  return { authorized: true, source: "legacy-admin-session" };
}

export async function isPurePressAdmin(request: Request) {
  try {
    await requirePurePressAdmin(request);
    return true;
  } catch {
    return false;
  }
}
