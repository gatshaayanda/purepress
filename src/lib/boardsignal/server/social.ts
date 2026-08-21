import "server-only";

import { createHash } from "node:crypto";
import type { BoardSignalAccount } from "../account";
import { hasAcceptedCurrentBetaAgreement } from "../account";
import { standingsFromActiveBoards } from "../pulse";
import { deskToUniverseParticipant } from "../universe";
import {
  buildHeadToHeadPayload,
  canonicalSocialRelationshipId,
  isMeaningfulRivalGap,
  resolveFriendRequestTransition,
  socialBlockId,
  type SocialPlayerCard,
  type SocialProjection,
  type SocialRelationshipRecord,
} from "../social";
import { getAdminDb } from "../../../utils/firebaseAdmin";
import { sendRelationshipNotification } from "./communications";
import { loadPublishedDesks } from "./persistence";
import { loadActiveUniverseState } from "./universePulse";

function clean<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function nowIso(now = new Date()) { return now.toISOString(); }
function numericPlayerId(value: unknown) {
  const playerId = Number(value);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) throw Object.assign(new Error("A stable Chess.com player ID is required."), { status: 400 });
  return playerId;
}
function activeSocialMember(account: BoardSignalAccount | undefined): account is BoardSignalAccount {
  return Boolean(account
    && account.role === "player"
    && account.accessStatus === "active"
    && account.accessTier === "founding_beta"
    && hasAcceptedCurrentBetaAgreement(account)
    && account.universeParticipationDisclosedAt);
}

async function accountByPlayerId(playerId: number) {
  const db = getAdminDb();
  const mapping = await db.collection("chessPlayerAccounts").doc(String(playerId)).get();
  const uid = mapping.exists && typeof mapping.data()?.uid === "string" ? String(mapping.data()!.uid) : `chesscom_${playerId}`;
  const snapshot = await db.collection("users").doc(uid).get();
  const account = snapshot.exists ? snapshot.data() as BoardSignalAccount : undefined;
  if (!activeSocialMember(account)) throw Object.assign(new Error("That BoardSignal player is not available for social connection."), { status: 404 });
  return account;
}

async function blocksEitherDirection(a: number, b: number) {
  const db = getAdminDb();
  const [ab, ba] = await Promise.all([
    db.collection("socialBlocks").doc(socialBlockId(a, b)).get(),
    db.collection("socialBlocks").doc(socialBlockId(b, a)).get(),
  ]);
  return ab.exists || ba.exists;
}

function projectionFor(account: BoardSignalAccount, other: BoardSignalAccount, relationship: SocialRelationshipRecord, status: SocialProjection["status"], previous?: SocialProjection) : SocialProjection {
  return {
    relationshipId: relationship.id,
    otherPlayerId: other.chessCom.playerId,
    canonicalUsername: other.chessCom.canonicalUsername,
    avatar: other.chessCom.avatar,
    status,
    updatedAt: relationship.updatedAt,
    rivalPinned: previous?.rivalPinned === true,
  };
}

async function projection(uid: string, otherPlayerId: number) {
  const snapshot = await getAdminDb().collection("users").doc(uid).collection("social").doc(String(otherPlayerId)).get();
  return snapshot.exists ? snapshot.data() as SocialProjection : undefined;
}

async function createFriendshipFromPending(relationship: SocialRelationshipRecord, actor: BoardSignalAccount, target: BoardSignalAccount, now = new Date()) {
  const db = getAdminDb();
  const ref = db.collection("socialRelationships").doc(relationship.id);
  const updatedAt = nowIso(now);
  const next: SocialRelationshipRecord = { ...relationship, status: "friends", acceptedAt: updatedAt, updatedAt };
  const actorPrevious = await projection(actor.uid, target.chessCom.playerId);
  const targetPrevious = await projection(target.uid, actor.chessCom.playerId);
  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref);
    if (!latest.exists || latest.data()?.status !== "pending") throw Object.assign(new Error("This friend request is no longer pending."), { status: 409 });
    transaction.set(ref, clean(next));
    transaction.set(db.collection("users").doc(actor.uid).collection("social").doc(String(target.chessCom.playerId)), clean(projectionFor(actor, target, next, "friends", actorPrevious)));
    transaction.set(db.collection("users").doc(target.uid).collection("social").doc(String(actor.chessCom.playerId)), clean(projectionFor(target, actor, next, "friends", targetPrevious)));
  });
  return next;
}

