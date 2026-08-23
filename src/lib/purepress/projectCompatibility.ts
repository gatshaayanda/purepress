import type { EmbroideryJob } from "./domain";

export const PUREPRESS_PROJECT_SCHEMA = "purepress-v1" as const;

export interface PurePressProjectCompatibilityFields {
  purepress_schema: typeof PUREPRESS_PROJECT_SCHEMA;
  purepress_order_id: string;
  purepress_customer_id: string;
  purepress_customer_uid?: string;
  purepress_order_status: EmbroideryJob["status"];
}

/**
 * Additive compatibility fields for the inherited `projects` root. The
 * namespaced `purepress` job payload in the same project document remains the
 * operational source of truth; these top-level keys exist only for legacy
 * discovery and are written in the same atomic server mutation.
 */
export function toPurePressProjectCompatibilityFields(job: EmbroideryJob): PurePressProjectCompatibilityFields {
  return {
    purepress_schema: PUREPRESS_PROJECT_SCHEMA,
    purepress_order_id: job.id,
    purepress_customer_id: job.customerId,
    ...(job.customerUid ? { purepress_customer_uid: job.customerUid } : {}),
    purepress_order_status: job.status,
  };
}
