import type { EmbroideryJob } from "./domain";

export const PUREPRESS_PROJECT_SCHEMA = "purepress-v1" as const;

export interface PurePressProjectCompatibilityFields {
  purepress_schema: typeof PUREPRESS_PROJECT_SCHEMA;
  purepress_order_id: string;
  purepress_customer_id: string;
  purepress_customer_uid: string;
  purepress_order_status: EmbroideryJob["status"];
}

/**
 * Additive fields for progressively mapping an inherited `projects` document
 * to a PurePress embroidery job. This does not migrate or replace `projects`.
 */
export function toPurePressProjectCompatibilityFields(job: EmbroideryJob): PurePressProjectCompatibilityFields {
  return {
    purepress_schema: PUREPRESS_PROJECT_SCHEMA,
    purepress_order_id: job.id,
    purepress_customer_id: job.customerId,
    purepress_customer_uid: job.customerUid,
    purepress_order_status: job.status,
  };
}
