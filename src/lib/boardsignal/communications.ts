import type { BoardSignalNotificationPreferences } from "./account";
import type { BoardSignalChatAttachment } from "./chatAttachments";
import type { BoardSignalNotificationEventType, CurrentEpisodeSummary } from "./memory";
import { boardSignalMessageLink } from "./delivery";

export type BoardSignalMessageType =
  | "desk_ready"
  | "episode_update"
  | "blue_reminder"
  | "universe_achievement"
  | "beta_update"
  | "feedback_request"
  | "friend_request"
  | "friend_accepted"
  | "custom";

export type BoardSignalSenderType = "system" | "founder" | "player";

export type BoardSignalInboxMessage = {
  id: string;
  userId: string;
  type: BoardSignalMessageType;
  title: string;
  body: string;
  link?: string;
  actionLabel?: string;
  createdAt: string;
  readAt?: string;
  senderType: BoardSignalSenderType;
  campaignId?: string;
  threadId?: string;
  allowReply: boolean;
  attachment?: BoardSignalChatAttachment;
};

export type BoardSignalConversationMessage = {
  id: string;
  userId: string;
  threadId: string;
  body: string;
  senderType: "founder" | "player";
  createdAt: string;
  campaignId?: string;
  attachment?: BoardSignalChatAttachment;
};

export type CommunicationAudienceKind = "one" | "selected" | "all_active_beta" | "segment";
export type CommunicationSegment =
  | "new_players"
  | "desk_ready"
  | "episode_forming"
  | "latest_desk_not_opened"
  | "blue_available"
  | "universe_top3"
  | "inactive_recently"
  | "pending_feedback";

export type CommunicationCampaignDraft = {
  audienceKind: CommunicationAudienceKind;
  userIds?: string[];
  segment?: CommunicationSegment;
  type: BoardSignalMessageType;
  title: string;
  body: string;
  link?: string;
  actionLabel?: string;
  allowReply: boolean;
  attachment?: BoardSignalChatAttachment;
  channels: {
    inApp: true;
    browserPush: boolean;
    externalContactManual: boolean;
    email: boolean;
  };
};

export type AutomationDeliveryState = {
  eventKey: string;
  eventType: BoardSignalNotificationEventType;
  episodeKey?: string;
  createdAt: string;
  pushSentAt?: string;
};

export type AutomationPolicyInput = {
  eventType: BoardSignalNotificationEventType;
  eventKey: string;
  episodeKey?: string;
  now: Date;
  previous: AutomationDeliveryState[];
};

export type AutomationPolicyDecision = {
  allowed: boolean;
  pushAllowed: boolean;
  reason?: "duplicate" | "episode_cap" | "push_24h_cap";
};

export const ORDINARY_EPISODE_EVENT_TYPES = new Set<BoardSignalNotificationEventType>([
  "episode_started",
  "episode_progress",
  "blue_reminder_available",
  "universe_achievement",
  "universe_top3",
  "inactive_episode",
]);

export function automatedEventKey(
  eventType: BoardSignalNotificationEventType,
  details: { deskKey?: string; episodeKey?: string; discriminator?: string },
) {
  return [eventType, details.deskKey ?? details.episodeKey ?? "global", details.discriminator ?? "default"].join(":");
}

export function evaluateAutomationPolicy(input: AutomationPolicyInput): AutomationPolicyDecision {
  if (input.previous.some((event) => event.eventKey === input.eventKey)) {
    return { allowed: false, pushAllowed: false, reason: "duplicate" };
  }

  const ordinaryInEpisode = input.episodeKey
    ? input.previous.filter((event) => event.episodeKey === input.episodeKey && ORDINARY_EPISODE_EVENT_TYPES.has(event.eventType)).length
    : 0;
  if (input.eventType !== "desk_ready" && input.episodeKey && ordinaryInEpisode >= 3) {
    return { allowed: false, pushAllowed: false, reason: "episode_cap" };
  }

  const dayAgo = input.now.getTime() - 24 * 60 * 60 * 1000;
  const hasRecentPush = input.previous.some((event) => event.pushSentAt && Date.parse(event.pushSentAt) > dayAgo);
  return {
    allowed: true,
    pushAllowed: !hasRecentPush,
    ...(hasRecentPush ? { reason: "push_24h_cap" as const } : {}),
  };
}

export function preferenceAllowsMessage(
  preferences: BoardSignalNotificationPreferences,
  type: BoardSignalMessageType,
) {
  switch (type) {
    case "desk_ready": return preferences.deskReady;
    case "episode_update": return preferences.episodeProgress;
    case "blue_reminder": return preferences.blueReminder;
    case "universe_achievement": return preferences.universeAchievement;
    case "friend_request":
    case "friend_accepted": return true;
    case "beta_update":
    case "feedback_request":
    case "custom": return preferences.founderUpdates;
  }
}

export function messageForAutomatedEvent(input: {
  eventType: BoardSignalNotificationEventType;
  currentEpisode?: CurrentEpisodeSummary;
  previousBlue?: { title: string; copy: string };
  universeAchievement?: string;
}): Pick<BoardSignalInboxMessage, "type" | "title" | "body" | "link" | "actionLabel" | "allowReply"> | undefined {
  if (input.eventType === "desk_ready") {
    return {
      type: "desk_ready",
      title: "Your new BoardSignal Review is ready",
      body: "Your chess week has a story. Your completed Review is waiting in My Player Room.",
      link: boardSignalMessageLink("desk_ready"),
      actionLabel: "Open my Review",
      allowReply: false,
    };
  }
  if ((input.eventType === "episode_started" || input.eventType === "episode_progress") && input.currentEpisode) {
    return {
      type: "episode_update",
      title: "Your next episode is forming",
      body: input.currentEpisode.games > 0
        ? `${input.currentEpisode.games} game${input.currentEpisode.games === 1 ? " is" : "s are"} already in. This is based on the latest available Chess.com data.`
        : "Your next seven-day episode is open. No games are recorded yet in the latest available Chess.com data.",
      link: boardSignalMessageLink("episode_update"),
      actionLabel: "See episode progress",
      allowReply: false,
    };
  }
  if (input.eventType === "inactive_episode" && input.currentEpisode) {
    return {
      type: "episode_update",
      title: "Your current BoardSignal episode is still open",
      body: "No games are recorded yet in the latest available Chess.com data. Your Player Room will keep the episode factual while it forms.",
      link: boardSignalMessageLink("episode_update"),
      actionLabel: "Open My Player Room",
      allowReply: false,
    };
  }
  if (input.eventType === "blue_reminder_available" && input.previousBlue) {
    return {
      type: "blue_reminder",
      title: "Carry this with you today",
      body: `${input.previousBlue.title} — ${input.previousBlue.copy}`,
      link: boardSignalMessageLink("blue_reminder"),
      actionLabel: "Open My Player Room",
      allowReply: false,
    };
  }
  if ((input.eventType === "universe_achievement" || input.eventType === "universe_top3") && input.universeAchievement) {
    return {
      type: "universe_achievement",
      title: "BoardSignal Universe update",
      body: input.universeAchievement,
      link: boardSignalMessageLink("universe_achievement"),
      actionLabel: "Open the Universe",
      allowReply: false,
    };
  }
  return undefined;
}
