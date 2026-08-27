import type { EmbroideryJob, ProofState } from "./domain";

export class PurePressArtworkProofError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = "PurePressArtworkProofError"; this.status = status; }
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function positiveNumber(value: unknown, max: number) {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > max) throw new PurePressArtworkProofError("A numeric proof fact is outside the accepted range.");
  return Math.round(number * 10) / 10;
}
export function parseProofIssueInput(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new PurePressArtworkProofError("Proof details are required.");
  const input = raw as Record<string, unknown>;
  const proofFileIds = Array.isArray(input.proofFileIds) ? [...new Set(input.proofFileIds.map((v) => text(v, 160)).filter(Boolean))] : [];
  if (!proofFileIds.length || proofFileIds.length > 8) throw new PurePressArtworkProofError("Select between one and eight proof files.");
  return {
    proofFileIds,
    customerVisibleNotes: text(input.customerVisibleNotes, 1600) || undefined,
    placementSummary: text(input.placementSummary, 500) || undefined,
    designWidthMm: positiveNumber(input.designWidthMm, 5000),
    designHeightMm: positiveNumber(input.designHeightMm, 5000),
    threadColorSummary: text(input.threadColorSummary, 800) || undefined,
  };
}
export function parseDecisionInput(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new PurePressArtworkProofError("A proof decision is required.");
  const input = raw as Record<string, unknown>;
  const decision = input.decision === "approve" ? "approved" : input.decision === "request_changes" ? "changes_requested" : "";
  if (!decision) throw new PurePressArtworkProofError("Choose approve or request changes.");
  const approverName = text(input.approverName, 120);
  const comment = text(input.comment, 1200);
  if (!approverName) throw new PurePressArtworkProofError("Approver name is required.");
  if (decision === "changes_requested" && !comment) throw new PurePressArtworkProofError("Describe the requested changes.");
  return { decision, approverName, comment: comment || undefined } as const;
}
export function parseArtworkAction(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new PurePressArtworkProofError("Artwork action is required.");
  const input = raw as Record<string, unknown>;
  const action = text(input.action, 80);
  const allowed = ["set_artwork_readiness", "set_digitising", "set_embroidery_facts", "set_sample_readiness", "issue_proof", "replace_approval_link", "record_owner_approval", "finalize_for_production"];
  if (!allowed.includes(action)) throw new PurePressArtworkProofError("Artwork action is not supported.");
  return { ...input, action };
}
export function canFinalizeArtwork(job: EmbroideryJob, proofState?: ProofState | null) {
  const readiness = job.internal.readiness;
  const embroidery = job.internal.embroidery;
  if (!readiness || readiness.artwork !== "production_ready") return { ok: false, reason: "Final artwork is not production ready." } as const;
  const sourceArtwork = (job.internal.sourceArtworkFileIds?.length ?? 0) + (job.internal.artworkWorkflow?.customerArtworkFileIds?.length ?? 0);
  if (!sourceArtwork) return { ok: false, reason: "At least one private customer or quote artwork source is required." } as const;
  if (!proofState || proofState.proofId !== job.internal.artworkWorkflow?.currentProofId || proofState.status !== "approved") return { ok: false, reason: "The current proof revision is not approved." } as const;
  if (readiness.proof !== "approved") return { ok: false, reason: "Proof readiness is not approved." } as const;
  if (embroidery?.digitizingRequired && (embroidery.digitizingStatus !== "complete" || !(embroidery.productionFileRefs?.length))) return { ok: false, reason: "Digitising must be complete with a private production file." } as const;
  if (embroidery?.sampleRequired && readiness.sample !== "approved") return { ok: false, reason: "The required sew-out/sample is not approved." } as const;
  return { ok: true } as const;
}
