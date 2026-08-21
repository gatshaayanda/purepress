export const FOUNDER_OPS_DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_DUE_GRACE_MS = 12 * 60 * 60 * 1000;

export type FounderOpsContactMethod = "email" | "discord" | "telegram" | "chesscom" | "other";
export type FounderAttentionReason = "EXCEPTION" | "IDENTITY" | "UNREAD_REPLY" | "NEW_REQUEST" | "REVIEW_READY" | "FOLLOW_UP_DUE" | "NOT_SEEN";
export type FounderOperationFilter = "all" | "attention" | "new_requests" | "follow_up_due" | "reviews_ready" | "reviews_forming" | "unread_replies" | "not_seen" | "identity" | "exceptions";
export type FounderOperationSort = "attention" | "next_review" | "last_seen" | "review_count" | "username";

export type FounderOperationInput = {
  uid: string;
  username: string;
  preferredContactValue?: string;
  lastSeenAt?: string;
  nextDeskDueAt?: string;
  forming?: boolean;
  latestReview?: { publishedAt?: string; periodStart?: string; periodEnd?: string; periodLabel?: string };
  unreadReplies?: number;
  pendingRequest?: boolean;
  pendingRequestAt?: string;
  unreadReplyAt?: string;
  exceptionAt?: string;
  exceptionCount?: number;
  identityConflict?: boolean;
  founderOps?: { lastContactedAt?: string; lastContactMethod?: FounderOpsContactMethod; followUpSnoozedUntil?: string };
};

export type FounderOperationDerived = {
  currentState: "EXCEPTION" | "IDENTITY CONFLICT" | "UNREAD REPLY" | "NEW REQUEST" | "REVIEW READY · NOT SEEN" | "REVIEW CHECK REQUIRED" | "FORMING" | "NOT SEEN RECENTLY" | "ACTIVE";
  readyNotSeen: boolean;
  notSeenRecently: boolean;
  reviewCheckRequired: boolean;
  followUpDueAt?: string;
  followUpStatus: "none" | "upcoming" | "due" | "snoozed" | "check";
  attentionReasons: FounderAttentionReason[];
  attentionRank: number;
  oldestActionAt?: string;
};

