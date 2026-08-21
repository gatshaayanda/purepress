"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, MessageCircle, Send } from "lucide-react";
import type { BoardSignalConversationMessage, BoardSignalInboxMessage } from "@/lib/boardsignal/communications";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";
import type { BoardSignalChatAttachmentView } from "@/lib/boardsignal/chatAttachments";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";
import {
  BoardSignalAttachmentComposer,
  BoardSignalChatAttachmentRenderer,
  type BoardSignalAttachmentDraft,
} from "@/components/BoardSignalChatAttachment";

type InboxMessageView = Omit<BoardSignalInboxMessage, "attachment"> & { attachment?: BoardSignalChatAttachmentView };
type ConversationMessageView = Omit<BoardSignalConversationMessage, "attachment"> & { attachment?: BoardSignalChatAttachmentView };
type InboxResponse = { ok: boolean; inbox?: { messages: InboxMessageView[]; unreadCount: number }; error?: string };
type ConversationResponse = { ok: boolean; conversation?: { messages: ConversationMessageView[] }; error?: string };

export default function PlayerInbox({ token, onUnreadChange }: { token: string; onUnreadChange?: (count: number) => void }) {
  const connectivity = useBoardSignalConnectivity();
  const [messages, setMessages] = useState<InboxMessageView[]>([]);
  const [selected, setSelected] = useState<InboxMessageView | null>(null);
  const [conversation, setConversation] = useState<ConversationMessageView[]>([]);
  const [reply, setReply] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<BoardSignalAttachmentDraft>();
  const [uploadBusy, setUploadBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clientMessageId = useRef(crypto.randomUUID());
  const onlineRef = useRef(connectivity.online);

  useEffect(() => {
    onlineRef.current = connectivity.online;
    if (!connectivity.online) {
      // Never leave a network spinner running after the product has entered SAVED mode.
      setLoading(false);
      setBusy(false);
      setUploadBusy(false);
    }
  }, [connectivity.online]);

  const load = useCallback(async () => {
    if (!onlineRef.current) { setLoading(false); setError(""); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/boardsignal/inbox", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await response.json() as InboxResponse;
      if (!response.ok || !body.ok || !body.inbox) throw new Error(body.error ?? "Inbox could not be loaded.");
      if (!onlineRef.current) return;
      setMessages(body.inbox.messages);
      onUnreadChange?.(body.inbox.unreadCount);
    } catch (reason) {
      if (onlineRef.current) setError(reason instanceof Error ? reason.message : "Inbox could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange, token]);

  useEffect(() => { if (connectivity.online) void load(); }, [connectivity.online, load]);
  useEffect(() => {
    setSelected(null);
    setConversation([]);
    setReply("");
    setReplyAttachment(undefined);
    clientMessageId.current = crypto.randomUUID();
  }, [token]);

  async function openMessage(message: InboxMessageView) {
    setSelected(message);
    setReply("");
    setReplyAttachment(undefined);
    clientMessageId.current = crypto.randomUUID();
    setError("");
    if (!onlineRef.current) return; // rendered memory may remain readable, but no read sync/fetch occurs offline.
    setConversation([]);
    if (!message.readAt) {
      await fetch("/api/boardsignal/inbox", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", messageId: message.id }),
      });
      if (!onlineRef.current) return;
      await load();
    }
    if (message.threadId && onlineRef.current) {
      const response = await fetch(`/api/boardsignal/inbox?threadId=${encodeURIComponent(message.threadId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await response.json() as ConversationResponse;
      if (onlineRef.current && response.ok && body.ok && body.conversation) setConversation(body.conversation.messages);
    }
  }

  function replyChanged() {
    clientMessageId.current = crypto.randomUUID();
  }

  async function sendReply() {
    if (!selected?.threadId || busy || uploadBusy || (!reply.trim() && !replyAttachment)) return;
    if (!onlineRef.current) { setError("Reconnect to send this message. Nothing has been sent."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/boardsignal/inbox", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          threadId: selected.threadId,
          body: reply.trim(),
          attachment: replyAttachment?.attachment,
          clientMessageId: clientMessageId.current,
        }),
      });
      const body = await response.json() as { ok: boolean; message?: ConversationMessageView; error?: string };
      if (!response.ok || !body.ok || !body.message) throw new Error(body.error ?? "Message wasn't sent.");
      if (!onlineRef.current) throw new Error("Connection was lost before BoardSignal could confirm the message. Refresh after reconnecting before retrying.");
      setConversation((items) => [...items.filter((item) => item.id !== body.message!.id), body.message!]);
      setReply("");
      setReplyAttachment(undefined);
      clientMessageId.current = crypto.randomUUID();
    } catch (reason) {
      // A failed/interrupted send is never represented as delivered. No offline send queue exists.
      setError(reason instanceof Error ? reason.message : "Message wasn't sent.");
    } finally {
      setBusy(false);
    }
  }

  const networkRequired = !connectivity.online;

  return (
    <section className="player-inbox-section">
      <div className="room-section-heading"><div><p className="kicker">INBOX</p><h2>BoardSignal messages</h2><p>Review updates, Universe achievements, founder notes and BoardSignal feedback requests stay inside your private My BoardSignal.</p></div><button type="button" className="button button-quiet" onClick={load} disabled={networkRequired || loading}>Refresh</button></div>
      {networkRequired ? <div className="offline-action-note" role="status"><strong>NETWORK REQUIRED</strong> · Inbox needs a connection. Anything already rendered here is stale and read-only until BoardSignal reconnects.</div> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {loading && !networkRequired ? <div className="founder-directory-loading"><LoaderCircle className="button-spinner" /> Loading Inbox</div> : null}
      {!loading && !messages.length ? <div className="inbox-empty"><MessageCircle size={22} /><div><strong>{networkRequired ? "Reconnect to load Inbox." : "Your Inbox is clear."}</strong><p>{networkRequired ? "BoardSignal does not cache full private message history offline." : "BoardSignal will put important account and Review messages here."}</p></div></div> : null}
      {messages.length ? <div className="player-inbox-layout">
        <div className="player-inbox-list">{messages.map((message) => <button type="button" key={message.id} className={`inbox-list-item ${!message.readAt ? "is-unread" : ""} ${selected?.id === message.id ? "is-selected" : ""}`} onClick={() => void openMessage(message)}><span>{boardSignalPresentationLabel(message.type)}{networkRequired ? " · SAVED" : ""}</span><strong>{message.title}</strong><small>{new Date(message.createdAt).toLocaleString()}</small>{message.attachment ? <small>{message.attachment.kind === "image" ? "Image attached" : "PDF attached"}</small> : null}{!message.readAt ? <i aria-label="Unread">Unread</i> : null}</button>)}</div>
        <article className="player-message-reader">{selected ? <><p className="kicker">{selected.senderType === "founder" ? "FROM AYANDA · FOUNDER" : "BOARDSIGNAL"}{networkRequired ? " · SAVED" : ""}</p><h3>{selected.title}</h3>{selected.body ? <p>{selected.body}</p> : null}<BoardSignalChatAttachmentRenderer attachment={selected.attachment}/>{selected.link && !networkRequired ? <Link className="text-link" href={selected.link}>{selected.actionLabel ?? "Open"} <ArrowRight size={14} /></Link> : null}{selected.threadId ? <div className="conversation-thread">{conversation.map((item) => <div key={item.id} className={`conversation-message ${item.senderType}`}><span>{item.senderType === "player" ? "You" : "Ayanda"}</span>{item.body ? <p>{item.body}</p> : null}<BoardSignalChatAttachmentRenderer attachment={item.attachment}/><small>{new Date(item.createdAt).toLocaleString()}</small></div>)}</div> : null}{selected.allowReply && selected.threadId ? <div className="conversation-reply"><label htmlFor="player-reply">Reply privately</label><textarea id="player-reply" value={reply} onChange={(event) => { setReply(event.target.value); replyChanged(); }} maxLength={2000} rows={4} disabled={busy || networkRequired} /><BoardSignalAttachmentComposer value={replyAttachment} onChange={(next) => { setReplyAttachment(next); replyChanged(); }} onBusyChange={setUploadBusy} onError={setError} authHeader={`Bearer ${token}`} offline={networkRequired} disabled={busy || networkRequired} resetKey={`${token}:${selected.threadId}`} />{networkRequired ? <small>Reconnect to reply or attach a file. Nothing is queued or sent offline.</small> : null}<button type="button" className="button button-lime" onClick={sendReply} disabled={networkRequired || busy || uploadBusy || (!reply.trim() && !replyAttachment)}>{busy ? <><LoaderCircle className="button-spinner" size={14} /> Sending</> : <><Send size={14} /> Reply</>}</button></div> : null}</> : <div className="inbox-reader-placeholder"><MessageCircle size={22} /><p>Select a message to read it.</p></div>}</article>
      </div> : null}
    </section>
  );
}