export async function sendFriendRequest(actor: BoardSignalAccount, targetPlayerIdInput: unknown) {
  const targetPlayerId = numericPlayerId(targetPlayerIdInput);
  if (actor.chessCom.playerId === targetPlayerId) throw Object.assign(new Error("You cannot send a friend request to yourself."), { status: 400 });
  const target = await accountByPlayerId(targetPlayerId);
  const db = getAdminDb();
  const id = canonicalSocialRelationshipId(actor.chessCom.playerId, targetPlayerId);
  if (await blocksEitherDirection(actor.chessCom.playerId, targetPlayerId)) {
    throw Object.assign(new Error("This social connection is unavailable."), { status: 403 });
  }
  const ref = db.collection("socialRelationships").doc(id);
  const existingSnapshot = await ref.get();
  const existing = existingSnapshot.exists ? existingSnapshot.data() as SocialRelationshipRecord : undefined;
  const transition = resolveFriendRequestTransition({ actorPlayerId: actor.chessCom.playerId, targetPlayerId, existing });
  if (!transition.allowed) {
    const message = transition.reason === "duplicate" ? "A friend request is already pending." : transition.reason === "already_friends" ? "You are already friends." : "This social connection is unavailable.";
    throw Object.assign(new Error(message), { status: 409 });
  }
  if (transition.action === "accept_mutual" && existing) {
    const relationship = await createFriendshipFromPending(existing, actor, target);
    await sendRelationshipNotification(target, {
      id: `friend_accepted_${relationship.id}`,
      type: "friend_accepted",
      title: "Friend connected",
      body: `You're now connected with ${actor.chessCom.canonicalUsername}.`,
      link: "/boardsignal/player-room?tab=friends",
      actionLabel: "Compare",
    }).catch(() => undefined);
    return { status: "friends" as const, relationship };
  }
  const rateRef = db.collection("socialRequestRateLimits").doc(`${actor.chessCom.playerId}_${targetPlayerId}`);
  const rate = await rateRef.get();
  const nextAllowedAt = Number(rate.data()?.nextAllowedAt ?? 0);
  if (rate.exists && Number.isFinite(nextAllowedAt) && nextAllowedAt > Date.now()) {
    throw Object.assign(new Error("A recent friend request was already sent to this player. Try again later."), { status: 429 });
  }
  const timestamp = nowIso();
  const relationship: SocialRelationshipRecord = {
    id,
    playerAId: Math.min(actor.chessCom.playerId, targetPlayerId),
    playerAUid: actor.chessCom.playerId < targetPlayerId ? actor.uid : target.uid,
    playerBId: Math.max(actor.chessCom.playerId, targetPlayerId),
    playerBUid: actor.chessCom.playerId < targetPlayerId ? target.uid : actor.uid,
    status: "pending",
    requestedByPlayerId: actor.chessCom.playerId,
    requestedAt: timestamp,
    updatedAt: timestamp,
  };
  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref);
    if (latest.exists) throw Object.assign(new Error("A social relationship already exists for these players."), { status: 409 });
    transaction.create(ref, clean(relationship));
    transaction.set(rateRef, clean({ actorPlayerId: actor.chessCom.playerId, targetPlayerId, lastSentAt: timestamp, nextAllowedAt: Date.now() + 6 * 60 * 60 * 1000 }));
    transaction.set(db.collection("users").doc(actor.uid).collection("social").doc(String(targetPlayerId)), clean(projectionFor(actor, target, relationship, "outgoing")));
    transaction.set(db.collection("users").doc(target.uid).collection("social").doc(String(actor.chessCom.playerId)), clean(projectionFor(target, actor, relationship, "incoming")));
  });
  await sendRelationshipNotification(target, {
    id: `friend_request_${relationship.id}`,
    type: "friend_request",
    title: "Friend request",
    body: `${actor.chessCom.canonicalUsername} wants to connect on BoardSignal.`,
    link: "/boardsignal/player-room?tab=friends",
    actionLabel: "View request",
  }).catch(() => undefined);
  return { status: "pending" as const, relationship };
}