function parsed(value?: string) {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

function dueAnchor(value?: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parsed(`${value}T00:00:00.000Z`);
  return parsed(value);
}

function iso(time?: number) {
  return time === undefined ? undefined : new Date(time).toISOString();
}

export function attentionPriority(reason: FounderAttentionReason) {
  return ({ EXCEPTION: 1, IDENTITY: 2, UNREAD_REPLY: 3, NEW_REQUEST: 4, REVIEW_READY: 5, FOLLOW_UP_DUE: 6, NOT_SEEN: 7 } as const)[reason];
}

export function deriveFounderOperation(input: FounderOperationInput, nowInput: Date | string = new Date()): FounderOperationDerived {
  const now = nowInput instanceof Date ? nowInput.getTime() : Date.parse(nowInput);
  const lastSeen = parsed(input.lastSeenAt);
  const published = parsed(input.latestReview?.publishedAt);
  const lastContacted = parsed(input.founderOps?.lastContactedAt);
  const snoozedUntil = parsed(input.founderOps?.followUpSnoozedUntil);
  const nextDue = dueAnchor(input.nextDeskDueAt);
  const readyNotSeen = Boolean(published !== undefined && (lastSeen === undefined || lastSeen < published));
  const notSeenRecently = lastSeen === undefined || lastSeen <= now - 7 * FOUNDER_OPS_DAY_MS;
  const reviewCheckRequired = Boolean(
    nextDue !== undefined
    && now > nextDue + REVIEW_DUE_GRACE_MS
    && !readyNotSeen
    && !input.forming,
  );

  let followUpDueAt: number | undefined;
  if (readyNotSeen && published !== undefined) {
    followUpDueAt = lastContacted !== undefined && lastContacted >= published
      ? lastContacted + 3 * FOUNDER_OPS_DAY_MS
      : published + FOUNDER_OPS_DAY_MS;
  }

  let followUpStatus: FounderOperationDerived["followUpStatus"] = "none";
  if (snoozedUntil !== undefined && snoozedUntil > now && (followUpDueAt !== undefined || notSeenRecently)) followUpStatus = "snoozed";
  else if (followUpDueAt !== undefined) followUpStatus = followUpDueAt <= now ? "due" : "upcoming";
  else if (notSeenRecently && lastSeen === undefined) followUpStatus = "check";

  const attentionReasons: FounderAttentionReason[] = [];
  if ((input.exceptionCount ?? 0) > 0 || reviewCheckRequired) attentionReasons.push("EXCEPTION");
  if (input.identityConflict) attentionReasons.push("IDENTITY");
  if ((input.unreadReplies ?? 0) > 0) attentionReasons.push("UNREAD_REPLY");
  if (input.pendingRequest) attentionReasons.push("NEW_REQUEST");
  if (readyNotSeen) attentionReasons.push("REVIEW_READY");
  if (followUpStatus === "due") attentionReasons.push("FOLLOW_UP_DUE");
  if (notSeenRecently) attentionReasons.push("NOT_SEEN");
  attentionReasons.sort((a, b) => attentionPriority(a) - attentionPriority(b));

  const currentState: FounderOperationDerived["currentState"] =
    ((input.exceptionCount ?? 0) > 0 || reviewCheckRequired) ? (reviewCheckRequired ? "REVIEW CHECK REQUIRED" : "EXCEPTION")
      : input.identityConflict ? "IDENTITY CONFLICT"
        : (input.unreadReplies ?? 0) > 0 ? "UNREAD REPLY"
          : input.pendingRequest ? "NEW REQUEST"
            : readyNotSeen ? "REVIEW READY · NOT SEEN"
              : input.forming ? "FORMING"
                : notSeenRecently ? "NOT SEEN RECENTLY"
                  : "ACTIVE";

  const actionTimes = [
    (input.exceptionCount ?? 0) > 0 ? parsed(input.exceptionAt) : undefined,
    (input.unreadReplies ?? 0) > 0 ? parsed(input.unreadReplyAt) : undefined,
    input.pendingRequest ? parsed(input.pendingRequestAt) : undefined,
    readyNotSeen ? published : undefined,
    followUpStatus === "due" ? followUpDueAt : undefined,
    reviewCheckRequired ? nextDue : undefined,
    notSeenRecently ? lastSeen : undefined,
  ].filter((value): value is number => value !== undefined);

  return {
    currentState,
    readyNotSeen,
    notSeenRecently,
    reviewCheckRequired,
    followUpDueAt: iso(followUpDueAt),
    followUpStatus,
    attentionReasons,
    attentionRank: attentionReasons.length ? attentionPriority(attentionReasons[0]) : 99,
    oldestActionAt: actionTimes.length ? iso(Math.min(...actionTimes)) : undefined,
  };
}

export type FounderOperationComparableRow = FounderOperationDerived & {
  uid: string;
  username: string;
  preferredContactValue?: string;
  reviewCount: number;
  nextDeskDueAt?: string;
  lastSeenAt?: string;
  unreadReplies: number;
  exceptionCount: number;
  identityConflict: boolean;
  pendingRequest: boolean;
  forming: boolean;
};

export function filterFounderOperationRows(rows: FounderOperationComparableRow[], filter: FounderOperationFilter, search = "") {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (needle && !`${row.username} ${row.preferredContactValue ?? ""}`.toLowerCase().includes(needle)) return false;
    if (filter === "attention") return row.attentionReasons.length > 0;
    if (filter === "new_requests") return row.pendingRequest;
    if (filter === "follow_up_due") return row.followUpStatus === "due";
    if (filter === "reviews_ready") return row.readyNotSeen;
    if (filter === "reviews_forming") return row.forming;
    if (filter === "unread_replies") return row.unreadReplies > 0;
    if (filter === "not_seen") return row.notSeenRecently;
    if (filter === "identity") return row.identityConflict;
    if (filter === "exceptions") return row.exceptionCount > 0 || row.reviewCheckRequired;
    return true;
  });
}

export function sortFounderOperationRows(rows: FounderOperationComparableRow[], sort: FounderOperationSort) {
  const copy = [...rows];
  return copy.sort((a, b) => {
    if (sort === "username") return a.username.localeCompare(b.username);
    if (sort === "review_count") return b.reviewCount - a.reviewCount || a.username.localeCompare(b.username);
    if (sort === "next_review") return String(a.nextDeskDueAt ?? "9999").localeCompare(String(b.nextDeskDueAt ?? "9999")) || a.username.localeCompare(b.username);
    if (sort === "last_seen") return String(a.lastSeenAt ?? "").localeCompare(String(b.lastSeenAt ?? "")) || a.username.localeCompare(b.username);
    return a.attentionRank - b.attentionRank
      || String(a.oldestActionAt ?? "9999").localeCompare(String(b.oldestActionAt ?? "9999"))
      || a.username.localeCompare(b.username);
  });
}

export type ValidationOriginalSourceEntry = {
  handle: string;
  normalizedHandle: string;
  stablePlayerId?: number;
  periodStart: string;
  periodEnd: string;
};

export type ValidationIdentityAccount = {
  uid: string;
  chessCom: { playerId: number; canonicalUsername: string };
  eligibleCoverageKeys?: string[];
};

export type ValidationIdentityAlias = {
  normalizedHandle: string;
  uid?: string;
  playerId?: number;
};

export type ValidationOriginalProvenance = {
  uid: string;
  playerId: number;
  seedHandle: string;
  periodStart?: string;
  periodEnd?: string;
};

function normalizeValidationHandle(value?: string) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

function validStablePlayerId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function fallbackOriginalPlayerKey(entry: ValidationOriginalSourceEntry) {
  return `original:${normalizeValidationHandle(entry.normalizedHandle || entry.handle)}`;
}

