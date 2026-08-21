import "server-only";

import type { BoardSignalAccount } from "../account";
import { rankWhatsHot, type PublicUniverseEvent, type SafeShareMoment } from "../pulse";
import { getAdminDb } from "../../../utils/firebaseAdmin";
import { founderGuideSummary } from "./guide";
import { getFounderDeliveryStatus } from "./delivery";

export async function founderNewsroomSummary() {
  const db = getAdminDb();
  const [users, coverage, exceptions, universeEvents, shareMoments, askBoardSignal, deliveryStatus] = await Promise.all([
    db.collection("users").get(),
    db.collection("publicCoverage").orderBy("periodEnd", "desc").limit(8).get(),
    db.collection("exceptions").orderBy("createdAt", "desc").limit(8).get().catch(() => ({ docs: [] })),
    db.collection("publicUniverseEvents").orderBy("publishedAt", "desc").limit(40).get().catch(() => ({ docs: [] })),
    db.collection("publicShareMoments").orderBy("periodEnd", "desc").limit(12).get().catch(() => ({ docs: [] })),
    founderGuideSummary().catch(() => ({ usage: 0, topQuestionCategories: [], unresolvedSupportHandoffs: 0, recentFeedbackCount: 0, relationshipPulse: [] })),
    getFounderDeliveryStatus(),
  ]);
  const accounts = users.docs.map((document) => document.data() as BoardSignalAccount)
    .filter((account) => account.role === "player" && account.accessTier === "founding_beta" && account.accessStatus === "active");
  const latestCompletedDesks = (await Promise.all(accounts.map(async (account) => {
    const snapshot = await db.collection("users").doc(account.uid).collection("desks").orderBy("periodEnd", "desc").limit(1).get();
    const data = snapshot.docs[0]?.data() as { deskKey?: string; summary?: { periodLabel?: string; periodEnd?: string }; periodEnd?: string; publishedAt?: string } | undefined;
    return data ? { username: account.chessCom.canonicalUsername, deskKey: data.deskKey, periodLabel: data.summary?.periodLabel, periodEnd: data.summary?.periodEnd ?? data.periodEnd, publishedAt: data.publishedAt } : undefined;
  }))).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => String(b.periodEnd ?? "").localeCompare(String(a.periodEnd ?? ""))).slice(0, 8);
  const events = universeEvents.docs.map((document) => document.data() as PublicUniverseEvent).filter((event) => event.safePublic === true);
  return {
    deliveryStatus,
    askBoardSignal,
    latestUniverseAchievements: coverage.docs.map((document) => ({ id: document.id, ...document.data() })),
    latestCompletedDesks,
    recentExceptions: exceptions.docs.map((document) => ({ id: document.id, ...document.data() })),
    newPlayers: events.filter((event) => event.eventType === "new_player").slice(0, 8),
    newTop3: events.filter((event) => ["new_leader", "entered_top3", "podium_move"].includes(event.eventType)).slice(0, 8),
    whatsHot: rankWhatsHot(events).slice(0, 8),
    recentShareMoments: shareMoments.docs.map((document) => ({ ...(document.data() as SafeShareMoment), id: document.id })).slice(0, 8),
    recentUniverseMovement: events.slice(0, 10),
  };
}
