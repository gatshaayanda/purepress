import "server-only";

import { getAdminDb } from "@/utils/firebaseAdmin";
import type { Customer } from "../domain";

export const PUREPRESS_CUSTOMERS_COLLECTION = "purepressCustomers";

export interface InternalCustomerSeed {
  displayName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source: "quote_request" | "owner_created" | "legacy";
  notes?: string;
}

export function buildInternalCustomer(
  id: string,
  seed: InternalCustomerSeed,
  now = new Date().toISOString(),
): Customer {
  return {
    id,
    customerVisible: {
      displayName: seed.displayName,
      ...(seed.email ? { email: seed.email } : {}),
      ...(seed.phone ? { phone: seed.phone } : {}),
      ...(seed.companyName ? { companyName: seed.companyName } : {}),
    },
    internal: {
      source: seed.source,
      ...(seed.notes ? { notes: seed.notes } : {}),
    },
    createdAt: now,
    updatedAt: now,
  };
}

export async function getInternalCustomer(customerId: string) {
  const cleanId = customerId.trim();
  if (!cleanId) return null;
  const snapshot = await getAdminDb().collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(cleanId).get();
  return snapshot.exists ? snapshot.data() as Customer : null;
}

/**
 * Client authorization may only be projected for a genuinely linked Firebase
 * account. Contact-field matching never grants access.
 */
export function linkedFirebaseUid(customer: Customer) {
  return typeof customer.firebaseUid === "string" && customer.firebaseUid.trim()
    ? customer.firebaseUid.trim()
    : null;
}