/**
 * Resolve one Original Beta source record to a modern stable player only when
 * identity evidence is exact. Review period alone is deliberately never used
 * as identity evidence because multiple historical players can share a period.
 */
export function resolveOriginalBetaSourcePlayerKey(
  entry: ValidationOriginalSourceEntry,
  accounts: ValidationIdentityAccount[],
  aliases: ValidationIdentityAlias[] = [],
  provenance: ValidationOriginalProvenance[] = [],
) {
  const fallback = fallbackOriginalPlayerKey(entry);
  const sourceHandle = normalizeValidationHandle(entry.normalizedHandle || entry.handle);

  if (validStablePlayerId(entry.stablePlayerId)) return `id:${entry.stablePlayerId}`;

  const exactAccounts = accounts.filter((account) => {
    const aliasesForAccount = [account.chessCom.canonicalUsername, ...(account.eligibleCoverageKeys ?? [])];
    return aliasesForAccount.some((value) => normalizeValidationHandle(value) === sourceHandle);
  });
  const exactPlayerIds = [...new Set(exactAccounts.map((account) => account.chessCom.playerId).filter(validStablePlayerId))];
  if (exactPlayerIds.length === 1) return `id:${exactPlayerIds[0]}`;
  // Conflicting exact username/coverage matches are stronger evidence of an
  // identity conflict than any weaker alias/provenance signal. Keep independent.
  if (exactPlayerIds.length > 1) return fallback;

  const aliasCandidates = aliases.filter((alias) => normalizeValidationHandle(alias.normalizedHandle) === sourceHandle);
  const aliasTargets = new Map<string, ValidationIdentityAlias>();
  for (const alias of aliasCandidates) {
    if (!alias.uid?.trim() || !validStablePlayerId(alias.playerId)) continue;
    aliasTargets.set(`${alias.uid}|${alias.playerId}`, alias);
  }
  if (aliasTargets.size === 1) {
    const alias = [...aliasTargets.values()][0];
    const aliasUid = alias.uid!.trim();
    const aliasPlayerId = alias.playerId!;
    const mappedAccount = accounts.find((account) => account.uid === aliasUid);
    const samePlayerAccounts = accounts.filter((account) => account.chessCom.playerId === aliasPlayerId);
    const deterministicUid = `chesscom_${aliasPlayerId}`;
    const aliasIsConsistent = Boolean(
      mappedAccount
      && mappedAccount.chessCom.playerId === aliasPlayerId
      && mappedAccount.uid === deterministicUid
      && samePlayerAccounts.every((account) => account.uid === mappedAccount.uid),
    );
    if (aliasIsConsistent) return `id:${aliasPlayerId}`;
  }

  const provenanceMatches = provenance.filter((item) => {
    if (normalizeValidationHandle(item.seedHandle) !== sourceHandle) return false;
    if (item.periodStart && item.periodStart !== entry.periodStart) return false;
    if (item.periodEnd && item.periodEnd !== entry.periodEnd) return false;
    const mappedAccount = accounts.find((account) => account.uid === item.uid);
    const deterministicUid = `chesscom_${item.playerId}`;
    const samePlayerAccounts = accounts.filter((account) => account.chessCom.playerId === item.playerId);
    return Boolean(
      mappedAccount
      && validStablePlayerId(item.playerId)
      && mappedAccount.chessCom.playerId === item.playerId
      && mappedAccount.uid === deterministicUid
      && samePlayerAccounts.every((account) => account.uid === mappedAccount.uid)
    );
  });
  const provenancePlayerIds = [...new Set(provenanceMatches.map((item) => item.playerId))];
  if (provenancePlayerIds.length === 1) return `id:${provenancePlayerIds[0]}`;

  return fallback;
}

export type ValidationEvidence = { playerKey: string; periodStart: string; periodEnd: string; source: "original" | "live" };

export function summarizeValidationEvidence(evidence: ValidationEvidence[], originalToLivePlayerKeys: Iterable<string>) {
  const unique = new Map<string, ValidationEvidence>();
  for (const item of evidence) {
    const key = `${item.playerKey}|${item.periodStart}|${item.periodEnd}`;
    const existing = unique.get(key);
    if (!existing || item.source === "original") unique.set(key, item);
  }
  const byPlayer = new Map<string, number>();
  let originalReviews = 0;
  let liveReviews = 0;
  for (const item of unique.values()) {
    byPlayer.set(item.playerKey, (byPlayer.get(item.playerKey) ?? 0) + 1);
    if (item.source === "original") originalReviews += 1;
    else liveReviews += 1;
  }
  const counts = [...byPlayer.values()];
  const originalToLive = new Set(originalToLivePlayerKeys).size;
  return {
    playersServed: byPlayer.size,
    verifiedReviews: unique.size,
    originalReviews,
    liveReviews,
    originalToLive,
    r2Plus: counts.filter((count) => count >= 2).length,
    r3Plus: counts.filter((count) => count >= 3).length,
    r4: counts.filter((count) => count >= 4).length,
  };
}
