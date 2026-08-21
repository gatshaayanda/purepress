import type { HeadToHeadPayload, SocialPlayerCard } from "./social";

export type GuideDeliveryStatus = { inApp: true; browserPushConfigured: boolean; emailConfigured: boolean; emailProvider: "resend" | "none" };

export type GuideTone = "Balanced" | "Direct" | "Analytical" | "Sports Desk" | "Encouraging";
export type GuideDetailLevel = "Short" | "Standard" | "Detailed";

export type GuideNotificationPreferences = {
  email: boolean;
  browserPush: boolean;
  deskReady: boolean;
  episodeProgress: boolean;
  blueReminder: boolean;
  amberWatch: boolean;
  universeAchievement: boolean;
  founderUpdates: boolean;
};

export type GuidePreferences = {
  preferredTone: GuideTone;
  preferredDetailLevel: GuideDetailLevel;
  preferredAddress?: string;
  likesSportsFraming: boolean;
  likesDirectAnswers: boolean;
  likesComparisons: boolean;
  likesProgressContext: boolean;
  lastExplicitToneFeedback?: string;
  updatedAt?: string;
};

export type GuideConversationMemory = {
  recentTopics: string[];
  unresolvedQuestion?: string;
  lastMeaningfulAction?: string;
  recentSupportIssue?: string;
  recentSentiment?: "positive" | "neutral" | "frustrated" | "confused" | "excited";
  recentSentimentAt?: string;
  productSignals: string[];
  updatedAt?: string;
};

export type GuidePulseFact = { eyebrow: string; title: string; body: string; facts?: string[] };
export type GuideStanding = { categoryTitle: string; scopeLabel?: string; rank: number; denominator: number; valueLabel: string };
export type GuideDesk = {
  periodLabel: string;
  headline: string;
  summary: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  primaryPool: string;
  blue?: { title: string; copy: string };
  amber?: { title: string; copy: string };
  red?: { title: string; copy: string };
};

export type GuidePreviewContext = {
  canonicalUsername: string; playableWeek: boolean; periodLabel?: string; disclosure?: string; games: number; wins: number; draws: number; losses: number; score: number; primaryPool?: string; primaryPoolDelta?: number; strongestWinRun?: number; safeHeadline: string; safeHighlight: string; universePreview?: Array<{ categoryTitle: string; scopeLabel?: string; rank: number; denominator: number; valueLabel: string; nearestAbove?: { player: string; valueLabel: string } }>; generatedAt: string;
  activationReturnMethod?: "device" | "email" | "discord" | "telegram" | "return_here";
  deviceAlertsEnabled?: boolean;
};

export type GuideContext = {
  authenticated: boolean;
  mode?: "beta_preview";
  previewContext?: GuidePreviewContext;
  pathname: string;
  activeTab?: string;
  canonicalUsername?: string;
  currentEpisode?: { status?: string; games: number; wins: number; draws: number; losses: number; daysCompleted?: number; daysRemaining?: number; checkedAt?: string };
  latestDesk?: GuideDesk;
  recentDeskLabels?: string[];
  pulseFacts?: GuidePulseFact[];
  standings?: GuideStanding[];
  shareMoments?: Array<{ id: string; headline: string; supportingFact: string; statValue: string; statLabel: string }>;
  friends?: SocialPlayerCard[];
  incomingRequests?: SocialPlayerCard[];
  outgoingRequests?: SocialPlayerCard[];
  rivalWatch?: Array<{ player: SocialPlayerCard; label: string; detail: string }>;
  comparison?: HeadToHeadPayload;
  unreadInboxCount?: number;
  latestAnnouncement?: { id?: string; title: string; body: string; link?: string; actionLabel?: string; createdAt?: string };
  notificationPreferences?: GuideNotificationPreferences;
  deliveryStatus?: GuideDeliveryStatus;
  emailAccountReady?: boolean;
  preferences?: GuidePreferences;
  tourState?: "unseen" | "completed" | "dismissed";
  releaseHintDismissed?: boolean;
  recentConversation?: GuideConversationTurn[];
  contextUpdatedAt?: string;
};

export type GuideAction = {
  id: string;
  label: string;
  href?: string;
  kind?: "navigate" | "handoff" | "preference" | "tour" | "feedback";
  requiresConfirmation?: boolean;
  payload?: Record<string, string | boolean>;
};

export type GuideResponse = {
  reply: string;
  chips: string[];
  actions: GuideAction[];
  handoffAvailable: boolean;
  contextReason?: string;
  intent: GuideIntent;
  category?: GuideQuestionCategory;
  provenance?: GuideProvenance;
};

export type GuideProvenanceKind =
  | "founder_announcement"
  | "desk"
  | "pulse"
  | "universe"
  | "friends"
  | "head_to_head"
  | "inbox"
  | "profile"
  | "product_knowledge"
  | "offline_snapshot";

export type GuideProvenance = {
  kind: GuideProvenanceKind;
  title?: string;
  id?: string;
  timestamp?: string;
};

export type GuideConversationAction = {
  id: string;
  label: string;
  href?: string;
  kind?: GuideAction["kind"];
};

export type GuideConversationTurn = {
  role: "player" | "guide";
  body: string;
  intent?: GuideIntent;
  provenance?: GuideProvenance;
  actions?: GuideConversationAction[];
};

export type GuideQuestionCategory =
  | "privacy_question" | "universe_question" | "ranking_confusion" | "signal_explanation" | "desk_missing"
  | "login_help" | "share_help" | "friend_help" | "notification_help" | "feature_request" | "support_request" | "general";

export type GuideIntent =
  | "welcome" | "what_is_boardsignal" | "how_it_works" | "privacy" | "agreement" | "beta_next" | "beta_cost" | "sign_in" | "username_reason"
  | "universe_what" | "universe_included" | "what_changed" | "explain_desk" | "explain_signal" | "progress" | "explain_rank"
  | "in_reach" | "whats_hot" | "friends" | "friend_requests" | "compare_friend" | "inbox" | "message_founder"
  | "notifications" | "whats_new" | "share" | "tour" | "tone" | "random_position" | "support"
  | "followup_why" | "followup_explain" | "followup_source" | "followup_meaning" | "followup_reference" | "followup_clarify"
  | "unknown";

export const GUIDE_INTENTS: readonly GuideIntent[] = [
  "welcome", "what_is_boardsignal", "how_it_works", "privacy", "agreement", "beta_next", "beta_cost", "sign_in", "username_reason",
  "universe_what", "universe_included", "what_changed", "explain_desk", "explain_signal", "progress", "explain_rank", "in_reach", "whats_hot",
  "friends", "friend_requests", "compare_friend", "inbox", "message_founder", "notifications", "whats_new", "share", "tour", "tone", "random_position",
  "support", "followup_why", "followup_explain", "followup_source", "followup_meaning", "followup_reference", "followup_clarify", "unknown",
];

