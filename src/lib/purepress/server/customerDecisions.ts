import "server-only";

import { getAdminDb } from "@/utils/firebaseAdmin";
import type { Customer, EmbroideryJob, ProofRevision, ProofState } from "../domain";
import type { PurePressCustomerIdentity } from "../auth/server";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import {
  isQuoteExpired,
  type PurePressProjectQuoteState,
  type PurePressQuote,
  type PurePressQuoteDecision,
} from "../quotation";
import { parseDecisionInput } from "../artworkProof";
import { PUREPRESS_CUSTOMERS_COLLECTION } from "./customers";
import {
  PUREPRESS_QUOTE_TOKEN_COLLECTION,
  todayInGaborone,
} from "./quotes";
import {
  PUREPRESS_PROOF_ACCESS_COLLECTION,
  PUREPRESS_PROOFS_COLLECTION,
  PUREPRESS_PROOF_STATES_COLLECTION,
} from "./proofs";

interface ProjectDocument {
  purepress_schema?: string;
  purepress?: EmbroideryJob;
  purepress_customer_uid?: string;
  purepress_order_status?: EmbroideryJob["status"];
  purepress_quote_state?: PurePressProjectQuoteState;
  updatedAt?: string;
}

type AuthenticatedQuoteDecision = Omit<PurePressQuoteDecision, "source"> & {
  source: "authenticated_customer";
  decidedByUid: string;
};
type CustomerDecidableQuote = Omit<PurePressQuote, "decision"> & {
  decision?: PurePressQuoteDecision | AuthenticatedQuoteDecision;
};

function customerDecisionText(value: unknown, max: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function parseQuoteDecision(raw: unknown) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const decision = input.decision === "accept" ? "accept" : input.decision === "request_changes" ? "request_changes" : "";
  if (!decision) throw Object.assign(new Error("Choose approve quote or request changes."), { status: 400 });
  const comment = customerDecisionText(input.comment, 1200);
  if (decision === "request_changes" && !comment) {
    throw Object.assign(new Error("Tell PurePress what needs to change."), { status: 400 });
  }
  // Any client-supplied UID/email fields are intentionally not read. Identity
  // comes only from the verified bearer token supplied by requirePurePressCustomer.
  return { decision, comment: comment || undefined } as const;
}

function deny() {
  return Object.assign(new Error("We couldn’t update this order from your My PurePress account."), { status: 404 });
}

function assertOwned(job: EmbroideryJob | undefined, customer: Customer | undefined, identity: PurePressCustomerIdentity, projectId: string) {
  if (!job || job.projectId !== projectId || job.customerUid !== identity.uid) throw deny();
  if (!customer || customer.firebaseUid !== identity.uid || customer.id !== job.customerId) throw deny();
}

function tokenStateRecord(projectId: string, quote: PurePressQuote, state: "accepted" | "changes_requested", now: string) {
  if (!quote.approval) return null;
  return {
    projectId,
    quoteId: quote.id,
    revision: quote.revision,
    state,
    expiresAt: quote.approval.expiresAt,
    createdAt: quote.approval.issuedAt,
    updatedAt: now,
  };
}