async function pendingRelationshipFor(actor: BoardSignalAccount, otherPlayerId: number) {
  const id = canonicalSocialRelationshipId(actor.chessCom.playerId, otherPlayerId);
  const snapshot = await getAdminDb().collection("socialRelationships").doc(id).get();
  if (!snapshot.exists) throw Object.assign(new Error("The friend request was not found."), { status: 404 });
  const relationship = snapshot.data() as SocialRelationshipRecord;
  if (relationship.status !== "pending") throw Object.assign(new Error("The friend request is no longer pending."), { status: 409 });
  return relationship;
}

export async function acceptFriendRequest(actor: BoardSignalAccount, otherPlayerIdInput: unknown) {
  const otherPlayerId = numericPlayerId(otherPlayerIdInput);
  const relationship = await pendingRelationshipFor(actor, otherPlayerId);
  if (relationship.requestedByPlayerId === actor.chessCom.playerId) throw Object.assign(new Error("Only the receiving player can accept this request."), { status: 403 });
  if (await blocksEitherDirection(actor.chessCom.playerId, otherPlayerId)) throw Object.assign(new Error("This social connection is unavailable."), { status: 403 });
  const other = await accountByPlayerId(otherPlayerId);
  const next = await createFriendshipFromPending(relationship, actor, other);
  await sendRelationshipNotification(other, {
    id: `friend_accepted_${next.id}`,
    type: "friend_accepted",
    title: "Friend request accepted",
    body: `You're now connected with ${actor.chessCom.canonicalUsername}.`,
    link: "/boardsignal/player-room?tab=friends",
    actionLabel: "Compare",
  }).catch(() => undefined);
  return next;
}

export async function declineFriendRequest(actor: BoardSignalAccount, otherPlayerIdInput: unknown) {
  const otherPlayerId = numericPlayerId(otherPlayerIdInput);
  const relationship = await pendingRelationshipFor(actor, otherPlayerId);
  if (relationship.requestedByPlayerId === actor.chessCom.playerId) throw Object.assign(new Error("Use cancel for an outgoing request."), { status: 403 });
  const db = getAdminDb();
  await db.runTransaction(async (transaction) => {
    transaction.delete(db.collection("socialRelationships").doc(relationship.id));
    transaction.delete(db.collection("users").doc(actor.uid).collection("social").doc(String(otherPlayerId)));
    const otherUid = relationship.playerAId === otherPlayerId ? relationship.playerAUid : relationship.playerBUid;
    transaction.delete(db.collection("users").doc(otherUid).collection("social").doc(String(actor.chessCom.playerId)));
  });
  return { declined: true };
}

export async function cancelFriendRequest(actor: BoardSignalAccount, otherPlayerIdInput: unknown) {
  const otherPlayerId = numericPlayerId(otherPlayerIdInput);
  const relationship = await pendingRelationshipFor(actor, otherPlayerId);
  if (relationship.requestedByPlayerId !== actor.chessCom.playerId) throw Object.assign(new Error("Only the sender can cancel this request."), { status: 403 });
  const db = getAdminDb();
  const otherUid = relationship.playerAId === otherPlayerId ? relationship.playerAUid : relationship.playerBUid;
  await db.runTransaction(async (transaction) => {
    transaction.delete(db.collection("socialRelationships").doc(relationship.id));
    transaction.delete(db.collection("users").doc(actor.uid).collection("social").doc(String(otherPlayerId)));
    transaction.delete(db.collection("users").doc(otherUid).collection("social").doc(String(actor.chessCom.playerId)));
  });
  return { cancelled: true };
}

export async function unfriend(actor: BoardSignalAccount, otherPlayerIdInput: unknown) {
  const otherPlayerId = numericPlayerId(otherPlayerIdInput);
  const id = canonicalSocialRelationshipId(actor.chessCom.playerId, otherPlayerId);
  const db = getAdminDb();
  const ref = db.collection("socialRelationships").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.status !== "friends") throw Object.assign(new Error("That friendship is not active."), { status: 404 });
  const relationship = snapshot.data() as SocialRelationshipRecord;
  const otherUid = relationship.playerAId === otherPlayerId ? relationship.playerAUid : relationship.playerBUid;
  await db.runTransaction(async (transaction) => {
    transaction.delete(ref);
    transaction.delete(db.collection("users").doc(actor.uid).collection("social").doc(String(otherPlayerId)));
    transaction.delete(db.collection("users").doc(otherUid).collection("social").doc(String(actor.chessCom.playerId)));
  });
  return { unfriended: true };
}