export const GUIDE_PROVENANCE_KINDS: readonly GuideProvenanceKind[] = [
  "founder_announcement", "desk", "pulse", "universe", "friends", "head_to_head", "inbox", "profile", "product_knowledge", "offline_snapshot",
];

const GUIDE_INTENT_SET = new Set<string>(GUIDE_INTENTS);
const GUIDE_PROVENANCE_SET = new Set<string>(GUIDE_PROVENANCE_KINDS);
const GUIDE_ACTION_KIND_SET = new Set<string>(["navigate", "handoff", "preference", "tour", "feedback"]);
const MAX_GUIDE_CONVERSATION_TURNS = 12;
const MAX_GUIDE_TURN_CHARS = 1200;

function safeConversationText(value: unknown, max = MAX_GUIDE_TURN_CHARS) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeGuideProvenance(value: unknown): GuideProvenance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const kind = typeof source.kind === "string" && GUIDE_PROVENANCE_SET.has(source.kind) ? source.kind as GuideProvenanceKind : undefined;
  if (!kind) return undefined;
  const title = safeConversationText(source.title, 180) || undefined;
  const id = safeConversationText(source.id, 220) || undefined;
  const timestamp = safeConversationText(source.timestamp, 80) || undefined;
  return { kind, ...(title ? { title } : {}), ...(id ? { id } : {}), ...(timestamp ? { timestamp } : {}) };
}

export function sanitizeGuideConversation(value: unknown): GuideConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_GUIDE_CONVERSATION_TURNS).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const source = entry as Record<string, unknown>;
    const role = source.role === "player" || source.role === "guide" ? source.role : undefined;
    const body = safeConversationText(source.body);
    if (!role || !body) return [];
    const intent = typeof source.intent === "string" && GUIDE_INTENT_SET.has(source.intent) ? source.intent as GuideIntent : undefined;
    const provenance = sanitizeGuideProvenance(source.provenance);
    const actions = Array.isArray(source.actions) ? source.actions.slice(0, 3).flatMap((action) => {
      if (!action || typeof action !== "object") return [];
      const item = action as Record<string, unknown>;
      const id = safeConversationText(item.id, 120);
      const label = safeConversationText(item.label, 120);
      if (!id || !label) return [];
      const href = safeConversationText(item.href, 300) || undefined;
      const kind = typeof item.kind === "string" && GUIDE_ACTION_KIND_SET.has(item.kind) ? item.kind as GuideAction["kind"] : undefined;
      return [{ id, label, ...(href ? { href } : {}), ...(kind ? { kind } : {}) }];
    }) : undefined;
    return [{ role, body, ...(intent ? { intent } : {}), ...(provenance ? { provenance } : {}), ...(actions?.length ? { actions } : {}) }];
  });
}

export const DEFAULT_GUIDE_PREFERENCES: GuidePreferences = {
  preferredTone: "Balanced",
  preferredDetailLevel: "Standard",
  likesSportsFraming: true,
  likesDirectAnswers: true,
  likesComparisons: true,
  likesProgressContext: true,
};

const DIAGNOSIS_FIELDS = ["depressed", "anxious", "neurotic", "addicted", "vulnerable", "lowSelfEsteem", "impulsivePersonality", "personalityDisorder", "mentalHealthDiagnosis", "psychologicalSusceptibility", "manipulationScore"] as const;
export function forbiddenGuideProfileFields() { return [...DIAGNOSIS_FIELDS]; }

function lower(value: string) { return value.trim().toLowerCase(); }
function has(value: string, ...parts: string[]) { const v = lower(value); return parts.some((part) => v.includes(part)); }

export function guideCategoryForIntent(intent: GuideIntent): GuideQuestionCategory {
  if (intent === "privacy" || intent === "universe_included") return "privacy_question";
  if (["explain_rank", "in_reach", "whats_hot", "what_changed"].includes(intent)) return intent === "explain_rank" ? "ranking_confusion" : "universe_question";
  if (intent === "explain_signal") return "signal_explanation";
  if (["friends", "friend_requests", "compare_friend"].includes(intent)) return "friend_help";
  if (intent === "notifications") return "notification_help";
  if (intent === "share") return "share_help";
  if (["message_founder", "support"].includes(intent)) return "support_request";
  return "general";
}

export function isGuideWhatsNewMessage(message: { senderType?: string; type?: string }) {
  return message.senderType === "founder" && message.type === "beta_update";
}

function latestGuideTurn(recentConversation: GuideConversationTurn[]) {
  return [...recentConversation].reverse().find((turn) => turn.role === "guide");
}

function hasRecentGuideTurn(recentConversation: GuideConversationTurn[]) {
  return Boolean(latestGuideTurn(recentConversation));
}

