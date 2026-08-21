"use client";

import { LoaderCircle, MessageCircle, RefreshCcw, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SocialPlayerCard } from "@/lib/boardsignal/social";
import type { BoardSignalFriendConversationView, BoardSignalFriendMessageView } from "@/lib/boardsignal/friendChat";
import type { BoardSignalAttachmentDraft } from "@/components/BoardSignalChatAttachment";
import { BoardSignalAttachmentComposer, BoardSignalChatAttachmentRenderer } from "@/components/BoardSignalChatAttachment";
import styles from "./FriendConversation.module.css";

export default function FriendConversation({
  uid,
  token,
  friend,
  online,
  onClose,
}: {
  uid: string;
  token: string;
  friend: SocialPlayerCard;
  online: boolean;
  onClose: () => void;
}) {
  const [conversation, setConversation] = useState<BoardSignalFriendConversationView>();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<BoardSignalAttachmentDraft>();
  const [uploadBusy, setUploadBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const clientMessageId = useRef(crypto.randomUUID());
  const onlineRef = useRef(online);
  const sendAttemptRef = useRef(0);

  useEffect(() => {
    onlineRef.current = online;
    if (!online) {
      sendAttemptRef.current += 1;
      setLoading(false);
      setSending(false);
      setUploadBusy(false);
    }
  }, [online]);

  const load = useCallback(async () => {
    if (!onlineRef.current) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/boardsignal/friend-chat?playerId=${encodeURIComponent(String(friend.playerId))}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json() as { ok?: boolean; conversation?: BoardSignalFriendConversationView; error?: string };
      if (!response.ok || !result.ok || !result.conversation) throw new Error(result.error ?? "Private friend conversation could not be loaded.");
      if (onlineRef.current) setConversation(result.conversation);
    } catch (reason) {
      if (onlineRef.current) setError(reason instanceof Error ? reason.message : "Private friend conversation could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [friend.playerId, token]);

  useEffect(() => { if (online) void load(); else setLoading(false); }, [load, online]);
  useEffect(() => {
    setBody("");
    setAttachment(undefined);
    clientMessageId.current = crypto.randomUUID();
  }, [friend.playerId, uid]);

  function contentChanged() {
    clientMessageId.current = crypto.randomUUID();
  }

  async function send() {
    if (!onlineRef.current) { setError("Reconnect to send this friend message. Nothing was sent or queued."); return; }
    if (sending || uploadBusy || (!body.trim() && !attachment)) return;
    const attempt = sendAttemptRef.current + 1;
    sendAttemptRef.current = attempt;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/boardsignal/friend-chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "send",
          playerId: friend.playerId,
          body: body.trim(),
          attachment: attachment?.attachment,
          clientMessageId: clientMessageId.current,
        }),
      });
      const result = await response.json() as { ok?: boolean; message?: BoardSignalFriendMessageView; error?: string };
      if (!response.ok || !result.ok || !result.message) throw new Error(result.error ?? "Message wasn't sent.");
      if (!onlineRef.current || sendAttemptRef.current !== attempt) throw new Error("Connection was lost before BoardSignal could confirm the message. Refresh after reconnecting before retrying.");
      setConversation((current) => current ? { ...current, messages: [...current.messages.filter((item) => item.id !== result.message!.id), result.message!] } : current);
      setBody("");
      setAttachment(undefined);
      clientMessageId.current = crypto.randomUUID();
    } catch (reason) {
      if (sendAttemptRef.current === attempt || !onlineRef.current) setError(reason instanceof Error ? reason.message : "Message wasn't sent.");
    } finally {
      if (sendAttemptRef.current === attempt) setSending(false);
    }
  }

  return <section className={styles.panel} aria-label={`Private conversation with ${friend.canonicalUsername}`}>
    <header className={styles.header}>
      <div><span>PRIVATE FRIEND MESSAGE</span><h3>{friend.canonicalUsername}</h3><p>Only accepted friends can read or send here. Private Signals and evidence are not shared.</p></div>
      <button type="button" className="button button-quiet" onClick={onClose} aria-label={`Close conversation with ${friend.canonicalUsername}`}><X size={16}/></button>
    </header>
    {!online ? <p className={styles.offline}><strong>NETWORK REQUIRED.</strong> Existing rendered messages are saved in memory for this open session only and are stale/read-only. Reconnect to load, mark or send messages. Attachments are online only.</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.messages}>
      {loading && online ? <div className={styles.empty}><LoaderCircle className="button-spinner" size={16}/> Loading private messages</div> : null}
      {!loading && !conversation?.messages.length ? <div className={styles.empty}><MessageCircle size={18}/><p>{online ? "No messages yet. Start with a text, image or PDF." : "Reconnect to load this private conversation."}</p></div> : null}
      {conversation?.messages.map((message) => {
        const mine = message.senderUid === uid;
        return <article key={message.id} className={`${styles.message} ${mine ? styles.mine : ""}`}>
          <span>{mine ? "You" : friend.canonicalUsername}{!online ? " · SAVED" : ""}</span>
          {message.body ? <p>{message.body}</p> : null}
          <BoardSignalChatAttachmentRenderer attachment={message.attachment}/>
          <small>{new Date(message.createdAt).toLocaleString()}</small>
        </article>;
      })}
    </div>
    <div className={styles.composer}>
      <label htmlFor={`friend-message-${friend.playerId}`}>Message {friend.canonicalUsername}</label>
      <textarea
        id={`friend-message-${friend.playerId}`}
        value={body}
        rows={3}
        maxLength={2000}
        disabled={!online || sending}
        onChange={(event) => { setBody(event.target.value); contentChanged(); }}
        placeholder={online ? "Write a private message…" : "Reconnect to send a message"}
      />
      <BoardSignalAttachmentComposer
        value={attachment}
        onChange={(next) => { setAttachment(next); contentChanged(); }}
        onBusyChange={setUploadBusy}
        onError={setError}
        authHeader={`Bearer ${token}`}
        offline={!online}
        disabled={!online || sending}
        resetKey={`${uid}:${friend.playerId}`}
      />
      <div className={styles.actions}>
        <button type="button" className="button button-quiet" onClick={load} disabled={!online || loading || sending}><RefreshCcw size={14}/> Refresh</button>
        <button type="button" className="button button-lime" onClick={send} disabled={!online || sending || uploadBusy || (!body.trim() && !attachment)}>{sending ? <><LoaderCircle className="button-spinner" size={14}/> Sending</> : <><Send size={14}/> Send</>}</button>
      </div>
    </div>
  </section>;
}
