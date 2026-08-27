import "server-only";
import { randomBytes } from "node:crypto";
export function proofDiagnosticId() { return `ppf_${randomBytes(6).toString("hex")}`; }
export function logProofFailure(area: string, reason: unknown, context: Record<string, unknown> = {}) {
  const diagnosticId = proofDiagnosticId();
  console.error("[PurePress proof]", { diagnosticId, area, context, reason: reason instanceof Error ? reason.message : String(reason) });
  return diagnosticId;
}
