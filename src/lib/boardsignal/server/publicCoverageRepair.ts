import "server-only";

import type {
  BoardSignalAccount,
  BoardSignalPublicHighlightsStatus,
  FounderPublicHighlightsState,
} from "../account";
import { buildSafePublicCoverage, type SafePublicCoverage } from "../memory";
import type { BoardSignalDesk } from "../types";
import { getAdminDb } from "../../../utils/firebaseAdmin";

export type SafePublicCoverageReconciliationResult = FounderPublicHighlightsState & {
  eligible: boolean;
  projected: number;
  alreadyPresent: number;
  createdOrUpdated: number;
  latestReview?: { deskKey: string; periodLabel: string; periodEnd: string };
};

type StoredCompletedReview = {
  deskKey: string;
  periodEnd: string;
  summary?: { deskKey?: string; periodLabel?: string; periodEnd?: string };
  desk?: BoardSignalDesk;
};

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeDocumentId(value: string) {
  return value.replaceAll("/", "_").slice(0, 700);
}

function publicCoverageDocumentId(playerId: number, deskKey: string) {
  return safeDocumentId(`${playerId}:${deskKey}`);
}

function publicIdentityAllowed(account: BoardSignalAccount) {
  return account.identityStatus !== "provisional" && account.identityStatus !== "revoked";
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function sameSafeCoverage(actual: SafePublicCoverage, expected: SafePublicCoverage) {
  return JSON.stringify(canonicalize(clean(actual))) === JSON.stringify(canonicalize(clean(expected)));
}

async function loadRetainedCompletedReviews(account: BoardSignalAccount) {
  const snapshot = await getAdminDb().collection("users").doc(account.uid).collection("desks")
    .orderBy("periodEnd", "desc")
    .limit(4)
    .get();
  return snapshot.docs.map((document) => document.data() as StoredCompletedReview);
}

function stateForBlockedAccount(account: BoardSignalAccount): BoardSignalPublicHighlightsStatus {
  if (account.identityStatus === "provisional" && account.accessStatus === "active") return "waiting_identity_review";
  return "unavailable";
}

async function reconcileSafePublicCoverage(
  account: BoardSignalAccount,
  writeRepair: boolean,
): Promise<SafePublicCoverageReconciliationResult> {
  const retained = await loadRetainedCompletedReviews(account);
  const latest = retained[0];
  const latestReview = latest?.deskKey && latest.summary?.periodLabel && (latest.summary.periodEnd ?? latest.periodEnd)
    ? {
      deskKey: latest.deskKey,
      periodLabel: latest.summary.periodLabel,
      periodEnd: String(latest.summary.periodEnd ?? latest.periodEnd),
    }
    : undefined;

  const eligible = account.accessStatus === "active" && publicIdentityAllowed(account);
  if (!eligible) {
    return {
      eligible: false,
      retainedReviews: retained.length,
      projected: 0,
      expectedCoverage: 0,
      alreadyPresent: 0,
      liveCoverage: 0,
      createdOrUpdated: 0,
      status: stateForBlockedAccount(account),
      repairAvailable: false,
      latestReview,
    };
  }

  if (!retained.length) {
    return {
      eligible: true,
      retainedReviews: 0,
      projected: 0,
      expectedCoverage: 0,
      alreadyPresent: 0,
      liveCoverage: 0,
      createdOrUpdated: 0,
      status: "no_completed_review",
      repairAvailable: false,
      latestReview,
    };
  }

  const expected = retained.flatMap((review) => {
    if (!review.desk || !review.deskKey) return [];
    const coverage = buildSafePublicCoverage(
      review.desk,
      true,
      { publicPlayerPage: true, universeCoverage: true },
    );
    return coverage ? [{ review, coverage }] : [];
  });

  if (!expected.length) {
    return {
      eligible: true,
      retainedReviews: retained.length,
      projected: 0,
      expectedCoverage: 0,
      alreadyPresent: 0,
      liveCoverage: 0,
      createdOrUpdated: 0,
      status: "no_safe_highlight",
      repairAvailable: false,
      latestReview,
    };
  }

  const db = getAdminDb();
  const inspected = await Promise.all(expected.map(async ({ review, coverage }) => {
    const ref = db.collection("publicCoverage").doc(publicCoverageDocumentId(account.chessCom.playerId, review.deskKey));
    const snapshot = await ref.get();
    const matches = snapshot.exists && sameSafeCoverage(snapshot.data() as SafePublicCoverage, coverage);
    return { ref, coverage, matches };
  }));
  const alreadyPresent = inspected.filter((item) => item.matches).length;
  const missingOrIncomplete = inspected.filter((item) => !item.matches);

  let createdOrUpdated = 0;
  if (writeRepair && missingOrIncomplete.length) {
    for (const item of missingOrIncomplete) {
      // Replace the deterministic public projection with the existing safe builder output only.
      // This path deliberately does not invoke Universe history/events/share-moment helpers.
      await item.ref.set(clean(item.coverage));
      createdOrUpdated += 1;
    }
  }

  const liveCoverage = alreadyPresent + createdOrUpdated;
  const repaired = writeRepair && liveCoverage === expected.length;
  const status: BoardSignalPublicHighlightsStatus = alreadyPresent === expected.length || repaired
    ? "live"
    : "repair_needed";
  return {
    eligible: true,
    retainedReviews: retained.length,
    projected: expected.length,
    expectedCoverage: expected.length,
    alreadyPresent,
    liveCoverage,
    createdOrUpdated,
    status,
    repairAvailable: status === "repair_needed",
    latestReview,
  };
}

export async function inspectSafePublicCoverageForAccount(account: BoardSignalAccount) {
  return reconcileSafePublicCoverage(account, false);
}

export async function ensureSafePublicCoverageForAccount(account: BoardSignalAccount) {
  return reconcileSafePublicCoverage(account, true);
}

function validateStablePlayerId(value: unknown) {
  const playerId = Number(value);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    throw Object.assign(new Error("A stable Chess.com player ID is required."), { status: 400, code: "INVALID_PLAYER_ID" });
  }
  return playerId;
}

export async function repairSafePublicCoverageForPlayer(playerIdInput: unknown) {
  const playerId = validateStablePlayerId(playerIdInput);
  const db = getAdminDb();
  const mapping = await db.collection("chessPlayerAccounts").doc(String(playerId)).get();
  const uid = typeof mapping.data()?.uid === "string" ? String(mapping.data()!.uid) : `chesscom_${playerId}`;
  const accountSnapshot = await db.collection("users").doc(uid).get();
  const account = accountSnapshot.data() as BoardSignalAccount | undefined;
  if (!account || account.uid !== uid || account.chessCom?.playerId !== playerId) {
    throw Object.assign(new Error("The stable BoardSignal account could not be resolved for this Chess.com player ID."), {
      status: 404,
      code: "PLAYER_ACCOUNT_NOT_FOUND",
    });
  }
  return ensureSafePublicCoverageForAccount(account);
}