export function detectGuideIntent(message: string, context: Pick<GuideContext, "pathname" | "activeTab" | "mode">, recentConversation: GuideConversationTurn[] = []): GuideIntent {
  const text = lower(message);
  if (context.mode === "beta_preview") {
    if (has(text, "what did you find", "show me my week", "my week")) return "explain_desk";
    if (has(text, "where would i be", "universe preview", "explain my universe")) return "explain_rank";
    if (has(text, "what unlocks next", "when i'm approved", "when approved", "am i approved", "do i need to wait", "can i use this now", "what happens when", "how do i come back", "where is my access link")) return "beta_next";
    if (has(text, "do i need email", "email wrong", "wrong email", "how will i know", "notify this phone", "notify this device", "device alert")) return "notifications";
    if (has(text, "can i add friends", "add friends", "head-to-head", "rival watch")) return "friends";
  }
  if (!text) return "welcome";
  if ((has(text, "best move", "what move", "random position", "fen ") || /^[rnbqkp1-8\/]+\s[wb]\s/.test(text)) && has(text, "move", "position", "fen")) return "random_position";
  if (has(text, "what do you mean by in reach", "what does in reach mean")) return "in_reach";
  const hasGuideContext = hasRecentGuideTurn(recentConversation);
  if (hasGuideContext && (has(text, "where did that come from", "where did it come from", "how do you know", "what's your source", "whats your source", "source for that"))) return "followup_source";
  if (hasGuideContext && (has(text, "why did you say") || /^why[?!.]*$/i.test(text))) return "followup_why";
  if (hasGuideContext && has(text, "that was just a test", "that was a test message", "that message was just a test")) return "followup_clarify";
  if (hasGuideContext && has(text, "who were you talking about", "who are you talking about", "who is he", "who is she", "who are they", "why did you mention him", "why did you mention her", "why did you mention them", "what was the update you just mentioned", "go back to what you said", "open that again", "take me back there", "where did that message go", "what did i just change", "i sent that")) return "followup_reference";
  if (hasGuideContext && has(text, "explain that", "explain it", "explain the last part", "can you explain that", "can you explain it")) return "followup_explain";
  if (hasGuideContext && has(text, "what did you mean", "what do you mean by that", "what does that mean", "what do you mean", "does that mean")) return "followup_meaning";
  if (hasGuideContext && /^(that|it|him|her|them)[?!.]*$/i.test(text)) return "followup_clarify";
  if (has(text, "message ayanda", "talk to ayanda", "founder", "human", "support person")) return "message_founder";
  if (has(text, "not working", "broken", "incorrect data", "wrong data", "privacy issue", "help me", "support")) return "support";
  if (has(text, "what changed", "since i was away", "since my last", "what's changed", "whats changed")) return "what_changed";
  if (context.activeTab === "agreement" && has(text, "explain this simply", "explain the agreement", "what am i agreeing")) return "agreement";
  if (has(text, "what is boardsignal", "what's boardsignal", "whats boardsignal")) return "what_is_boardsignal";
  if (has(text, "how does it work", "how it works", "install boardsignal", "how do i install", "use boardsignal offline", "can i use boardsignal offline", "offline mode")) return "how_it_works";
  if (has(text, "how much", "beta cost", "cost of beta", "beta price", "pay for beta")) return "beta_cost";
  if (has(text, "where do i sign in", "how do i sign in", "sign in", "log in")) return "sign_in";
  if (has(text, "what is universe", "what's universe", "whats universe", "what is the universe", "why am i here")) return "universe_what";
  if (has(text, "what stays private", "what is private", "what's private", "privacy", "public")) return "privacy";
  if (has(text, "why do you need my username", "why username")) return "username_reason";
  if (has(text, "what happens next", "after request", "beta request", "request access", "get my boardsignal", "am i approved", "do i need to wait", "can i use this now")) return "beta_next";
  if (has(text, "why is universe included", "universe included")) return "universe_included";
  if (has(text, "explain this desk", "explain my desk", "week's story", "weeks story", "headline")) return "explain_desk";
  if (has(text, "amber", "blue", "red signal", "my signal", "signals")) return "explain_signal";
  if (has(text, "compare my recent desks", "am i improving", "progress", "repeated")) return "progress";
  if (has(text, "why am i #", "why am i number", "why is my rank", "explain rank", "why #")) return "explain_rank";
  if (has(text, "in reach", "closest ahead", "who is ahead", "closing the gap", "who passed me")) return "in_reach";
  if (has(text, "what's hot", "whats hot", "who just joined")) return "whats_hot";
  if (has(text, "show my requests", "friend requests", "requests")) return "friend_requests";
  if (has(text, "compare with", "compare me", "who has the edge", "where are we closest", "head to head", "head-to-head")) return "compare_friend";
  if (has(text, "who is closest to me", "which friend", "friends", "rival")) return "friends";
  if (has(text, "unread", "inbox")) return "inbox";
  if (has(text, "notification", "alerts", "reminder", "email me", "email alerts", "browser push", "number on my boardsignal icon", "number on the icon", "app badge", "badge")) return "notifications";
  if (has(text, "what's new", "whats new", "new feature", "update")) return "whats_new";
  if (has(text, "share moment", "share my", "strongest moment", "best moment")) return "share";
  if (has(text, "tour", "show me around")) return "tour";
  if (has(text, "where should i look first", "where do i start")) return "how_it_works";
  if (has(text, "tone", "short answers", "direct answers", "analytical", "sports desk", "encouraging")) return "tone";
  if (context.activeTab === "friends" || context.pathname.includes("friends")) return "friends";
  if (context.activeTab === "universe" || context.pathname.includes("feed")) return "unknown";
  return "unknown";
}

export function pageGuideSuggestions(pathname: string, activeTab?: string, authenticated = false) {
  if (!authenticated) {
    if (activeTab === "beta-request" || pathname.includes("join")) return ["What happens next?", "Why do you need my username?", "What becomes public?"];
    if (pathname.includes("boardsignal") && !pathname.includes("player-room")) return ["What happens next?", "Why do you need my username?", "What stays private?"];
    return ["What is BoardSignal?", "How does it work?", "What stays private?", "Get my BoardSignal"];
  }
  if (activeTab === "agreement") return ["Explain this simply", "What stays private?", "Why is Universe included?"];
  if (activeTab === "head-to-head") return ["Who has the edge?", "Where are we closest?", "What changed recently?"];
  if (activeTab === "desk") return ["Explain this Review", "What changed?", "Show my strongest moment"];
  if (activeTab === "progress") return ["Compare my recent Reviews", "Am I improving?", "What has repeated?"];
  if (activeTab === "universe") return ["Why am I here?", "Who's in reach?", "What's hot?"];
  if (activeTab === "friends") return ["Who is closest to me?", "Show my requests", "Who can I compare with?"];
  if (activeTab === "inbox") return ["What's unread?", "Message Ayanda"];
  if (activeTab === "profile") return ["Change my notification preferences", "What is public?"];
  if (pathname.includes("share")) return ["What can I share?", "What stays private?"];
  return ["What changed?", "Where should I look first?", "What's new?"];
}

function baseActions(context: GuideContext): GuideAction[] {
  if (!context.authenticated) return [{ id: "join", label: "Get my BoardSignal", href: "/#get-my-boardsignal", kind: "navigate" }, { id: "signin", label: "Open My Player Room", href: "/boardsignal/player-room", kind: "navigate" }];
  return [{ id: "desk", label: "Open my latest Review", href: "/boardsignal/player-room?tab=desk", kind: "navigate" }, { id: "progress", label: "Show my Progress", href: "/boardsignal/player-room?tab=progress", kind: "navigate" }];
}

function trimChips(items: string[]) { return [...new Set(items)].slice(0, 5); }
function joinFacts(facts: string[]) { return facts.filter(Boolean).slice(0, 4).join(" "); }

function recentGuideTurns(recentConversation: GuideConversationTurn[]) {
  return recentConversation.filter((turn) => turn.role === "guide");
}

function quotedOrNamedPhrase(message: string) {
  const quoted = message.match(/["“”']([^"“”']{2,180})["“”']/)?.[1]?.trim();
  if (quoted) return quoted;
  const said = message.match(/why\s+did\s+you\s+say\s+(.+?)[?!.]*$/i)?.[1]?.trim();
  return said && said.length >= 2 ? said.slice(0, 180) : undefined;
}

export function resolveGuideConversationTurn(message: string, recentConversation: GuideConversationTurn[]): GuideConversationTurn | undefined {
  const guides = recentGuideTurns(sanitizeGuideConversation(recentConversation));
  if (!guides.length) return undefined;
  const phrase = quotedOrNamedPhrase(message)?.toLowerCase();
  if (phrase) {
    const match = [...guides].reverse().find((turn) => turn.body.toLowerCase().includes(phrase));
    if (match) return match;
  }
  return guides[guides.length - 1];
}