export async function blockPlayer(actor: BoardSignalAccount, otherPlayerIdInput: unknown) {
  const otherPlayerId = numericPlayerId(otherPlayerIdInput);
  if (otherPlayerId === actor.chessCom.playerId) throw Object.assign(new Error("You cannot block yourself."), { status: 400 });
  const other = await accountByPlayerId(otherPlayerId);
  const relationshipId = canonicalSocialRelationshipId(actor.chessCom.playerId, otherPlayerId);
  const db = getAdminDb();
  const blockRef = db.collection("socialBlocks").doc(socialBlockId(actor.chessCom.playerId, otherPlayerId));
  const timestamp = nowIso();
  await db.runTransaction(async (transaction) => {
    transaction.set(blockRef, clean({ blockerPlayerId: actor.chessCom.playerId, blockedPlayerId: otherPlayerId, createdAt: timestamp }));
    transaction.delete(db.collection("socialRelationships").doc(relationshipId));
    transaction.delete(db.collection("users").doc(actor.uid).collection("social").doc(String(otherPlayerId)));
    transaction.delete(db.collection("users").doc(other.uid).collection("social").doc(String(actor.chessCom.playerId)));
    transaction.set(db.collection("users").doc(actor.uid).collection("social").doc(String(otherPlayerId)), clean({
      otherPlayerId,
      canonicalUsername: other.chessCom.canonicalUsername,
      avatar: other.chessCom.avatar,
      status: "blocked",
      updatedAt: timestamp,
    } satisfies SocialProjection));
  });
  return { blocked: true };
}

export async function setRivalPin(actor: BoardSignalAccount, otherPlayerIdInput: unknown, pinned: boolean) {
  const otherPlayerId = numericPlayerId(otherPlayerIdInput);
  const id = canonicalSocialRelationshipId(actor.chessCom.playerId, otherPlayerId);
  const relationship = await getAdminDb().collection("socialRelationships").doc(id).get();
  if (!relationship.exists || relationship.data()?.status !== "friends") throw Object.assign(new Error("Rival Watch can only pin an accepted friend."), { status: 403 });
  await getAdminDb().collection("users").doc(actor.uid).collection("social").doc(String(otherPlayerId)).set({ rivalPinned: pinned, updatedAt: nowIso() }, { merge: true });
  return { pinned };
}

function safeStandingLabel(standing: ReturnType<typeof standingsFromActiveBoards>[number] | undefined) {
  return standing ? `#${standing.rank} ${standing.categoryTitle}${standing.scopeLabel ? ` · ${standing.scopeLabel}` : ""}` : undefined;
}

async function safePlayerCard(account: BoardSignalAccount, relationship?: SocialProjection, state?: Awaited<ReturnType<typeof loadActiveUniverseState>>): Promise<SocialPlayerCard> {
  const desks = await loadPublishedDesks(account.uid);
  const latest = desks[0];
  const publicMoments = await getAdminDb().collection("publicShareMoments").where("playerId", "==", String(account.chessCom.playerId)).limit(8).get().catch(() => ({ docs: [] }));
  const safeHighlight = publicMoments.docs
    .map((document) => document.data() as { safePublic?: boolean; supportingFact?: string; periodEnd?: string })
    .filter((moment) => moment.safePublic === true && moment.supportingFact)
    .sort((a, b) => String(b.periodEnd ?? "").localeCompare(String(a.periodEnd ?? "")))[0]?.supportingFact;
  const participant = latest?.desk ? deskToUniverseParticipant(latest.desk) : undefined;
  const standings = participant && state ? standingsFromActiveBoards(state.boards, participant.id) : [];
  const best = [...standings].sort((a, b) => a.rank - b.rank || a.categoryTitle.localeCompare(b.categoryTitle))[0];
  return {
    playerId: account.chessCom.playerId,
    canonicalUsername: account.chessCom.canonicalUsername,
    avatar: account.chessCom.avatar,
    profileUrl: account.chessCom.profileUrl,
    relationshipStatus: relationship?.status === "blocked" ? undefined : relationship?.status,
    latestDeskPeriod: latest?.summary.periodLabel,
    primaryPool: latest?.desk.primaryPool,
    safeHighlight,
    universePlacement: safeStandingLabel(best),
    rivalPinned: relationship?.rivalPinned === true,
  };
}

