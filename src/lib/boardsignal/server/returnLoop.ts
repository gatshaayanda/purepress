import "server-only";

import { createHash } from "node:crypto";
import type { BoardSignalAccount } from "../account";
import {
  automatedEventKey,
  evaluateAutomationPolicy,
  messageForAutomatedEvent,
  type AutomationDeliveryState,
} from "../communications";
import type { BoardSignalNotificationEventType, CurrentEpisodeSummary } from "../memory";
import type { BoardSignalDesk } from "../types";
import { deskParticipantId, standingsFromActiveBoards } from "../pulse";
import { buildCurrentEpisodeSummary } from "../processor";
import { getAdminDb } from "../../../utils/firebaseAdmin";
import { sendAutomatedPlayerMessage } from "./communications";
import { loadActiveUniverseState } from "./universePulse";

function clean<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function eventDocumentId(eventKey: string) { return createHash("sha256").update(eventKey).digest("hex"); }

async function previousEvents(uid: string): Promise<AutomationDeliveryState[]> {
  const snapshot = await getAdminDb().collection("users").doc(uid).collection("automationEvents").orderBy("createdAt", "desc").limit(100).get();
  return snapshot.docs.map((document) => document.data() as AutomationDeliveryState);
}

async function latestDesk(uid: string) {
  const snapshot = await getAdminDb().collection("users").doc(uid).collection("desks").orderBy("periodEnd", "desc").limit(1).get();
  const data = snapshot.docs[0]?.data() as { deskKey?: string; desk?: BoardSignalDesk; periodEnd?: string; publishedAt?: string } | undefined;
  return data?.desk && data.deskKey ? { desk: data.desk, deskKey: data.deskKey, publishedAt: data.publishedAt } : undefined;
}

async function latestCoverage(playerId: number) {
  const snapshot = await getAdminDb().collection("publicCoverage").where("chessPlayerId", "==", String(playerId)).get();
  const items = snapshot.docs.map((document) => ({ id: document.id, ...document.data() as { periodEnd?: string; headline?: string } }));
  return items.sort((a, b) => String(b.periodEnd ?? "").localeCompare(String(a.periodEnd ?? "")))[0];
}

type Candidate = {
  eventType: BoardSignalNotificationEventType;
  eventKey: string;
  episodeKey?: string;
  currentEpisode?: CurrentEpisodeSummary;
  universeAchievement?: string;
};

async function eventCandidates(account: BoardSignalAccount, currentEpisode: CurrentEpisodeSummary | undefined): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const latest = await latestDesk(account.uid);
  const episodeKey = currentEpisode ? `${currentEpisode.periodStart}:${currentEpisode.periodEnd}` : undefined;

  if (latest) {
    const deskIsUnopened = Boolean(latest.publishedAt && (!account.lastSeenAt || account.lastSeenAt < latest.publishedAt));
    if (deskIsUnopened) {
      candidates.push({
        eventType: "desk_ready",
        eventKey: automatedEventKey("desk_ready", { deskKey: latest.deskKey }),
      });
    }

    const universeState = await loadActiveUniverseState();
    const participantId = deskParticipantId(latest.desk);
    const standings = participantId ? standingsFromActiveBoards(universeState.boards, participantId) : [];
    const top = standings.filter((standing) => standing.rank <= 3).sort((a, b) => a.rank - b.rank)[0];
    const recentPlayerEvent = universeState.recentEvents.find((event) => event.playerId === String(account.chessCom.playerId) && ["new_leader", "entered_top3", "podium_move", "rank_move"].includes(event.eventType));
    if (top && recentPlayerEvent) {
      candidates.push({
        eventType: "universe_top3",
        eventKey: automatedEventKey("universe_top3", { deskKey: latest.deskKey, discriminator: recentPlayerEvent.eventId }),
        episodeKey,
        universeAchievement: recentPlayerEvent.headline,
      });
    } else {
      const coverage = await latestCoverage(account.chessCom.playerId);
      if (coverage?.headline) {
        candidates.push({
          eventType: "universe_achievement",
          eventKey: automatedEventKey("universe_achievement", { deskKey: latest.deskKey, discriminator: coverage.id }),
          episodeKey,
          universeAchievement: coverage.headline,
        });
      }
    }
  }

  if (currentEpisode) {
    if (currentEpisode.games === 0 && currentEpisode.daysComplete >= 5) {
      candidates.push({
        eventType: "inactive_episode",
        eventKey: automatedEventKey("inactive_episode", { episodeKey, discriminator: "day5" }),
        episodeKey,
        currentEpisode,
      });
    } else if ([1, 3, 5].includes(currentEpisode.daysComplete)) {
      const eventType: BoardSignalNotificationEventType = currentEpisode.daysComplete <= 1 ? "episode_started" : "episode_progress";
      candidates.push({
        eventType,
        eventKey: automatedEventKey(eventType, { episodeKey, discriminator: `day${currentEpisode.daysComplete}:games${currentEpisode.games}` }),
        episodeKey,
        currentEpisode,
      });
    }
    if (account.previousBlue?.title && currentEpisode.games > 0 && currentEpisode.daysComplete >= 3) {
      candidates.push({
        eventType: "blue_reminder_available",
        eventKey: automatedEventKey("blue_reminder_available", { episodeKey, discriminator: latest?.deskKey ?? "previous-blue" }),
        episodeKey,
        currentEpisode,
      });
    }
  }

  return candidates;
}