function provenanceSentence(provenance?: GuideProvenance) {
  if (!provenance) return undefined;
  const when = provenance.timestamp ? ` at ${provenance.timestamp}` : "";
  switch (provenance.kind) {
    case "founder_announcement": return `That came from ${provenance.title ? `the Founder product update “${provenance.title}”` : "the latest Founder product update"}${when}.`;
    case "desk": return `That came from ${provenance.title ? `your completed BoardSignal Review for ${provenance.title}` : "your completed BoardSignal Review"}${when}.`;
    case "pulse": return `That came from your latest BoardSignal Pulse${when}.`;
    case "universe": return `That came from your current BoardSignal Universe context${provenance.title ? ` for ${provenance.title}` : ""}${when}.`;
    case "friends": return `That came from your accepted Friends/Rivals context${provenance.title ? ` involving ${provenance.title}` : ""}${when}.`;
    case "head_to_head": return `That came from your verified Head-to-Head comparison${provenance.title ? ` with ${provenance.title}` : ""}${when}.`;
    case "inbox": return `That came from your private BoardSignal Inbox context${provenance.title ? ` (“${provenance.title}”)` : ""}${when}.`;
    case "profile": return `That came from your saved BoardSignal account/profile settings${when}.`;
    case "offline_snapshot": return `That came from the BoardSignal snapshot saved on this device${when}. I can't check whether anything newer happened until you're back online.`;
    case "product_knowledge": return `That came from BoardSignal's fixed product rules and help content, not from new chess analysis.`;
  }
}

function mentionedEntities(context: GuideContext, body: string) {
  const candidates = [
    context.canonicalUsername,
    ...(context.friends ?? []).map((friend) => friend.canonicalUsername),
    ...(context.rivalWatch ?? []).map((item) => item.player.canonicalUsername),
    context.comparison?.left.canonicalUsername,
    context.comparison?.right.canonicalUsername,
  ].filter((value): value is string => Boolean(value));
  const lowerBody = body.toLowerCase();
  return [...new Set(candidates.filter((name) => lowerBody.includes(name.toLowerCase())))];
}

function actionForReference(turn: GuideConversationTurn, message: string): GuideConversationAction | undefined {
  const actions = turn.actions ?? [];
  if (!actions.length) return undefined;
  const text = lower(message);
  if (has(text, "open that again", "take me back there", "go back")) return [...actions].reverse().find((action) => action.kind === "navigate" && action.href) ?? actions[actions.length - 1];
  if (has(text, "message", "sent", "send")) return [...actions].reverse().find((action) => action.kind === "handoff") ?? actions[actions.length - 1];
  return actions.length === 1 ? actions[0] : undefined;
}

export function renderGuideFollowup(intent: GuideIntent, context: GuideContext, message: string, recentConversation: GuideConversationTurn[]): GuideResponse | undefined {
  if (!["followup_why", "followup_explain", "followup_source", "followup_meaning", "followup_reference", "followup_clarify"].includes(intent)) return undefined;
  const safeHistory = sanitizeGuideConversation(recentConversation);
  const target = resolveGuideConversationTurn(message, safeHistory);
  if (!target) {
    return {
      reply: "I don't have that earlier part in my current bounded conversation context, so I won't invent what I previously meant.",
      chips: pageGuideSuggestions(context.pathname, context.activeTab, context.authenticated).slice(0, 3),
      actions: [],
      handoffAvailable: context.authenticated,
      contextReason: "No usable recent Guide response was available for that reference.",
      intent,
      category: "general",
      provenance: { kind: "product_knowledge", title: "Conversation boundary" },
    };
  }

  const inferredAnnouncementProvenance = !target.provenance && target.intent === "whats_new" && context.latestAnnouncement && target.body.toLowerCase().includes(context.latestAnnouncement.title.toLowerCase())
    ? { kind: "founder_announcement" as const, id: context.latestAnnouncement.id, title: context.latestAnnouncement.title, timestamp: context.latestAnnouncement.createdAt }
    : undefined;
  const effectiveProvenance = target.provenance ?? inferredAnnouncementProvenance;
  const source = provenanceSentence(effectiveProvenance);
  const entities = mentionedEntities(context, target.body);
  const action = actionForReference(target, message);
  const excerpt = target.body.length > 260 ? `${target.body.slice(0, 257)}…` : target.body;
  const text = lower(message);
  let reply = source ?? `I can see the previous reply — “${excerpt}” — but that older turn does not carry enough source metadata for me to name a verified source.`;
  const actions: GuideAction[] = [];

  if (intent === "followup_source") {
    reply = source ?? (target.intent === "whats_new"
      ? `That was in my previous What's New reply, but it does not map to a current explicit product announcement. Generic Founder/support messages no longer count as What's New, so I won't invent a product-update source for it.`
      : `That was in my previous reply, but the current bounded turn does not include verified source metadata. I won't make one up.`);
  } else if (intent === "followup_why") {
    reply = source
      ? source.replace(/^That came from /, "I said that because it came from ")
      : target.intent === "whats_new"
        ? `I said that in my previous What's New reply, but it does not map to a current explicit product announcement. Generic Founder/support messages should not be treated as product updates.`
        : `I said “${excerpt},” but that previous turn does not carry verified provenance in the current context, so I can't honestly claim a source.`;
  } else if (intent === "followup_explain" || intent === "followup_meaning") {
    if (has(text, "does that mean i'm improving", "does that mean im improving", "does that mean i am improving")) {
      reply = `That previous fact does not, by itself, prove you're improving. BoardSignal uses your recent completed Reviews in Progress for that comparison.${source ? ` ${source}` : ""}`;
      actions.push({ id: "progress", label: "Open Progress", href: "/boardsignal/player-room?tab=progress", kind: "navigate" });
    } else {
      reply = `By that, I meant the point in my previous reply: “${excerpt}”${source ? ` ${source}` : ""}`;
    }
  } else if (intent === "followup_reference" || intent === "followup_clarify") {
    if (has(text, "that was just a test", "that was a test message", "that message was just a test")) {
      reply = `Got it. That was part of the recent conversation context, but a generic Founder/support message should not be treated as a product update. “What's new?” now uses explicit BoardSignal product announcements only.`;
    } else if (has(text, "i sent that", "where did that message go")) {
      if (/sent privately to ayanda/i.test(target.body)) reply = `My previous reply said it was sent privately to Ayanda, but I don't treat conversation text alone as server proof. Open Inbox to verify the conversation.`;
      else reply = `I offered the ${action?.label ?? "Message Ayanda"} action, but this bounded conversation alone does not prove it was sent. Check Inbox for the actual private conversation.`;
      actions.push({ id: "inbox", label: "Open Inbox", href: "/boardsignal/player-room?tab=inbox", kind: "navigate" });
    } else if (action?.href && has(text, "open that again", "take me back there", "go back")) {
      reply = `I was referring to “${action.label}.” I can take you back there.`;
      actions.push({ id: action.id, label: action.label, href: action.href, kind: "navigate" });
    } else if (entities.length === 1) {
      reply = `I was referring to ${entities[0]}.${source ? ` ${source}` : ""}`;
    } else if (entities.length > 1) {
      reply = `There is more than one reasonable referent in my last reply. Do you mean ${entities.slice(0, 2).join(" or ")}?`;
    } else if (action) {
      reply = `I was referring to the action “${action.label}.”${action.href ? " I can open it again." : ""}`;
      if (action.href) actions.push({ id: action.id, label: action.label, href: action.href, kind: "navigate" });
    } else {
      reply = `I was referring to my previous reply: “${excerpt}”${source ? ` ${source}` : ""}`;
    }
  }

  return {
    reply,
    chips: ["Where did that come from?", "Explain that", ...pageGuideSuggestions(context.pathname, context.activeTab, context.authenticated)].slice(0, 4),
    actions: actions.slice(0, 3),
    handoffAvailable: context.authenticated,
    contextReason: "Using the most recent bounded Guide turn that matches your reference.",
    intent,
    category: target.intent ? guideCategoryForIntent(target.intent) : "general",
    provenance: effectiveProvenance,
  };
}