async function ownerProjections(actor: BoardSignalAccount) {
  const snapshot = await getAdminDb().collection("users").doc(actor.uid).collection("social").get();
  return snapshot.docs.map((document) => document.data() as SocialProjection);
}

export async function searchSocialPlayers(actor: BoardSignalAccount, queryInput: unknown) {
  const query = String(queryInput ?? "").trim().toLowerCase();
  if (query.length < 2) return [];
  const [users, projections, state] = await Promise.all([
    getAdminDb().collection("users").get(),
    ownerProjections(actor),
    loadActiveUniverseState().catch(() => undefined),
  ]);
  const projectionMap = new Map(projections.map((item) => [item.otherPlayerId, item]));
  const accounts = users.docs.map((document) => document.data() as BoardSignalAccount)
    .filter(activeSocialMember)
    .filter((account) => account.chessCom.playerId !== actor.chessCom.playerId)
    .filter((account) => account.chessCom.canonicalUsername.toLowerCase().includes(query))
    .slice(0, 12);
  const visible: BoardSignalAccount[] = [];
  for (const account of accounts) {
    if (await blocksEitherDirection(actor.chessCom.playerId, account.chessCom.playerId)) continue;
    visible.push(account);
  }
  return Promise.all(visible.map((account) => safePlayerCard(account, projectionMap.get(account.chessCom.playerId), state)));
}

function socialEventKey(event: { eventId: string }, viewerId: number) {
  return createHash("sha256").update(`${viewerId}:${event.eventId}`).digest("hex").slice(0, 32);
}

export async function socialOverview(actor: BoardSignalAccount) {
  const [projections, state] = await Promise.all([ownerProjections(actor), loadActiveUniverseState().catch(() => undefined)]);
  const visible = projections.filter((item) => item.status !== "blocked");
  const cards = await Promise.all(visible.map(async (item) => {
    const account = await accountByPlayerId(item.otherPlayerId).catch(() => undefined);
    return account ? safePlayerCard(account, item, state) : undefined;
  }));
  const byId = new Map(cards.filter((card): card is SocialPlayerCard => Boolean(card)).map((card) => [card.playerId, card]));
  const friends = visible.filter((item) => item.status === "friends").flatMap((item) => byId.get(item.otherPlayerId) ? [byId.get(item.otherPlayerId)!] : []);
  const incoming = visible.filter((item) => item.status === "incoming").flatMap((item) => byId.get(item.otherPlayerId) ? [byId.get(item.otherPlayerId)!] : []);
  const outgoing = visible.filter((item) => item.status === "outgoing").flatMap((item) => byId.get(item.otherPlayerId) ? [byId.get(item.otherPlayerId)!] : []);
  const friendIds = new Set(friends.map((item) => String(item.playerId)));
  const socialPulse = (state?.recentEvents ?? []).filter((event) => friendIds.has(event.playerId)).slice(0, 8).map((event) => ({
    id: socialEventKey(event, actor.chessCom.playerId),
    playerId: Number(event.playerId),
    eyebrow: "A FRIEND MOVED",
    headline: event.headline,
    supportingFact: event.supportingFact,
    publishedAt: event.publishedAt,
  }));

  const actorDesks = await loadPublishedDesks(actor.uid);
  const actorPrimaryPool = actorDesks[0]?.desk.primaryPool?.toLowerCase();
  const actorParticipant = actorDesks[0]?.desk ? deskToUniverseParticipant(actorDesks[0].desk) : undefined;
  const actorStandings = actorParticipant && state ? standingsFromActiveBoards(state.boards, actorParticipant.id) : [];
  const rivalWatch: Array<{ player: SocialPlayerCard; label: string; detail: string }> = [];
  for (const friend of friends) {
    const friendAccount = await accountByPlayerId(friend.playerId).catch(() => undefined);
    const friendDesks = friendAccount ? await loadPublishedDesks(friendAccount.uid) : [];
    const friendParticipant = friendDesks[0]?.desk ? deskToUniverseParticipant(friendDesks[0].desk) : undefined;
    const friendStandings = friendParticipant && state ? standingsFromActiveBoards(state.boards, friendParticipant.id) : [];
    let near: { label: string; detail: string; gap: number } | undefined;
    for (const standing of actorStandings) {
      const other = friendStandings.find((item) => item.categoryId === standing.categoryId && item.scopeLabel === standing.scopeLabel);
      if (!other) continue;
      if (!standing.scopeLabel && actorPrimaryPool && friend.primaryPool && actorPrimaryPool !== friend.primaryPool.toLowerCase()) continue;
      const rankGap = Math.abs(standing.rank - other.rank);
      if (!isMeaningfulRivalGap({ samePool: true, rankGap })) continue;
      const label = standing.rank < other.rank ? "YOU MOVED AHEAD" : standing.rank > other.rank ? "ONE PLACE AHEAD" : "RIVAL WATCH";
      const detail = `${standing.categoryTitle}${standing.scopeLabel ? ` · ${standing.scopeLabel}` : ""}: #${standing.rank} vs #${other.rank}.`;
      if (!near || rankGap < near.gap) near = { label, detail, gap: rankGap };
    }
    if (friend.rivalPinned || near) rivalWatch.push({ player: friend, label: friend.rivalPinned ? "RIVAL WATCH" : near!.label, detail: near?.detail ?? "Pinned for private Head-to-Head context." });
  }
  return { friends, incoming, outgoing, rivalWatch: rivalWatch.slice(0, 8), socialPulse };
}