function priority(type: BoardSignalNotificationEventType) {
  const order: BoardSignalNotificationEventType[] = ["desk_ready", "universe_top3", "universe_achievement", "episode_started", "episode_progress", "blue_reminder_available", "inactive_episode", "amber_watch_available"];
  return order.indexOf(type);
}

async function processPlayer(account: BoardSignalAccount, now: Date) {
  let currentEpisode: CurrentEpisodeSummary | undefined;
  try {
    currentEpisode = await buildCurrentEpisodeSummary(account.chessCom.canonicalUsername, { anchorStart: account.cadenceAnchor });
    await getAdminDb().collection("users").doc(account.uid).set(clean({
      currentEpisodeSummary: currentEpisode,
      latestProgressCheckedAt: currentEpisode.checkedAt,
      nextDeskDueAt: currentEpisode.nextDeskDueAt,
    }), { merge: true });
  } catch (error) {
    const id = eventDocumentId(`${account.uid}:${now.toISOString().slice(0, 10)}:progress-refresh`);
    await getAdminDb().collection("exceptions").doc(id).set(clean({
      type: "return_loop_refresh",
      uid: account.uid,
      username: account.chessCom.canonicalUsername,
      title: "Return-loop Chess.com refresh unavailable",
      message: error instanceof Error ? error.message : "Current episode refresh failed.",
      createdAt: now.toISOString(),
    }), { merge: true });
  }

  const previous = await previousEvents(account.uid);
  const candidates = (await eventCandidates(account, currentEpisode)).sort((a, b) => priority(a.eventType) - priority(b.eventType));
  for (const candidate of candidates) {
    const policy = evaluateAutomationPolicy({
      eventType: candidate.eventType,
      eventKey: candidate.eventKey,
      episodeKey: candidate.episodeKey,
      now,
      previous,
    });
    if (!policy.allowed) continue;
    const message = messageForAutomatedEvent({
      eventType: candidate.eventType,
      currentEpisode: candidate.currentEpisode,
      previousBlue: account.previousBlue,
      universeAchievement: candidate.universeAchievement,
    });
    if (!message) continue;
    const delivery = await sendAutomatedPlayerMessage(account, message, candidate.eventKey, policy.pushAllowed);
    if (!delivery.sent) continue;
    const event: AutomationDeliveryState = {
      eventKey: candidate.eventKey,
      eventType: candidate.eventType,
      episodeKey: candidate.episodeKey,
      createdAt: now.toISOString(),
      pushSentAt: delivery.pushDelivered > 0 ? now.toISOString() : undefined,
    };
    await getAdminDb().collection("users").doc(account.uid).collection("automationEvents").doc(eventDocumentId(candidate.eventKey)).set(clean(event));
    return { uid: account.uid, username: account.chessCom.canonicalUsername, eventType: candidate.eventType, delivered: true, pushDelivered: delivery.pushDelivered, pushFailed: delivery.pushFailed };
  }
  return { uid: account.uid, username: account.chessCom.canonicalUsername, delivered: false };
}

export async function runBoardSignalReturnLoop(now = new Date()) {
  const users = await getAdminDb().collection("users").get();
  const accounts = users.docs.map((document) => document.data() as BoardSignalAccount)
    .filter((account) => account.role === "player" && account.accessTier === "founding_beta" && account.accessStatus === "active")
    .sort((a, b) => a.uid.localeCompare(b.uid));
  const results: Array<Record<string, unknown>> = [];
  const BATCH_SIZE = 25;
  for (let offset = 0; offset < accounts.length; offset += BATCH_SIZE) {
    const batch = accounts.slice(offset, offset + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((account) => processPlayer(account, now).catch((error) => ({
      uid: account.uid,
      username: account.chessCom.canonicalUsername,
      delivered: false,
      error: error instanceof Error ? error.message : "Return-loop processing failed.",
    }))));
    results.push(...batchResults);
  }
  return { processed: accounts.length, delivered: results.filter((result) => result.delivered).length, results };
}