export type GuideBrainResult = { intent: GuideIntent; context: GuideContext; message: string; recentConversation: GuideConversationTurn[] };
export interface GuideRenderer { render(result: GuideBrainResult): GuideResponse; }
export function runGuideBrain(message: string, context: GuideContext): GuideBrainResult {
  const recentConversation = sanitizeGuideConversation(context.recentConversation ?? []);
  return { intent: detectGuideIntent(message, context, recentConversation), context, message, recentConversation };
}

function provenanceForIntent(intent: GuideIntent, context: GuideContext): GuideProvenance | undefined {
  if (intent === "what_changed") return { kind: "pulse", title: "Latest BoardSignal Pulse", timestamp: context.contextUpdatedAt };
  if (["explain_desk", "explain_signal", "progress", "share"].includes(intent)) return { kind: "desk", title: context.latestDesk?.periodLabel, timestamp: context.contextUpdatedAt };
  if (["universe_what", "universe_included", "explain_rank", "in_reach", "whats_hot"].includes(intent)) return { kind: "universe", title: context.standings?.[0]?.categoryTitle, timestamp: context.contextUpdatedAt };
  if (["friends", "friend_requests"].includes(intent)) return { kind: "friends", timestamp: context.contextUpdatedAt };
  if (intent === "compare_friend") return { kind: "head_to_head", title: context.comparison?.right.canonicalUsername, timestamp: context.contextUpdatedAt };
  if (intent === "inbox") return { kind: "inbox", title: "BoardSignal Inbox", timestamp: context.contextUpdatedAt };
  if (["notifications", "tone"].includes(intent)) return { kind: "profile", title: "BoardSignal Profile", timestamp: context.contextUpdatedAt };
  if (intent === "whats_new" && context.latestAnnouncement) return { kind: "founder_announcement", id: context.latestAnnouncement.id, title: context.latestAnnouncement.title, timestamp: context.latestAnnouncement.createdAt };
  return { kind: "product_knowledge", title: "BoardSignal product rules" };
}

function renderBetaPreviewGuide(intent: GuideIntent, context: GuideContext): GuideResponse | undefined {
  if (context.mode !== "beta_preview" || !context.previewContext) return undefined;
  const p = context.previewContext; let reply: string | undefined;
  if (intent === "explain_desk" || intent === "what_changed") reply = p.playableWeek ? `I found ${p.games} games in ${p.periodLabel ?? "this preview week"}: ${p.wins}W · ${p.draws}D · ${p.losses}L. ${p.safeHighlight}` : `I found ${p.canonicalUsername}'s Chess.com profile, but there isn't a playable completed week to show yet. I won't invent one.`;
  else if (["explain_rank","universe_what","in_reach"].includes(intent)) { const best=[...(p.universePreview??[])].sort((a,b)=>a.rank-b.rank)[0]; reply=best ? `Preview only: if the field held, ${p.canonicalUsername} would be #${best.rank} of ${best.denominator} in ${best.categoryTitle}${best.scopeLabel ? ` · ${best.scopeLabel}` : ""}. This is provisional and does not publish the player into the official Universe before identity review or future Chess.com verification.` : `This preview does not have a compatible provisional Universe placement yet. BoardSignal will not manufacture a rank.`; }
  else if (intent === "beta_next") {
    if (p.activationReturnMethod === "device" && p.deviceAlertsEnabled) reply = "You do not need to wait. Continue to My Player Room opens private Founding Access now. Device alerts are an optional return channel, and magic access remains cross-device/recovery only.";
    else if (p.activationReturnMethod === "return_here") reply = "You do not need to wait. Continue to My Player Room opens private Founding Access now. Your Preview is also saved on this device if you leave before continuing; email is not required.";
    else if (["email", "discord", "telegram"].includes(String(p.activationReturnMethod ?? ""))) reply = `You do not need to wait for ${p.activationReturnMethod}. Continue to My Player Room opens private Founding Access now; ${p.activationReturnMethod} is only a backup return channel.`;
    else reply = "Ready when you are: Continue to My Player Room opens your private Founding Access now. The compact agreement comes next, then Review. Identity review happens quietly in the background; email, magic access and access codes are not required for this first entry.";
  }
  else if (intent === "notifications") {
    if (p.activationReturnMethod === "device" && p.deviceAlertsEnabled) reply = "Device alerts are enabled for this Preview as an optional return channel. Private Founding Access can start now from Continue to My Player Room; the background identity review does not block that first private entry.";
    else if (!context.deliveryStatus?.browserPushConfigured) reply = "Device alerts are not configured by BoardSignal yet. Your Preview is still saved on this device, so you can come back here without email, or add email/Discord/Telegram as an optional backup.";
    else reply = "Email is optional. After you have seen the Preview, choose Notify this device if you want this browser to alert you, or choose I'll come back here. Email/Discord/Telegram are backup return channels and can be corrected while the request is pending.";
  }
  else if (intent === "friends") reply = "Preview can show public-safe players in the field, but Add Friend, Head-to-Head and Rival Watch unlock only after private Player Room access.";
  else if (intent === "privacy") reply = "Preview contains public-safe chess facts only. It does not contain Red, Amber, Blue, private evidence, recurrence, Inbox, private Friends state or account settings, and it does not prove ownership of the Chess.com account.";
  if (!reply) return undefined;
  return { reply, chips: ["Show me my week","Explain my Universe preview","What unlocks next?"], actions: [], handoffAvailable: false, contextReason: "Using the server-verified public-safe Preview only.", intent, category: guideCategoryForIntent(intent), provenance: { kind: "product_knowledge", title: "BoardSignal Preview", timestamp: p.generatedAt } };
}