export async function decideAuthenticatedCustomerQuote(
  identity: PurePressCustomerIdentity,
  projectIdInput: string,
  raw: unknown,
) {
  const projectId = projectIdInput.trim();
  const parsed = parseQuoteDecision(raw);
  if (!projectId || projectId.includes("/")) throw deny();
  const db = getAdminDb();
  const projectRef = db.collection("projects").doc(projectId);

  return db.runTransaction(async (transaction) => {
    const projectSnapshot = await transaction.get(projectRef);
    if (!projectSnapshot.exists) throw deny();
    const project = projectSnapshot.data() as ProjectDocument;
    if (project.purepress_schema !== PUREPRESS_PROJECT_SCHEMA || project.purepress_customer_uid !== identity.uid) throw deny();
    const job = project.purepress;
    const customerSnapshot = job
      ? await transaction.get(db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(job.customerId))
      : null;
    const customer = customerSnapshot?.exists ? customerSnapshot.data() as Customer : undefined;
    assertOwned(job, customer, identity, projectId);

    const state = project.purepress_quote_state;
    const quoteId = state?.currentIssuedQuoteId;
    if (!state || !quoteId) throw Object.assign(new Error("There is no current quote to review."), { status: 409 });
    const quoteRef = projectRef.collection("quotes").doc(quoteId);
    const quoteSnapshot = await transaction.get(quoteRef);
    if (!quoteSnapshot.exists) throw Object.assign(new Error("The current quote is unavailable."), { status: 409 });
    const quote = quoteSnapshot.data() as CustomerDecidableQuote;

    const previous = quote.decision as AuthenticatedQuoteDecision | undefined;
    if (
      parsed.decision === "accept"
      && quote.status === "accepted"
      && previous?.source === "authenticated_customer"
      && previous.decidedByUid === identity.uid
    ) return { status: "accepted" as const, changed: false };
    if (
      parsed.decision === "request_changes"
      && quote.status === "changes_requested"
      && previous?.source === "authenticated_customer"
      && previous.decidedByUid === identity.uid
    ) return { status: "changes_requested" as const, changed: false };

    if (state.currentIssuedQuoteId !== quote.id || state.currentIssuedRevision !== quote.revision || quote.status !== "issued") {
      throw Object.assign(new Error("This quote was updated. We’ll refresh the latest version."), { status: 409 });
    }
    if (isQuoteExpired(quote as PurePressQuote, todayInGaborone())) {
      throw Object.assign(new Error("This quote has expired. Contact PurePress for the current quote."), { status: 410 });
    }

    const now = new Date().toISOString();
    const acceptingName = identity.displayName?.trim().slice(0, 120);
    if (parsed.decision === "accept") {
      const decision: AuthenticatedQuoteDecision = {
        type: "accepted",
        source: "authenticated_customer",
        revision: quote.revision,
        decidedAt: now,
        decidedByUid: identity.uid,
        ...(acceptingName ? { acceptingName } : {}),
        ...(parsed.comment ? { comment: parsed.comment } : {}),
      };
      const accepted: CustomerDecidableQuote = {
        ...quote,
        status: "accepted",
        decision,
        ...(quote.approval ? { approval: { ...quote.approval, disabledAt: now } } : {}),
        updatedAt: now,
      };
      const updatedJob: EmbroideryJob = {
        ...job!,
        status: "artwork_proof",
        internal: {
          ...job!.internal,
          nextAction: { actor: "owner", action: "Prepare artwork/proof", readinessArea: "artwork" },
        },
        updatedAt: now,
      };
      transaction.set(quoteRef, accepted);
      if (quote.approval?.tokenHash) {
        const record = tokenStateRecord(projectId, quote as PurePressQuote, "accepted", now);
        if (record) transaction.set(db.collection(PUREPRESS_QUOTE_TOKEN_COLLECTION).doc(quote.approval.tokenHash), record, { merge: true });
      }
      transaction.update(projectRef, {
        purepress: updatedJob,
        purepress_order_status: updatedJob.status,
        purepress_quote_state: { ...state, currentIssuedStatus: "accepted", updatedAt: now },
        updatedAt: now,
      });
      return { status: "accepted" as const, changed: true };
    }

    const decision: AuthenticatedQuoteDecision = {
      type: "changes_requested",
      source: "authenticated_customer",
      revision: quote.revision,
      decidedAt: now,
      decidedByUid: identity.uid,
      ...(acceptingName ? { acceptingName } : {}),
      comment: parsed.comment!,
    };
    const changesRequested: CustomerDecidableQuote = {
      ...quote,
      status: "changes_requested",
      decision,
      updatedAt: now,
    };
    const updatedJob: EmbroideryJob = {
      ...job!,
      status: "awaiting_quote_approval",
      internal: {
        ...job!.internal,
        nextAction: { actor: "owner", action: "Review requested quote changes" },
      },
      updatedAt: now,
    };
    transaction.set(quoteRef, changesRequested);
    if (quote.approval?.tokenHash) {
      const record = tokenStateRecord(projectId, quote as PurePressQuote, "changes_requested", now);
      if (record) transaction.set(db.collection(PUREPRESS_QUOTE_TOKEN_COLLECTION).doc(quote.approval.tokenHash), record, { merge: true });
    }
    transaction.update(projectRef, {
      purepress: updatedJob,
      purepress_order_status: updatedJob.status,
      purepress_quote_state: { ...state, currentIssuedStatus: "changes_requested", updatedAt: now },
      updatedAt: now,
    });
    return { status: "changes_requested" as const, changed: true };
  });
}

