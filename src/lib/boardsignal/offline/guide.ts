import { detectGuideIntent, guideCategoryForIntent, renderGuideFollowup, sanitizeGuideConversation, type GuideConversationTurn, type GuideProvenance, type GuideResponse } from "@/lib/boardsignal/guide";
import type { OfflinePlayerRoomSnapshot, OfflineSocialSnapshot } from "./types";

function savedAt(snapshot?: OfflinePlayerRoomSnapshot) {
  if (!snapshot) return "the last successful sync";
  try { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.lastSyncedAt)); }
  catch { return snapshot.lastSyncedAt; }
}

export function buildOfflineGuideResponse({ message, pathname, activeTab, snapshot, social, authenticated, recentConversation = [] }: {
  message: string;
  pathname: string;
  activeTab?: string;
  snapshot?: OfflinePlayerRoomSnapshot;
  social?: OfflineSocialSnapshot;
  authenticated: boolean;
  recentConversation?: GuideConversationTurn[];
}): GuideResponse {
  const safeHistory = sanitizeGuideConversation(recentConversation);
  const context = { authenticated, pathname, activeTab, recentConversation: safeHistory };
  const intent = detectGuideIntent(message, { pathname, activeTab }, safeHistory);
  const followup = renderGuideFollowup(intent, context, message, safeHistory);
  if (followup) {
    if (followup.provenance?.kind !== "offline_snapshot") followup.reply += " You're offline now, so I can't verify whether that source has changed since then.";
    return followup;
  }
  const actions: GuideResponse["actions"] = [];
  const timestamp = savedAt(snapshot);
  let provenance: GuideProvenance = snapshot
    ? { kind: "offline_snapshot", title: "Saved BoardSignal", timestamp: snapshot.lastSyncedAt }
    : { kind: "product_knowledge", title: "BoardSignal offline help" };
  let reply = "You're offline. I can explain BoardSignal and anything already saved on this device, but I can't check Chess.com or the BoardSignal server for newer information.";

  if (intent === "what_changed") {
    const pulse = snapshot?.pulse;
    const facts = [pulse?.sinceAway, ...(pulse?.boardMoved ?? []), ...(pulse?.proximity ?? [])].filter(Boolean).slice(0, 3);
    reply = facts.length
      ? `You're offline, so I can't check for anything newer. Your saved Pulse from ${timestamp} says: ${facts.map((item) => `${item!.title} ${item!.body}`).join(" · ")}`
      : `You're offline, so I can't check Chess.com for anything newer. There is no saved Pulse change to report beyond the snapshot from ${timestamp}.`;
    actions.push({ id: "saved-pulse", label: "Open saved Pulse", href: "/offline/player-room", kind: "navigate" });
  } else if (intent === "explain_desk" || intent === "explain_signal") {
    const desk = snapshot?.desks[0]?.desk;
    if (!desk) reply = "No completed Review is saved on this device yet. Reconnect and open My Player Room once to create the offline copy.";
    else if (intent === "explain_signal") {
      const lower = message.toLowerCase();
      const signal = lower.includes("amber") ? desk.signals.amber : lower.includes("red") ? desk.signals.red : lower.includes("green") ? desk.signals.green : desk.signals.blue;
      reply = `${signal.title}: ${signal.copy} This comes from your saved completed Review; I am not running new chess analysis offline.`;
    } else reply = `${desk.headline} ${desk.summary} This is your saved completed Review from ${desk.period.label}.`;
    actions.push({ id: "saved-desk", label: "Open saved Review", href: "/offline/player-room", kind: "navigate" });
  } else if (intent === "progress") {
    reply = snapshot?.desks.length ? `Your saved Progress contains ${snapshot.desks.length} active completed Review${snapshot.desks.length === 1 ? "" : "s"}. It was last synchronized ${timestamp}; it will not move again until BoardSignal reconnects.` : "No recent Progress snapshot is saved yet.";
    actions.push({ id: "saved-progress", label: "Open saved Progress", href: "/offline/player-room", kind: "navigate" });
  } else if (intent === "friends" || intent === "compare_friend" || intent === "friend_requests") {
    const count = social?.overview?.friends.length ?? 0;
    reply = social ? `Your saved social snapshot has ${count} friend${count === 1 ? "" : "s"}${social.comparisons.length ? ` and ${social.comparisons.length} saved Head-to-Head comparison${social.comparisons.length === 1 ? "" : "s"}` : ""}. It is read-only while offline.` : "No Friends snapshot is saved yet. Friend requests and relationship changes require a connection.";
    actions.push({ id: "saved-friends", label: "Open saved Friends", href: "/offline/player-room", kind: "navigate" });
  } else if (intent === "inbox" || intent === "message_founder" || intent === "support") {
    reply = authenticated ? "Inbox needs a connection. I can keep a local draft for Ayanda, but I will not pretend it was sent until you reconnect and choose Send." : "Account-specific support needs a connection and an authenticated BoardSignal account.";
    if (authenticated) actions.push({ id: "handoff", label: "Save message draft", kind: "handoff", requiresConfirmation: true });
  } else if (intent === "random_position") {
    reply = "I can explain analysis already saved inside your BoardSignal Review. I don't create new chess analysis from a random position, online or offline.";
    provenance = { kind: "product_knowledge", title: "BoardSignal analysis boundary" };
  } else if (intent === "privacy" || intent === "agreement") {
    reply = "Offline BoardSignal keeps your own bounded Player Room snapshot under your Firebase UID on this device. It does not store access codes, Firebase ID tokens, Admin data, full Inbox history, or another player's private Signals/evidence.";
    provenance = { kind: "product_knowledge", title: "BoardSignal privacy rules" };
  } else if (intent === "universe_what" || intent === "whats_hot" || intent === "explain_rank" || intent === "in_reach") {
    reply = snapshot?.pulse ? `Universe is time-sensitive. You're seeing only the safe snapshot saved at ${timestamp}; What's Hot and standings are not being presented as live.` : "Universe needs a connection for current movement. No safe Universe snapshot is saved yet.";
    actions.push({ id: "saved-universe", label: "Open saved Universe", href: "/offline/player-room", kind: "navigate" });
  } else if (intent === "notifications") {
    reply = "Notification and account-setting changes require a connection. Offline mode is read-only for those settings.";
  } else if (intent === "what_is_boardsignal" || intent === "how_it_works" || intent === "welcome" || intent === "unknown") {
    reply = "BoardSignal turns fixed seven-day Chess.com episodes into a private sports Review, recent-four Progress and a public-safe Universe. Offline mode lets you read the last saved copy without pretending anything new has happened.";
    actions.push({ id: "saved-room", label: "Open saved Player Room", href: "/offline/player-room", kind: "navigate" });
    provenance = { kind: "product_knowledge", title: "BoardSignal offline help" };
  }

  return {
    reply,
    chips: ["What can I use offline?", "What changed?", "What stays private?"],
    actions: actions.slice(0, 4),
    handoffAvailable: authenticated,
    contextReason: `Offline snapshot · ${timestamp}`,
    intent,
    category: guideCategoryForIntent(intent),
    provenance,
  };
}