export async function headToHead(actor: BoardSignalAccount, otherPlayerIdInput: unknown) {
  const otherPlayerId = numericPlayerId(otherPlayerIdInput);
  const id = canonicalSocialRelationshipId(actor.chessCom.playerId, otherPlayerId);
  const relationship = await getAdminDb().collection("socialRelationships").doc(id).get();
  if (!relationship.exists || relationship.data()?.status !== "friends") throw Object.assign(new Error("Head-to-Head is available after both players accept the friendship."), { status: 403 });
  if (await blocksEitherDirection(actor.chessCom.playerId, otherPlayerId)) throw Object.assign(new Error("This social comparison is unavailable."), { status: 403 });
  const other = await accountByPlayerId(otherPlayerId);
  const [leftBundles, rightBundles, state] = await Promise.all([loadPublishedDesks(actor.uid), loadPublishedDesks(other.uid), loadActiveUniverseState()]);
  const leftParticipant = leftBundles[0]?.desk ? deskToUniverseParticipant(leftBundles[0].desk) : undefined;
  const rightParticipant = rightBundles[0]?.desk ? deskToUniverseParticipant(rightBundles[0].desk) : undefined;
  return buildHeadToHeadPayload({
    left: { playerId: actor.chessCom.playerId, canonicalUsername: actor.chessCom.canonicalUsername, avatar: actor.chessCom.avatar },
    right: { playerId: other.chessCom.playerId, canonicalUsername: other.chessCom.canonicalUsername, avatar: other.chessCom.avatar },
    leftDesks: leftBundles.map((bundle) => bundle.summary),
    rightDesks: rightBundles.map((bundle) => bundle.summary),
    leftStandings: leftParticipant ? standingsFromActiveBoards(state.boards, leftParticipant.id) : [],
    rightStandings: rightParticipant ? standingsFromActiveBoards(state.boards, rightParticipant.id) : [],
    leftPublicGameLinks: actor.privacy.publicGameLinks,
    rightPublicGameLinks: other.privacy.publicGameLinks,
  });
}

export async function suggestedSocialPlayers(actor: BoardSignalAccount) {
  const [users, projections, state] = await Promise.all([getAdminDb().collection("users").get(), ownerProjections(actor), loadActiveUniverseState().catch(() => undefined)]);
  const excluded = new Set(projections.map((item) => item.otherPlayerId));
  const candidates = users.docs.map((document) => document.data() as BoardSignalAccount)
    .filter(activeSocialMember)
    .filter((account) => account.chessCom.playerId !== actor.chessCom.playerId && !excluded.has(account.chessCom.playerId))
    .slice(0, 10);
  const output: SocialPlayerCard[] = [];
  for (const account of candidates) {
    if (await blocksEitherDirection(actor.chessCom.playerId, account.chessCom.playerId)) continue;
    output.push(await safePlayerCard(account, undefined, state));
    if (output.length >= 4) break;
  }
  return output;
}