export async function decideAuthenticatedCustomerProof(
  identity: PurePressCustomerIdentity,
  projectIdInput: string,
  raw: unknown,
) {
  const projectId = projectIdInput.trim();
  if (!projectId || projectId.includes("/")) throw deny();
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const parsed = parseDecisionInput({
    decision: input.decision,
    comment: input.comment,
    approverName: identity.displayName?.trim() || "PurePress customer",
  });
  const db = getAdminDb();
  const projectRef = db.collection("projects").doc(projectId);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const projectSnapshot = await transaction.get(projectRef);
    if (!projectSnapshot.exists) throw deny();
    const project = projectSnapshot.data() as ProjectDocument;
    if (project.purepress_schema !== PUREPRESS_PROJECT_SCHEMA || project.purepress_customer_uid !== identity.uid) throw deny();
    const job = project.purepress;
    const customerSnapshot = job
      ? await transaction.get(db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(job.customerId))
      : null;
    const customer = customerSnapshot?.exists ? customerSnapshot.data() as Customer : undefined;
    assertOwned(job, customer, identity, projectId);

    const proofId = job!.internal.artworkWorkflow?.currentProofId;
    const currentRevision = job!.internal.artworkWorkflow?.currentProofRevision;
    if (!proofId || !currentRevision) throw Object.assign(new Error("There is no current artwork proof to review."), { status: 409 });
    const proofRef = db.collection(PUREPRESS_PROOFS_COLLECTION).doc(proofId);
    const stateRef = db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proofId);
    const [proofSnapshot, stateSnapshot] = await Promise.all([transaction.get(proofRef), transaction.get(stateRef)]);
    if (!proofSnapshot.exists || !stateSnapshot.exists) throw Object.assign(new Error("The current artwork proof is unavailable."), { status: 409 });
    const proof = proofSnapshot.data() as ProofRevision;
    const state = stateSnapshot.data() as ProofState;
    if (
      proof.projectId !== projectId
      || proof.id !== proofId
      || proof.revision !== currentRevision
      || state.proofId !== proofId
      || state.orderId !== projectId
      || state.revision !== currentRevision
      || state.status !== "awaiting_customer"
    ) throw Object.assign(new Error("This artwork was updated. We’ll refresh the latest version."), { status: 409 });

    const decision = {
      type: parsed.decision,
      source: "authenticated_customer" as const,
      approverName: parsed.approverName,
      ...(parsed.comment ? { comment: parsed.comment } : {}),
      decidedByUid: identity.uid,
      decidedAt: now,
    };
    if (state.activeTokenHash) {
      transaction.set(
        db.collection(PUREPRESS_PROOF_ACCESS_COLLECTION).doc(state.activeTokenHash),
        { decisionRecordedAt: now },
        { merge: true },
      );
    }
    transaction.update(stateRef, { status: decision.type, decision, updatedAt: now });
    transaction.update(projectRef, {
      "purepress.status": "artwork_proof",
      purepress_order_status: "artwork_proof",
      "purepress.internal.readiness.proof": decision.type,
      "purepress.internal.readiness.production": "not_ready",
      "purepress.internal.nextAction": decision.type === "approved"
        ? { actor: "owner", action: "Confirm final artwork and sample readiness", readinessArea: "artwork" }
        : { actor: "owner", action: "Prepare a revised artwork proof", readinessArea: "proof", blocker: "Customer requested changes" },
      "purepress.updatedAt": now,
      updatedAt: now,
    });
    return { status: decision.type, changed: true } as const;
  });
}
