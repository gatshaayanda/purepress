"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { HelpCircle, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pageGuideSuggestions, type GuideAction, type GuideConversationTurn, type GuideResponse } from "@/lib/boardsignal/guide";
import { auth } from "@/utils/firebaseConfig";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";
import { buildOfflineGuideResponse } from "@/lib/boardsignal/offline/guide";
import { deleteOfflineDraft, loadOfflineDrafts, loadPlayerRoomOfflineSnapshot, loadSocialOfflineSnapshot, saveOfflineDraft } from "@/lib/boardsignal/offline/snapshots";

type ChatMessage = { id: string; sender: "player" | "guide"; body: string; response?: GuideResponse; feedback?: "helpful" | "unclear" };
type AskContextObservation = {
  stateKey: string;
  priority: number;
  prompt?: string;
  opener: GuideResponse;
  chips: string[];
  contextUpdatedAt?: string;
};

const STORAGE_PREFIX = "boardsignal-guide-continuity-v2";
const PROMPT_MEMORY_PREFIX = "boardsignal-guide-context-prompts-v1";
const ELIGIBLE = ["/", "/boardsignal", "/offline", "/app", "/feed", "/player", "/share", "/join", "/how-it-works", "/pricing"];
const MAX_CONTEXT_PROMPT_KEYS = 12;
let activeContinuityGeneration = "guest";

function eligiblePath(pathname: string) {
  return ELIGIBLE.some((prefix) => prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isNegativeFeedbackPhrase(value: string) {
  const plain = value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
  return /^(?:not really|no|i don't get it|i do not get it|i don't understand|i do not understand|that wasn't clear|that was not clear|can you explain that simpler|explain that more simply)$/.test(plain);
}

function generationForUser(user?: User | null) {
  if (!user) return "guest";
  const created = user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : NaN;
  return Number.isFinite(created) ? `created-${created}` : "account-current";
}

function continuityKey(uid?: string) { return `${STORAGE_PREFIX}:${uid || "guest"}:${activeContinuityGeneration}`; }
function promptMemoryKey(uid?: string) { return `${PROMPT_MEMORY_PREFIX}:${uid || "guest"}:${activeContinuityGeneration}`; }

function recentConversationForServer(messages: ChatMessage[]): GuideConversationTurn[] {
  return messages.slice(-12).map((item) => ({
    role: item.sender,
    body: item.body.slice(0, 1200),
    ...(item.response?.intent ? { intent: item.response.intent } : {}),
    ...(item.response?.provenance ? { provenance: item.response.provenance } : {}),
    ...(item.response?.actions?.length ? {
      actions: item.response.actions.slice(0, 3).map((action) => ({ id: action.id, label: action.label, href: action.href, kind: action.kind })),
    } : {}),
  }));
}

function readContinuity(uid?: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(continuityKey(uid)) ?? "null") as { updatedAt?: string; messages?: ChatMessage[] } | null;
    if (!stored || !Array.isArray(stored.messages)) return [];
    if (stored.updatedAt && Date.now() - Date.parse(stored.updatedAt) > 14 * 24 * 60 * 60 * 1000) return [];
    return stored.messages.slice(-12).map((item) => ({
      id: String(item.id),
      sender: item.sender === "player" ? "player" : "guide",
      body: String(item.body).slice(0, 1800),
      response: item.response,
      feedback: item.feedback === "helpful" || item.feedback === "unclear" ? item.feedback : undefined,
    }));
  } catch { return []; }
}

function promptKeys(uid?: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = JSON.parse(window.localStorage.getItem(promptMemoryKey(uid)) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-MAX_CONTEXT_PROMPT_KEYS) : [];
  } catch { return []; }
}

function rememberPrompt(uid: string | undefined, stateKey: string) {
  if (typeof window === "undefined" || !stateKey) return;
  try {
    const previous = promptKeys(uid);
    const next = [...previous.filter((item) => item !== stateKey), stateKey].slice(-MAX_CONTEXT_PROMPT_KEYS);
    window.localStorage.setItem(promptMemoryKey(uid), JSON.stringify(next));
  } catch { /* prompt suppression is optional */ }
}

function promptAlreadyShown(uid: string | undefined, stateKey: string) {
  return promptKeys(uid).includes(stateKey);
}

