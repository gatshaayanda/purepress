import "server-only";

import { randomBytes } from "node:crypto";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { EmbroideryJob } from "../domain";
import {
  PurePressQuoteValidationError,
  assertQuoteReadyForIssue,
  type PurePressProjectQuoteState,
  type PurePressQuote,
  type PurePressQuoteApprovalTokenState,
} from "../quotation";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import {
  PUREPRESS_PROJECTS_COLLECTION,
  PUREPRESS_QUOTES_SUBCOLLECTION,
  PUREPRESS_QUOTE_TOKEN_COLLECTION,
  hashQuoteApprovalToken,
  todayInGaborone,
} from "./quotes";

interface PurePressProjectDocument {
  purepress_schema?: string;
  purepress?: EmbroideryJob;
  purepress_order_status?: EmbroideryJob["status"];
  purepress_quote_state?: PurePressProjectQuoteState;
  updatedAt?: string;
}

interface StoredQuoteToken {
  projectId: string;
  quoteId: string;
  revision: number;
  state: PurePressQuoteApprovalTokenState;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

type FirestorePrimitive = string | number | boolean | null;
type FirestorePayload = FirestorePrimitive | FirestorePayload[] | { [key: string]: FirestorePayload };

function cleanId(value: string, field: string) {
  const id = value.trim();
  if (!id || id.length > 160 || id.includes("/")) {
    throw Object.assign(new Error(`${field} is invalid.`), { status: 400 });
  }
  return id;
}

function endOfGaboroneDay(dateOnly: string) {
  return new Date(`${dateOnly}T23:59:59.999+02:00`).toISOString();
}

function projectJob(data: PurePressProjectDocument, projectId: string) {
  const job = data.purepress;
  if (!job || data.purepress_schema !== PUREPRESS_PROJECT_SCHEMA || job.projectId !== projectId) {
    throw Object.assign(new Error("This project is not a PurePress operational job."), { status: 409 });
  }
  return job;
}

function quoteState(data: PurePressProjectDocument, now: string): PurePressProjectQuoteState {
  return data.purepress_quote_state ?? { latestRevision: 0, updatedAt: now };
}

function assertPersistencePayload(label: string, value: unknown, rawToken: string) {
  const seen = new Set<object>();

  const visit = (current: unknown, path: string) => {
    if (current === undefined) {
      throw Object.assign(new Error(`${label} contains undefined at ${path}.`), {
        code: "PUREPRESS_QUOTE_PERSISTENCE_INVALID",
      });
    }
    if (typeof current === "number" && !Number.isFinite(current)) {
      throw Object.assign(new Error(`${label} contains a non-finite number at ${path}.`), {
        code: "PUREPRESS_QUOTE_PERSISTENCE_INVALID",
      });
    }
    if (typeof current === "bigint" || typeof current === "function" || typeof current === "symbol") {
      throw Object.assign(new Error(`${label} contains an unsupported value at ${path}.`), {
        code: "PUREPRESS_QUOTE_PERSISTENCE_INVALID",
      });
    }
    if (typeof current === "string" && current.includes(rawToken)) {
      throw Object.assign(new Error(`${label} attempted to persist the raw approval token.`), {
        code: "PUREPRESS_QUOTE_RAW_TOKEN_PERSISTENCE_BLOCKED",
      });
    }
    if (!current || typeof current !== "object") return;
    if (seen.has(current)) {
      throw Object.assign(new Error(`${label} contains a circular value at ${path}.`), {
        code: "PUREPRESS_QUOTE_PERSISTENCE_INVALID",
      });
    }
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else {
      for (const [key, item] of Object.entries(current)) visit(item, `${path}.${key}`);
    }
    seen.delete(current);
  };

  visit(value, label);
  return value as FirestorePayload;
}

function tokenRecord(
  projectId: string,
  quote: PurePressQuote,
  state: PurePressQuoteApprovalTokenState,
  now: string,
): StoredQuoteToken {
  if (!quote.validUntil) {
    throw new PurePressQuoteValidationError(
      "validUntil is required before creating an approval link.",
      "validUntil",
    );
  }
  return {
    projectId,
    quoteId: quote.id,
    revision: quote.revision,
    state,
    expiresAt: endOfGaboroneDay(quote.validUntil),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Patch E.1 repair for ISSUE QUOTE only.
 *
 * The released Patch E issue transaction rewrote the complete nested `purepress`
 * job snapshot even though ISSUE owns only lifecycle + next-action fields. That
 * made unrelated/legacy nested job data part of the Firestore commit and was the
 * uncontrolled serialization surface behind the QA 500. E.1 persists only the
 * fields ISSUE owns and validates every write payload before committing it.
 */
export async function issueOwnerQuoteE1(projectIdInput: string, quoteIdInput: string) {
  const projectId = cleanId(projectIdInput, "projectId");
  const quoteId = cleanId(quoteIdInput, "quoteId");
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashQuoteApprovalToken(rawToken);
  const db = getAdminDb();
  const projectRef = db.collection(PUREPRESS_PROJECTS_COLLECTION).doc(projectId);
  const quoteRef = projectRef.collection(PUREPRESS_QUOTES_SUBCOLLECTION).doc(quoteId);
  const tokenRef = db.collection(PUREPRESS_QUOTE_TOKEN_COLLECTION).doc(tokenHash);

  return db.runTransaction(async (transaction) => {
    const [projectSnapshot, quoteSnapshot] = await Promise.all([
      transaction.get(projectRef),
      transaction.get(quoteRef),
    ]);
    if (!projectSnapshot.exists || !quoteSnapshot.exists) {
      throw Object.assign(new Error("Quotation was not found."), { status: 404 });
    }

    const project = projectSnapshot.data() as PurePressProjectDocument;
    const job = projectJob(project, projectId);
    const quote = quoteSnapshot.data() as PurePressQuote;
    const state = quoteState(project, quote.updatedAt);

    if (state.currentIssuedQuoteId === quoteId && quote.status === "issued") {
      return { quote, issued: true, changed: false, sharePath: null as string | null };
    }
    if (state.draftQuoteId !== quoteId) {
      throw Object.assign(new Error("This is not the active ready revision."), { status: 409 });
    }

    assertQuoteReadyForIssue(quote, todayInGaborone());
    if (!quote.validUntil) {
      throw new PurePressQuoteValidationError("validUntil is required.", "validUntil");
    }

    const now = new Date().toISOString();

    if (state.currentIssuedQuoteId && state.currentIssuedQuoteId !== quoteId) {
      const priorRef = projectRef
        .collection(PUREPRESS_QUOTES_SUBCOLLECTION)
        .doc(state.currentIssuedQuoteId);
      const priorSnapshot = await transaction.get(priorRef);
      if (!priorSnapshot.exists) {
        throw Object.assign(new Error("The current issued quotation pointer requires repair."), { status: 409 });
      }
      const prior = priorSnapshot.data() as PurePressQuote;
      if (prior.status === "accepted") {
        throw Object.assign(new Error("An accepted commercial revision cannot be replaced in Patch E."), { status: 409 });
      }
      if (!["issued", "changes_requested", "superseded"].includes(prior.status)) {
        throw Object.assign(new Error("The previous commercial revision is in an invalid state."), { status: 409 });
      }
      if (prior.status !== "superseded") {
        const superseded: PurePressQuote = {
          ...prior,
          status: "superseded",
          supersededAt: now,
          ...(prior.approval ? { approval: { ...prior.approval, disabledAt: now } } : {}),
          updatedAt: now,
        };
        assertPersistencePayload("supersededQuote", superseded, rawToken);
        transaction.set(priorRef, superseded);

        if (prior.approval?.tokenHash) {
          const priorToken: StoredQuoteToken = {
            projectId,
            quoteId: prior.id,
            revision: prior.revision,
            state: "superseded",
            expiresAt: prior.approval.expiresAt,
            createdAt: prior.approval.issuedAt,
            updatedAt: now,
          };
          assertPersistencePayload("supersededToken", priorToken, rawToken);
          transaction.set(
            db.collection(PUREPRESS_QUOTE_TOKEN_COLLECTION).doc(prior.approval.tokenHash),
            priorToken,
          );
        }
      }
    }

    const issued: PurePressQuote = {
      ...quote,
      status: "issued",
      issuedAt: now,
      updatedAt: now,
      approval: {
        tokenHash,
        issuedAt: now,
        expiresAt: endOfGaboroneDay(quote.validUntil),
      },
    };
    const { draftQuoteId: _draftQuoteId, draftRevision: _draftRevision, draftStatus: _draftStatus, ...stateWithoutDraft } = state;
    const nextState: PurePressProjectQuoteState = {
      ...stateWithoutDraft,
      quoteNumber: quote.quoteNumber,
      latestRevision: Math.max(state.latestRevision, quote.revision),
      latestQuoteId: quote.id,
      currentIssuedQuoteId: quote.id,
      currentIssuedRevision: quote.revision,
      currentIssuedStatus: "issued",
      currentValidUntil: quote.validUntil,
      updatedAt: now,
    };
    const activeToken = tokenRecord(projectId, issued, "active", now);
    const projectUpdate = {
      "purepress.status": "awaiting_quote_approval",
      "purepress.internal.nextAction": { actor: "customer", action: "Review quotation" },
      "purepress.updatedAt": now,
      purepress_order_status: "awaiting_quote_approval",
      purepress_quote_state: nextState,
      updatedAt: now,
    };

    assertPersistencePayload("issuedQuote", issued, rawToken);
    assertPersistencePayload("approvalToken", activeToken, rawToken);
    assertPersistencePayload("projectIssueUpdate", projectUpdate, rawToken);

    transaction.set(quoteRef, issued);
    transaction.set(tokenRef, activeToken);
    transaction.update(projectRef, projectUpdate);

    return {
      quote: issued,
      issued: true,
      changed: true,
      sharePath: `/quote/${rawToken}`,
    } as const;
  });
}