export function renderGuideResponse(intent: GuideIntent, context: GuideContext, message = "", recentConversation: GuideConversationTurn[] = context.recentConversation ?? []): GuideResponse {
  const previewResponse = renderBetaPreviewGuide(intent, context);
  if (previewResponse) return previewResponse;
  const followup = renderGuideFollowup(intent, context, message, recentConversation);
  if (followup) return followup;
  const chips = pageGuideSuggestions(context.pathname, context.activeTab, context.authenticated);
  const actions: GuideAction[] = [];
  let reply = "I can explain what BoardSignal already knows, help you navigate it, or get Ayanda involved when something needs a human.";
  let contextReason = context.activeTab ? `Using your ${context.activeTab} page context.` : `Using ${context.pathname || "/"} page context.`;

  switch (intent) {
    case "what_is_boardsignal":
      reply = "BoardSignal turns a fixed seven days of your Chess.com games into a personal sports Review: what happened, what mattered, your private Signals, progress across recent Reviews, and your public-safe place in the Universe.";
      actions.push({ id: "how", label: "See how it works", href: "/how-it-works", kind: "navigate" });
      break;
    case "how_it_works": {
      const question = message.toLowerCase();
      if (question.includes("install")) {
        reply = "Install BoardSignal from the Player Room or Profile after meaningful use. On supported Chromium browsers, BoardSignal can use the browser install prompt; on iPhone or iPad, use Share → Add to Home Screen → Confirm BoardSignal. Installed mode keeps the same account and routes.";
        actions.push({ id: "profile-install", label: "Open Profile", href: "/boardsignal/player-room?tab=profile", kind: "navigate" });
      } else if (question.includes("offline")) {
        reply = "Yes—after you've opened your authenticated Player Room online, BoardSignal can save your latest four Reviews, recent Progress, last Pulse, a clearly timestamped Universe snapshot and bounded social comparison state on that device. New Chess.com games, messages and mutations still require a connection.";
        actions.push({ id: "profile-offline", label: "Open device settings", href: "/boardsignal/player-room?tab=profile", kind: "navigate" });
      } else {
        reply = "BoardSignal uses your Chess.com identity, closes one seven-day episode at a time, builds the Review deterministically, and keeps your latest four completed Reviews active. Your next episode can form between publications without becoming a new diagnostic Review.";
        actions.push(...baseActions(context));
      }
      break;
    }
    case "privacy":
      reply = "Public coverage is limited to safe sports facts such as your username, avatar, supported highlights and Universe placement. Red, private Amber, Blue, evidence, recurrence, contact details, access credentials and private messages stay private.";
      actions.push({ id: "privacy", label: "Open privacy", href: "/boardsignal/privacy", kind: "navigate" });
      break;
    case "agreement":
      reply = "In plain language: Founding Access gives you a persistent BoardSignal account; each completed Review may contribute safe sports-style Universe coverage; your private weakness layer, evidence, progress details, contact information and messages stay private; and BoardSignal contact consent is for BoardSignal account, Review, product-update and feedback communication—not unrelated marketing.";
      actions.push({ id: "terms", label: "Open Founding Access terms", href: "/boardsignal/beta-terms", kind: "navigate" }, { id: "privacy", label: "Open privacy", href: "/boardsignal/privacy", kind: "navigate" });
      break;
    case "username_reason":
      reply = "Your Chess.com username lets BoardSignal resolve the stable Chess.com player ID that anchors your account. The stable ID—not the spelling of your username—is what keeps your Reviews, Friends and future OAuth identity attached to the same player.";
      break;
    case "beta_next":
      reply = context.authenticated ? "You're already in. Your private BoardSignal is available now; Founding Access identity review can happen quietly in the background without making you log in again." : "After your public-safe Preview, Continue to My Player Room starts private Founding Access immediately for an eligible first-time BoardSignal identity. The compact agreement comes next, then Review; Ayanda reviews identity in the background. Magic access and username + access code remain recovery paths, not onboarding gates.";
      actions.push(...baseActions(context));
      break;
    case "beta_cost":
      reply = "Current Founding Access does not require billing or a payment gate. BoardSignal is measuring the join → return → repeat loop before pricing is introduced.";
      actions.push({ id: "join", label: "Get my BoardSignal", href: "/#get-my-boardsignal", kind: "navigate" });
      break;
    case "sign_in":
      reply = context.authenticated ? "You're already signed in to your persistent BoardSignal Player Room." : "Open My Player Room and use your working Founding Access path. Returning Firebase sessions should take you straight back into the Room.";
      actions.push({ id: "signin", label: "Open My Player Room", href: "/boardsignal/player-room", kind: "navigate" });
      break;
    case "universe_what":
      reply = "The BoardSignal Universe is the public-safe recent sports field built primarily from active completed Reviews. It can show supported leaders, Top 3 placements, What's Hot and safe coverage without exposing private weakness data.";
      actions.push({ id: "universe", label: "Open Universe", href: "/feed", kind: "navigate" });
      break;
    case "universe_included":
      reply = "Founding Access includes safe BoardSignal Universe participation. A completed Review may contribute a positive or neutral factual sports item. That does not make your private weakness layer public.";
      break;
    case "what_changed": {
      if (!context.authenticated) { reply = "I can only show personal changes after you sign in to your Player Room."; actions.push({ id: "signin", label: "Open My Player Room", href: "/boardsignal/player-room", kind: "navigate" }); break; }
      const facts = (context.pulseFacts ?? []).flatMap((item) => [item.title, item.body, ...(item.facts ?? [])]).filter(Boolean);
      reply = facts.length ? `Since your last visit: ${joinFacts(facts)}` : "Nothing factual in your saved Pulse says your board changed since the last check. I won't manufacture movement just to fill the page.";
      actions.push({ id: "pulse", label: "Open Pulse", href: "/boardsignal/player-room?tab=universe", kind: "navigate" }, { id: "universe", label: "Open Universe", href: "/feed", kind: "navigate" });
      break;
    }
    case "explain_desk":
      reply = context.latestDesk ? `${context.latestDesk.headline} BoardSignal chose that story from the completed ${context.latestDesk.periodLabel} episode: ${context.latestDesk.summary}` : "There isn't a completed Review in the verified account context for me to explain yet.";
      actions.push({ id: "desk", label: "Open my latest Review", href: "/boardsignal/player-room?tab=desk", kind: "navigate" });
      break;
    case "explain_signal": {
      if (!context.latestDesk) { reply = "I need a completed Review before I can explain one of its Signals."; break; }
      const text = lower(message);
      const selected = text.includes("amber") ? context.latestDesk.amber : text.includes("red") ? context.latestDesk.red : context.latestDesk.blue;
      reply = selected ? `${selected.title}: ${selected.copy} This is an explanation of the Signal already produced by your completed Review—not new chess analysis.` : "Your latest Review has no matching saved Signal for that request.";
      actions.push({ id: "signals", label: "Open my signals", href: "/boardsignal/player-room?tab=desk#signals", kind: "navigate" });
      break;
    }
    case "progress":
      reply = context.recentDeskLabels?.length ? `Your active comparison window currently contains ${context.recentDeskLabels.length} completed Review${context.recentDeskLabels.length === 1 ? "" : "s"}: ${context.recentDeskLabels.join(" · ")}. Progress uses this moving recent-four view rather than an infinite archive.` : "You need completed Reviews before BoardSignal can show recent progress.";
      actions.push({ id: "progress", label: "Open Progress", href: "/boardsignal/player-room?tab=progress", kind: "navigate" });
      break;
    case "explain_rank": {
      const best = [...(context.standings ?? [])].sort((a,b) => a.rank-b.rank)[0];
      reply = best ? `Your strongest verified current standing here is #${best.rank} of ${best.denominator} in ${best.categoryTitle}${best.scopeLabel ? ` · ${best.scopeLabel}` : ""}, based on the deterministic completed-Review field. Forming-episode projections do not become official ranks.` : "I don't have a current official Universe standing in the verified context to explain.";
      actions.push({ id: "universe", label: "Open Universe", href: "/boardsignal/player-room?tab=universe", kind: "navigate" });
      break;
    }
    case "in_reach": {
      const proximity = (context.pulseFacts ?? []).find((item) => /reach|radar|challenger|place/i.test(`${item.eyebrow} ${item.title} ${item.body}`));
      if (has(message, "what do you mean by in reach", "what does in reach mean")) {
        reply = `“In Reach” means BoardSignal has a clear, numerically meaningful gap between you and the next relevant position in the same comparable field.${proximity ? ` Right now: ${proximity.title} ${proximity.body}` : " I don't have a current verified In Reach fact for you."}`;
      } else reply = proximity ? `${proximity.title} ${proximity.body}` : "I don't have a current verified In Reach / nearby-field fact for you. BoardSignal only names proximity when the numerical gap is meaningful.";
      actions.push({ id: "universe", label: "Open Universe", href: "/boardsignal/player-room?tab=universe", kind: "navigate" });
      break;
    }
    case "whats_hot":
      reply = "What's Hot is BoardSignal's deterministic recent-sports layer. It favors recency, magnitude, field impact and novelty—never likes, followers or AI judgment.";
      actions.push({ id: "universe", label: "See What's Hot", href: "/feed", kind: "navigate" });
      break;
    case "friends": {
      const friends = context.friends ?? [];
      const rival = context.rivalWatch?.[0];
      reply = rival ? `${rival.label}: ${rival.player.canonicalUsername}. ${rival.detail}` : friends.length ? `You currently have ${friends.length} accepted BoardSignal friend${friends.length === 1 ? "" : "s"}. I only compare public-safe sporting results; friendship never opens private Signals or evidence.` : "You don't have an accepted BoardSignal friend yet. The Friends page can show active players to discover and lets you search by canonical Chess.com username.";
      actions.push({ id: "friends", label: "Open Friends", href: "/boardsignal/player-room?tab=friends", kind: "navigate" });
      break;
    }
    case "friend_requests":
      reply = `You have ${(context.incomingRequests ?? []).length} incoming and ${(context.outgoingRequests ?? []).length} outgoing friend request${((context.incomingRequests ?? []).length + (context.outgoingRequests ?? []).length) === 1 ? "" : "s"}.`;
      actions.push({ id: "friends", label: "Show my requests", href: "/boardsignal/player-room?tab=friends", kind: "navigate" });
      break;
    case "compare_friend": {
      const comparison = context.comparison;
      if (!comparison) { reply = "I can compare accepted friends when you name one whose Head-to-Head context is available. I won't compare private coaching data or mix rating pools."; actions.push({ id: "friends", label: "Choose a friend", href: "/boardsignal/player-room?tab=friends", kind: "navigate" }); break; }
      const metric = comparison.metrics[0];
      reply = metric ? `${metric.label}: ${comparison.left.canonicalUsername} ${metric.leftValue} vs ${comparison.right.canonicalUsername} ${metric.rightValue}.${metric.note ? ` ${metric.note}` : ""}` : `There is not yet a meaningful comparable sample between ${comparison.left.canonicalUsername} and ${comparison.right.canonicalUsername}.`;
      actions.push({ id: "friends", label: "Open Head-to-Head", href: `/boardsignal/player-room?tab=friends&compare=${comparison.right.playerId}`, kind: "navigate" });
      break;
    }
    case "inbox":
      reply = context.authenticated ? `You have ${context.unreadInboxCount ?? 0} unread BoardSignal message${context.unreadInboxCount === 1 ? "" : "s"}.` : "Inbox is private to an authenticated BoardSignal player.";
      actions.push({ id: "inbox", label: "Open Inbox", href: "/boardsignal/player-room?tab=inbox", kind: "navigate" });
      break;
    case "message_founder":
    case "support":
      reply = context.authenticated ? "I can hand this to Ayanda through your existing private BoardSignal conversation, with the current page and issue category attached so you don't have to repeat the basics." : "For account-specific help, sign in first so BoardSignal can attach the right private account context.";
      if (context.authenticated) actions.push({ id: "handoff", label: "Message Ayanda", kind: "handoff", requiresConfirmation: true });
      else actions.push({ id: "signin", label: "Open My Player Room", href: "/boardsignal/player-room", kind: "navigate" });
      break;
    case "notifications": {
      const question = message.toLowerCase();
      if (question.includes("browser") || question.includes("push") || question.includes("alerts unavailable")) {
        reply = context.deliveryStatus?.browserPushConfigured
          ? "Browser alerts are configured for BoardSignal. They remain optional: open Profile and choose Enable browser alerts, then your browser asks for permission only because you clicked. If you've denied permission, BoardSignal respects that."
          : "Browser alerts haven't been configured by BoardSignal yet. Your in-app Inbox still works. Once Web Push configuration is enabled, Profile will offer the deliberate browser-alert opt-in.";
      } else if (question.includes("email")) {
        if (!context.deliveryStatus?.emailConfigured) reply = "Email delivery isn't active yet. Your in-app Inbox still works, and browser alerts can work separately when configured and enabled.";
        else if (!context.authenticated) reply = "BoardSignal email delivery is available only for signed-in players who provide an email address, consent to BoardSignal contact and enable important email updates.";
        else if (!context.emailAccountReady) reply = "BoardSignal email delivery is configured, but your account is not currently eligible. In Profile, choose Email as your preferred contact, provide a valid address, keep BoardSignal contact consent enabled and turn on important email updates.";
        else reply = "Your account is set up for important BoardSignal email updates. BoardSignal keeps email selective—Review Ready, major BoardSignal updates, feedback requests and other important eligible messages rather than every Pulse movement.";
      } else if (question.includes("badge") || question.includes("number on") || question.includes("icon")) {
        reply = context.authenticated ? `The number on an installed BoardSignal icon represents unread Inbox messages. Your current verified unread count is ${context.unreadInboxCount ?? 0}. It clears when your Inbox reaches zero or when you sign out; browsers that don't support app badging simply ignore it.` : "Where supported, the installed BoardSignal icon can show unread Inbox count. It is a progressive browser feature and does not expose message content.";
      } else {
        reply = context.authenticated ? "Your notification settings live in Profile. In-app Inbox is the base channel; browser push and important email are optional delivery layers. Changing a setting always requires your explicit action." : "In-app Inbox is BoardSignal's base delivery channel. Signed-in players can manage optional browser and email delivery from Profile when those channels are configured.";
      }
      actions.push({ id: "profile", label: "Open notification preferences", href: "/boardsignal/player-room?tab=profile", kind: "navigate" });
      break;
    }
    case "whats_new":
      reply = context.latestAnnouncement ? `${context.latestAnnouncement.title}. ${context.latestAnnouncement.body}` : "There isn't a current major Founder announcement in your Inbox context.";
      if (context.latestAnnouncement?.link) actions.push({ id: "announcement", label: context.latestAnnouncement.actionLabel ?? "Open update", href: context.latestAnnouncement.link, kind: "navigate" });
      break;
    case "share": {
      const best = context.shareMoments?.[0];
      reply = best ? `${best.headline} — ${best.statValue} ${best.statLabel}. That's a public-safe Share Moment from an already completed Review; your private Signals and evidence are excluded.` : "I don't have a verified Share Moment in the current context yet.";
      if (best) actions.push({ id: "share", label: "Share my best moment", href: `/share/${encodeURIComponent(best.id)}`, kind: "navigate" });
      break;
    }
    case "tour":
      reply = "The 30-second tour is: Review for the finished week, Progress for the recent-four pattern, Universe for the field, Friends for comparisons, and Inbox / Ask BoardSignal for communication and help.";
      actions.push({ id: "tour-start", label: "Show me", kind: "tour" }, { id: "tour-later", label: "Maybe later", kind: "tour" });
      break;
    case "tone":
      reply = `Your current Ask BoardSignal tone is ${context.preferences?.preferredTone ?? "Balanced"}. Tone changes only after you explicitly choose one.`;
      actions.push(...(["Direct", "Analytical", "Sports Desk", "Balanced"] as GuideTone[]).map((tone) => ({ id: `tone:${tone}`, label: tone === "Sports Desk" ? "Sports coverage" : tone, kind: "preference" as const, requiresConfirmation: true, payload: { preferredTone: tone } })));
      break;
    case "random_position":
      reply = "I can explain analysis already produced inside your BoardSignal Review. I don't create new chess analysis from random positions in the guide.";
      actions.push({ id: "desk", label: "Open my Review", href: "/boardsignal/player-room?tab=desk", kind: "navigate" });
      break;
    case "welcome": {
      const address = context.preferences?.preferredAddress?.trim();
      reply = context.authenticated ? `${address ? `${address}, ` : ""}Ask BoardSignal is here to explain your Review, Pulse, Universe, Friends and account without creating new chess analysis.${context.pulseFacts?.length ? " Your Board has recent movement I can explain." : ""}${context.tourState === "unseen" ? " Want the 30-second tour?" : ""}` : "Ask BoardSignal can explain the product, privacy, Universe and Founding Access flow. Sign in for personal Review, Pulse, Friends and Inbox context.";
      if (context.authenticated && context.tourState === "unseen") actions.push({ id: "tour-start", label: "Show me", kind: "tour" }, { id: "tour-later", label: "Maybe later", kind: "tour" });
      if (context.authenticated && context.tourState !== "unseen" && context.releaseHintDismissed === false) actions.push({ id: "friends-release", label: "See Friends & Rivals", href: "/boardsignal/player-room?tab=friends", kind: "navigate" }, { id: "release-later", label: "Later", kind: "tour" });
      break;
    }
    default:
      reply = "I can help with this page, your recent BoardSignal facts, Friends comparisons, privacy, Inbox, or support. I won't guess at chess facts that BoardSignal hasn't produced.";
      if (context.authenticated) actions.push({ id: "handoff", label: "Message Ayanda", kind: "handoff", requiresConfirmation: true });
      break;
  }

  const tone = context.preferences?.preferredTone ?? "Balanced";
  const detail = context.preferences?.preferredDetailLevel ?? "Standard";
  if (tone === "Sports Desk" && intent === "what_changed" && (context.pulseFacts?.length ?? 0) > 0 && !reply.startsWith("Your Board moved.")) {
    reply = `Your Board moved. ${reply}`;
  }
  if (tone === "Analytical") {
    contextReason = `${contextReason} Facts are limited to verified BoardSignal state.`;
  }
  const maxChips = detail === "Short" ? 3 : 5;
  const maxActions = detail === "Short" ? 3 : 5;

  return { reply, chips: trimChips(chips).slice(0, maxChips), actions: actions.slice(0, maxActions), handoffAvailable: context.authenticated, contextReason, intent, category: guideCategoryForIntent(intent), provenance: provenanceForIntent(intent, context) };
}

export const deterministicGuideRenderer: GuideRenderer = {
  render(result) { return renderGuideResponse(result.intent, result.context, result.message, result.recentConversation); },
};

export function boundedGuideMemory(memory: GuideConversationMemory, topic: string, signal?: string): GuideConversationMemory {
  return {
    ...memory,
    recentTopics: [...new Set([topic, ...(memory.recentTopics ?? [])])].slice(0, 6),
    productSignals: [...new Set([...(signal ? [signal] : []), ...(memory.productSignals ?? [])])].slice(0, 8),
  };
}

export function expressedSentiment(message: string): GuideConversationMemory["recentSentiment"] {
  const text = lower(message);
  if (has(text, "frustrated", "annoyed", "this is broken", "still broken")) return "frustrated";
  if (has(text, "confused", "don't understand", "dont understand", "doesn't make sense", "doesnt make sense")) return "confused";
  if (has(text, "excited", "love this", "this is great")) return "excited";
  if (has(text, "thanks", "thank you", "helpful", "got it")) return "positive";
  return undefined;
}