function provenanceLabel(response?: GuideResponse) {
  const provenance = response?.provenance;
  if (!provenance?.title) return "";
  const timestamp = provenance.timestamp;
  if (!timestamp) return provenance.title;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return `${provenance.title} · ${timestamp}`;
  try {
    const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(parsed));
    return `${provenance.title} · ${time}`;
  } catch {
    return provenance.title;
  }
}

export default function AskBoardSignal() {
  const connectivity = useBoardSignalConnectivity();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [continuityGeneration, setContinuityGeneration] = useState("guest");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>();
  const [visibleEntityId, setVisibleEntityId] = useState<number>();
  const [previewAccess, setPreviewAccess] = useState<{ requestId: string; statusToken: string }>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const [failure, setFailure] = useState(false);
  const [observation, setObservation] = useState<AskContextObservation>();
  const [contextPrompt, setContextPrompt] = useState<AskContextObservation>();
  const [contextRefresh, setContextRefresh] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const restoredDraftRef = useRef<string | undefined>(undefined);
  const feedbackHandledRef = useRef(new Set<string>());

  useEffect(() => onAuthStateChanged(auth, (activeUser) => {
    activeContinuityGeneration = generationForUser(activeUser);
    setContinuityGeneration(activeContinuityGeneration);
    setUser(activeUser);
  }), []);
  useEffect(() => {
    messagesRef.current = messages;
    for (const item of messages) if (item.feedback) feedbackHandledRef.current.add(item.id);
  }, [messages]);
  useEffect(() => {
    restoredDraftRef.current = undefined;
    setMessages(readContinuity(user?.uid));
  }, [user?.uid]);
  useEffect(() => {
    if (!user?.uid) return;
    setMessages(readContinuity(user.uid));
    try {
      // Remove the pre-E UID-only continuity key so a deleted/re-created Firebase
      // principal with the same deterministic UID cannot inherit old local chat.
      window.localStorage.removeItem(`${STORAGE_PREFIX}:${user.uid}`);
    } catch { /* cleanup is optional */ }
  }, [continuityGeneration]);

  useEffect(() => {
    if (!connectivity.online || !user?.uid) return;
    let active = true;
    void loadOfflineDrafts(user.uid).then((drafts) => {
      if (!active || !drafts.length) return;
      const draft = drafts[0];
      if (restoredDraftRef.current === draft.id) return;
      restoredDraftRef.current = draft.id;
      const response: GuideResponse = {
        reply: "Your message draft for Ayanda is ready. Review it, then send it when you're ready.",
        chips: [],
        actions: [{ id: `send-offline-draft:${draft.id}`, label: "Send to Ayanda", kind: "handoff", requiresConfirmation: true, payload: { body: draft.body, draftId: draft.id } }],
        handoffAvailable: true,
        intent: "message_founder",
        category: "support_request",
      };
      setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: response.reply, response }].slice(-12));
      setUnread(true);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [connectivity.online, user?.uid]);

  useEffect(() => {
    const onContext = (event: Event) => {
      const detail = (event as CustomEvent<{ activeTab?: string; visibleEntityId?: number }>).detail;
      setActiveTab(String(detail?.activeTab ?? "") || undefined);
      const entity = Number(detail?.visibleEntityId);
      setVisibleEntityId(Number.isSafeInteger(entity) && entity > 0 ? entity : undefined);
    };
    window.addEventListener("boardsignal:context", onContext);
    return () => window.removeEventListener("boardsignal:context", onContext);
  }, []);

  useEffect(() => {
    const onPreview = (event: Event) => {
      const detail = (event as CustomEvent<{ requestId?: string; statusToken?: string }>).detail;
      const requestId = String(detail?.requestId ?? "");
      const statusToken = String(detail?.statusToken ?? "");
      if (requestId && statusToken) setPreviewAccess({ requestId, statusToken });
    };
    const onAskOpen = (event: Event) => {
      const message = String((event as CustomEvent<{ message?: string }>).detail?.message ?? "").slice(0, 1200);
      setOpen(true);
      if (message) setInput(message);
    };
    window.addEventListener("boardsignal:preview-context", onPreview);
    window.addEventListener("boardsignal:ask-open", onAskOpen);
    return () => { window.removeEventListener("boardsignal:preview-context", onPreview); window.removeEventListener("boardsignal:ask-open", onAskOpen); };
  }, []);

  useEffect(() => {
    const refresh = () => setContextRefresh((value) => value + 1);
    window.addEventListener("boardsignal:offline-saved", refresh);
    window.addEventListener("boardsignal:refresh-complete", refresh);
    return () => {
      window.removeEventListener("boardsignal:offline-saved", refresh);
      window.removeEventListener("boardsignal:refresh-complete", refresh);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname.includes("/boardsignal/preview/")) setPreviewAccess(undefined);
    if (!pathname.includes("boardsignal/player-room")) {
      setActiveTab(undefined);
      setVisibleEntityId(undefined);
      return;
    }
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (["desk", "progress", "universe", "friends", "inbox", "profile"].includes(requested ?? "")) setActiveTab(requested!);
    else setActiveTab((current) => current ?? "desk");
  }, [pathname]);

  useEffect(() => {
    try { window.localStorage.setItem(continuityKey(user?.uid), JSON.stringify({ updatedAt: new Date().toISOString(), messages: messages.slice(-12) })); } catch { /* continuity is optional */ }
  }, [messages, user?.uid, continuityGeneration]);

  useEffect(() => {
    if (!open) return;
    setUnread(false);
    if (observation) rememberPrompt(user?.uid, observation.stateKey);
    setContextPrompt(undefined);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [observation, open, user?.uid]);

  const closePanel = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") closePanel(true); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closePanel, open]);

  const refreshObservation = useCallback(async () => {
    if (!connectivity.online || !eligiblePath(pathname)) { setObservation(undefined); return; }
    const previewMode = Boolean(previewAccess && !user && pathname.includes("/boardsignal/preview/"));
    const playerRoomMode = Boolean(user && pathname.includes("boardsignal/player-room"));
    if (!previewMode && !playerRoomMode) { setObservation(undefined); return; }
    try {
      const token = user ? await user.getIdToken() : "";
      const response = await fetch("/api/boardsignal/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          action: "observe",
          pathname,
          activeTab,
          visibleEntityId,
          ...(previewMode && previewAccess ? { mode: "beta_preview", previewRequestId: previewAccess.requestId, previewStatusToken: previewAccess.statusToken } : {}),
        }),
      });
      const body = await response.json() as { ok?: boolean; observation?: AskContextObservation; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Context unavailable");
      setObservation(body.observation);
    } catch {
      // Ambient context failure never becomes a BoardSignal failure state.
      setObservation(undefined);
    }
  }, [activeTab, connectivity.online, pathname, previewAccess, user, visibleEntityId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshObservation(); }, 120);
    return () => window.clearTimeout(timer);
  }, [contextRefresh, refreshObservation]);

  useEffect(() => {
    setContextPrompt(undefined);
    if (!observation?.prompt || open || promptAlreadyShown(user?.uid, observation.stateKey)) return;
    rememberPrompt(user?.uid, observation.stateKey);
    setContextPrompt(observation);
    const timer = window.setTimeout(() => setContextPrompt((current) => current?.stateKey === observation.stateKey ? undefined : current), 9000);
    return () => window.clearTimeout(timer);
  }, [observation, open, user?.uid]);

  const suggestions = useMemo(() => {
    if (!connectivity.online) return ["What can I use offline?", "What changed?", "What stays private?"];
    if (observation?.chips?.length) return observation.chips;
    if (previewAccess && !user) return ["Show me my week", "Explain my Universe preview", "What unlocks next?", "What stays private?"];
    return pageGuideSuggestions(pathname, activeTab, Boolean(user));
  }, [activeTab, connectivity.online, observation?.chips, pathname, previewAccess, user]);

  const callGuide = useCallback(async (message: string, conversationOverride?: ChatMessage[]) => {
    setBusy(true);
    setFailure(false);
    try {
      if (!connectivity.online) {
        const [saved, social] = user ? await Promise.all([loadPlayerRoomOfflineSnapshot(user.uid), loadSocialOfflineSnapshot(user.uid)]) : [undefined, undefined];
        const offlineResponse = conversationOverride
          ? buildOfflineGuideResponse({ message, pathname, activeTab, snapshot: saved, social, authenticated: Boolean(user), recentConversation: recentConversationForServer(conversationOverride) })
          : buildOfflineGuideResponse({ message, pathname, activeTab, snapshot: saved, social, authenticated: Boolean(user), recentConversation: recentConversationForServer(messagesRef.current) });
        const item: ChatMessage = { id: crypto.randomUUID(), sender: "guide" as const, body: offlineResponse.reply, response: offlineResponse };
        setMessages((current) => [...current, item].slice(-12));
        if (!open) setUnread(true);
        return offlineResponse;
      }
      const token = user ? await user.getIdToken() : "";
      const response = await fetch("/api/boardsignal/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: "ask", message, pathname, activeTab, visibleEntityId, recentConversation: recentConversationForServer(conversationOverride ?? messagesRef.current), ...(previewAccess && !user ? { mode: "beta_preview", previewRequestId: previewAccess.requestId, previewStatusToken: previewAccess.statusToken } : {}) }),
      });
      const body = await response.json() as { ok?: boolean; response?: GuideResponse; error?: string };
      if (!response.ok || !body.ok || !body.response) throw new Error(body.error ?? "Ask BoardSignal is unavailable right now.");
      const item: ChatMessage = { id: crypto.randomUUID(), sender: "guide" as const, body: body.response.reply, response: body.response };
      setMessages((current) => [...current, item].slice(-12));
      if (!open) setUnread(true);
      return body.response;
    } catch {
      setFailure(true);
      const item: ChatMessage = { id: crypto.randomUUID(), sender: "guide" as const, body: "Ask BoardSignal isn't available right now." };
      setMessages((current) => [...current, item].slice(-12));
      return undefined;
    } finally { setBusy(false); }
  }, [activeTab, connectivity.online, open, pathname, previewAccess, user, visibleEntityId]);

  async function send(value = input) {
    const message = value.trim();
    if (!message || busy) return;
    const item: ChatMessage = { id: crypto.randomUUID(), sender: "player" as const, body: message };
    const previous = messagesRef.current.at(-1);
    const negativeFeedback = isNegativeFeedbackPhrase(message);

    if (negativeFeedback && previous?.sender === "guide" && previous.response) {
      const clarificationContext = [...messagesRef.current];
      const shouldRecordFeedback = !previous.feedback && !feedbackHandledRef.current.has(previous.id);
      if (shouldRecordFeedback) feedbackHandledRef.current.add(previous.id);
      setMessages((current) => [
        ...current.map((entry) => entry.id === previous.id && !entry.feedback ? { ...entry, feedback: "unclear" as const } : entry),
        item,
      ].slice(-12));
      setInput("");
      if (shouldRecordFeedback) void feedback(false, previous.response);
      await callGuide("Explain that more simply.", clarificationContext);
      return;
    }

    if (negativeFeedback) {
      const clarification: ChatMessage = { id: crypto.randomUUID(), sender: "guide", body: "What would you like me to explain more simply?" };
      setMessages((current) => [...current, item, clarification].slice(-12));
      setInput("");
      return;
    }

    setMessages((current) => [...current, item].slice(-12));
    setInput("");
    await callGuide(message);
  }

  async function authenticatedAction(action: string, payload: Record<string, unknown>) {
    if (!user) throw new Error("Player authentication is required.");
    const token = await user.getIdToken();
    const response = await fetch("/api/boardsignal/guide", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, confirmed: true, pathname, activeTab, ...payload }),
    });
    const body = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? "Ask BoardSignal could not complete that action.");
  }

  async function runAction(action: GuideAction, source?: GuideResponse) {
    if (action.kind === "navigate" && action.href) { router.push(action.href); closePanel(false); return; }
    if (action.kind === "handoff") {
      if (!user) return;
      const offline = !connectivity.online;
      if (!window.confirm(offline ? "Save this message as a local draft for Ayanda until you reconnect?" : "Send this support request to Ayanda in your private BoardSignal conversation?")) return;
      const payloadBody = typeof action.payload?.body === "string" ? action.payload.body : undefined;
      const draftId = typeof action.payload?.draftId === "string" ? action.payload.draftId : undefined;
      const lastPlayerMessage = payloadBody ?? [...messages].reverse().find((item) => item.sender === "player")?.body ?? "I need help with BoardSignal.";
      setBusy(true);
      try {
        if (offline) {
          const now = new Date().toISOString();
          await saveOfflineDraft({ id: crypto.randomUUID(), uid: user.uid, kind: "guide-support", body: lastPlayerMessage, createdAt: now, updatedAt: now, pathname, activeTab });
          setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: "Saved locally. When you're back online, your message draft will be ready for you to review and send." }].slice(-12));
          return;
        }
        await authenticatedAction("handoff", { message: lastPlayerMessage, category: source?.category ?? "support_request" });
        if (draftId) await deleteOfflineDraft(user.uid, draftId).catch(() => undefined);
        setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: "Sent privately to Ayanda. You can continue the conversation from Inbox." }].slice(-12));
      } catch (reason) {
        setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: reason instanceof Error ? reason.message : "The support handoff could not be sent." }].slice(-12));
      } finally { setBusy(false); }
      return;
    }
    if (action.kind === "preference") {
      if (!connectivity.online) { setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: "Reconnect before changing Ask BoardSignal preferences." }].slice(-12)); return; }
      if (!window.confirm(`Confirm Ask BoardSignal preference: ${action.label}?`)) return;
      setBusy(true);
      try {
        await authenticatedAction("preference", action.payload ?? {});
        setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: `Saved. Ask BoardSignal will use ${action.label} as your confirmed tone preference.` }].slice(-12));
      } catch (reason) { setFailure(true); }
      finally { setBusy(false); }
      return;
    }
    if (action.kind === "tour") {
      if (!connectivity.online) { setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: "Tour progress is saved to your account when you're online. You can still explore the saved Player Room now." }].slice(-12)); return; }
      if (action.id === "release-later") {
        if (user) await authenticatedAction("state", { releaseHint: "dismiss" });
        setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: "Got it. I won't keep surfacing that release hint." }].slice(-12));
        return;
      }
      const tourState = action.id === "tour-start" ? "completed" : "dismissed";
      if (user) await authenticatedAction("state", { tourState });
      if (action.id === "tour-start") {
        setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: "Review → finished week. Progress → recent-four movement. Around BoardSignal → the field. Friends → Head-to-Head. Inbox + Ask BoardSignal → communication and help." }].slice(-12));
      } else setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "guide" as const, body: "No problem. I won't keep prompting the tour." }].slice(-12));
    }
  }

  async function feedback(helpful: boolean, response?: GuideResponse) {
    if (!user || !connectivity.online) return;
    try { await authenticatedAction("feedback", { helpful, category: response?.category ?? "general" }); } catch { /* feedback never blocks chat */ }
  }

  async function handleFeedback(messageId: string, helpful: boolean, response?: GuideResponse) {
    if (feedbackHandledRef.current.has(messageId)) return;
    const source = messagesRef.current.find((item) => item.id === messageId);
    if (!source || source.sender !== "guide" || source.feedback) return;
    feedbackHandledRef.current.add(messageId);
    const clarificationContext = [...messagesRef.current];
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, feedback: helpful ? "helpful" : "unclear" } : item));
    void feedback(helpful, response);
    if (!helpful) await callGuide("Explain that more simply.", clarificationContext);
  }

  if (!eligiblePath(pathname)) return null;
  const opener = observation?.opener.reply ?? "What do you want to understand?";
  const openerProvenance = observation?.opener ? provenanceLabel(observation.opener) : "";

  return <div className={`ask-bs ${open ? "is-open" : ""}`}>
    {!open && contextPrompt?.prompt ? <div
      className="ask-bs-context-prompt bs-motion-observation-change bs-surface-paper"
      aria-label="Ask BoardSignal suggestion"
      style={{
        pointerEvents: "auto",
        position: "absolute",
        right: 0,
        bottom: "58px",
        width: "min(306px, calc(100vw - 16px))",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 44px",
        gap: ".35rem",
        alignItems: "center",
        padding: ".55rem",
        border: "1px solid var(--bs-ui-border)",
        borderRadius: "12px",
        boxShadow: "var(--bs-shadow-1)",
        color: "var(--bs-text)",
      }}
    >
      <button
        type="button"
        onClick={() => { rememberPrompt(user?.uid, contextPrompt.stateKey); setContextPrompt(undefined); setOpen(true); }}
        style={{ minHeight: "44px", border: 0, background: "transparent", color: "var(--bs-text)", textAlign: "left", padding: ".35rem .45rem", fontWeight: 800, cursor: "pointer" }}
      >{contextPrompt.prompt}</button>
      <button
        type="button"
        aria-label="Dismiss Ask BoardSignal suggestion"
        onClick={() => setContextPrompt(undefined)}
        style={{ width: "44px", height: "44px", display: "grid", placeItems: "center", border: "1px solid var(--bs-ui-border)", borderRadius: "50%", background: "var(--bs-surface)", color: "var(--bs-text)", cursor: "pointer" }}
      ><X size={17}/></button>
    </div> : null}

    {open ? <div className="ask-bs-panel bs-surface-paper" ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="ask-bs-title">
      <header className="ask-bs-header bs-surface-dark"><div><span>BOARD SIGNAL</span><h2 id="ask-bs-title">Ask BoardSignal</h2><p>{user ? "Verified context, explained" : "Product guide"}</p></div><button type="button" className="ask-bs-close" aria-label="Close Ask BoardSignal" onClick={() => closePanel(true)}><X size={20}/></button></header>
      <div className="ask-bs-messages" aria-live="polite" aria-relevant="additions text">
        {!messages.length ? <div className="ask-bs-welcome"><MessageCircle size={22}/><strong>{opener}</strong>{openerProvenance ? <small style={{ display: "block", marginTop: ".35rem", color: "var(--bs-text-muted)", fontSize: ".68rem", fontWeight: 800, letterSpacing: ".04em" }}>{openerProvenance}</small> : null}<p>I explain verified BoardSignal context and help you find the useful part. I don't create new chess analysis.</p></div> : null}
        {messages.map((message, index) => <div key={message.id} className={`ask-bs-message ${message.sender === "player" ? "from-player" : "from-guide"}`}><p>{message.body}</p>{message.sender === "guide" && provenanceLabel(message.response) ? <small style={{ display: "block", marginTop: ".35rem", color: "var(--bs-text-muted)", fontSize: ".66rem", fontWeight: 800, letterSpacing: ".035em" }}>{provenanceLabel(message.response)}</small> : null}{message.sender === "guide" && message.response?.actions?.length ? <div className="ask-bs-actions">{message.response.actions.map((action) => <button key={action.id} type="button" onClick={() => void runAction(action, message.response)}>{action.label}</button>)}</div> : null}{message.sender === "guide" && message.feedback ? <div className="ask-bs-feedback" role="status"><span>{message.feedback === "helpful" ? "Got it." : "I'll explain that more simply."}</span></div> : message.sender === "guide" && message.response && index === messages.length - 1 && messages.filter((item) => item.sender === "guide" && item.response).length % 3 === 0 && user ? <div className="ask-bs-feedback"><span>Was that clear?</span><button type="button" onClick={() => void handleFeedback(message.id, true, message.response)}>Yes</button><button type="button" onClick={() => void handleFeedback(message.id, false, message.response)}>Not really</button></div> : null}</div>)}
        {busy ? <div className="ask-bs-thinking"><LoaderCircle className="button-spinner" size={16}/> Checking BoardSignal facts</div> : null}
        {failure ? <div className="ask-bs-failure" role="alert"><strong>Ask BoardSignal isn't available right now.</strong><div><Link href="/boardsignal/player-room?tab=inbox">Open Inbox</Link>{user ? <button type="button" onClick={() => void runAction({ id: "handoff", label: "Message Ayanda", kind: "handoff", requiresConfirmation: true })}>Message Ayanda</button> : null}</div></div> : null}
      </div>
      <div className="ask-bs-suggestions" aria-label="Suggested questions">{suggestions.slice(0, 4).map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => void send(suggestion)}>{suggestion}</button>)}</div>
      <form className="ask-bs-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="ask-bs-input">Ask BoardSignal</label><input ref={inputRef} id="ask-bs-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={1200} placeholder="Ask about this page or your BoardSignal…"/><button type="submit" aria-label="Send to Ask BoardSignal" disabled={busy || !input.trim()}><Send size={18}/></button></form>
    </div> : null}
    <button ref={launcherRef} type="button" className="ask-bs-launcher bs-surface-dark" aria-label={open ? "Close Ask BoardSignal" : "Open Ask BoardSignal"} aria-expanded={open} onClick={() => open ? closePanel(false) : setOpen(true)}><HelpCircle size={20}/><span>Ask BoardSignal</span>{unread && !open ? <b aria-label="New Ask BoardSignal response">1</b> : null}</button>
  </div>;
}
