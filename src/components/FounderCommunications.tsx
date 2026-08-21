"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Clipboard, LoaderCircle, MessageCircle, Send, Users } from "lucide-react";
import type {
  BoardSignalMessageType,
  CommunicationAudienceKind,
  CommunicationCampaignDraft,
  CommunicationSegment,
} from "@/lib/boardsignal/communications";
import type { BoardSignalChatAttachment, BoardSignalChatAttachmentView } from "@/lib/boardsignal/chatAttachments";
import {
  BoardSignalAttachmentComposer,
  BoardSignalChatAttachmentRenderer,
  type BoardSignalAttachmentDraft,
} from "@/components/BoardSignalChatAttachment";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";

type PlayerOption = { uid: string; username: string };
type PreviewPlayer = PlayerOption & { preferredContactMethod?: string; preferredContactValue?: string };
type CampaignRow = {
  id: string;
  title: string;
  type: BoardSignalMessageType;
  createdAt: string;
  audienceCount: number;
  sentCount: number;
  readCount?: number;
  pushEligibleCount?: number;
  pushDelivered?: number;
  pushFailed?: number;
  emailEligibleCount?: number;
  emailDelivered?: number;
  emailFailed?: number;
  attachment?: BoardSignalChatAttachment;
};
type ConversationRow = {
  id: string;
  userId: string;
  username: string;
  title: string;
  updatedAt: string;
  unreadForFounder?: boolean;
  allowReply?: boolean;
};
type ConversationMessage = { id: string; body: string; senderType: "founder" | "player"; createdAt: string; attachment?: BoardSignalChatAttachmentView };

type DeliveryStatus = {
  inApp: true;
  browserPushConfigured: boolean;
  emailConfigured: boolean;
  emailProvider: "resend" | "none";
  registeredDevices?: number;
};

type Overview = { ok: boolean; campaigns?: CampaignRow[]; conversations?: ConversationRow[]; players?: PlayerOption[]; deliveryStatus?: DeliveryStatus; error?: string };

const messageTypes: Array<[BoardSignalMessageType, string]> = [
  ["desk_ready", "Review Ready"],
  ["episode_update", "Episode Update"],
  ["blue_reminder", "Blue Reminder"],
  ["universe_achievement", "Universe Achievement"],
  ["beta_update", "BoardSignal Update"],
  ["feedback_request", "Feedback Request"],
  ["custom", "Custom"],
];

const segments: Array<[CommunicationSegment, string]> = [
  ["new_players", "New players"],
  ["desk_ready", "Review ready"],
  ["episode_forming", "Episode forming"],
  ["latest_desk_not_opened", "Latest Review not opened"],
  ["blue_available", "Blue available"],
  ["universe_top3", "Universe Top 3"],
  ["inactive_recently", "Inactive recently"],
  ["pending_feedback", "Pending feedback"],
];

export default function FounderCommunications() {
  const connectivity = useBoardSignalConnectivity();
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [audienceKind, setAudienceKind] = useState<CommunicationAudienceKind>("one");
  const [selected, setSelected] = useState<string[]>([]);
  const [segment, setSegment] = useState<CommunicationSegment>("new_players");
  const [type, setType] = useState<BoardSignalMessageType>("custom");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [allowReply, setAllowReply] = useState(true);
  const [browserPush, setBrowserPush] = useState(false);
  const [email, setEmail] = useState(false);
  const [manualContact, setManualContact] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>({ inApp: true, browserPushConfigured: false, emailConfigured: false, emailProvider: "none" });
  const [preview, setPreview] = useState<{ audienceCount: number; pushEligibleCount: number; emailEligibleCount: number; users?: PreviewPlayer[] } | null>(null);
  const [sending, setSending] = useState(false);
  const [campaignAttachment, setCampaignAttachment] = useState<BoardSignalAttachmentDraft>();
  const [campaignUploadBusy, setCampaignUploadBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeThread, setActiveThread] = useState<ConversationRow | null>(null);
  const [threadMessages, setThreadMessages] = useState<ConversationMessage[]>([]);
  const [reply, setReply] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<BoardSignalAttachmentDraft>();
  const [replyUploadBusy, setReplyUploadBusy] = useState(false);
  const replyClientMessageId = useRef(crypto.randomUUID());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/communications", { cache: "no-store" });
      const data = await response.json() as Overview;
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Founder Communications could not be loaded.");
      setPlayers(data.players ?? []);
      setCampaigns(data.campaigns ?? []);
      setConversations(data.conversations ?? []);
      if (data.deliveryStatus) setDeliveryStatus(data.deliveryStatus);
      if (!selected.length && data.players?.[0]) setSelected([data.players[0].uid]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Founder Communications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [selected.length]);

  useEffect(() => { void load(); }, [load]);

  const draft = useMemo<CommunicationCampaignDraft>(() => ({
    audienceKind,
    userIds: audienceKind === "one" ? selected.slice(0, 1) : audienceKind === "selected" ? selected : undefined,
    segment: audienceKind === "segment" ? segment : undefined,
    type,
    title,
    body,
    link: link.trim() || undefined,
    actionLabel: link.trim() ? "Open" : undefined,
    allowReply,
    ...(campaignAttachment ? { attachment: campaignAttachment.attachment } : {}),
    channels: {
      inApp: true,
      browserPush,
      externalContactManual: manualContact,
      email,
    },
  }), [allowReply, audienceKind, body, browserPush, campaignAttachment, email, link, manualContact, segment, selected, title, type]);

  async function campaignAction(action: "preview" | "send") {
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/boardsignal/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action, draft }),
      });
      const data = await response.json() as { ok: boolean; preview?: { audienceCount: number; pushEligibleCount: number; emailEligibleCount: number; users?: PreviewPlayer[] }; campaign?: CampaignRow; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? `Message ${action} failed.`);
      if (action === "preview" && data.preview) setPreview(data.preview);
      if (action === "send" && data.campaign) {
        setPreview((current) => ({ audienceCount: data.campaign!.audienceCount, pushEligibleCount: data.campaign!.pushEligibleCount ?? 0, emailEligibleCount: data.campaign!.emailEligibleCount ?? 0, users: current?.users }));
        setNotice(`In-app sent: ${data.campaign.sentCount}. Push delivered: ${data.campaign.pushDelivered ?? 0}${(data.campaign.pushFailed ?? 0) ? ` · failed: ${data.campaign.pushFailed}` : ""}. Email delivered: ${data.campaign.emailDelivered ?? 0}${(data.campaign.emailFailed ?? 0) ? ` · failed: ${data.campaign.emailFailed}` : ""}.`);
        setCampaignAttachment(undefined);
        if (!manualContact) { setTitle(""); setBody(""); setLink(""); }
        await load();
      }
    } catch (reason) {
      // Keep the uploaded draft visible after an ambiguous send failure so the Founder can
      // deliberately retry/remove it instead of silently orphaning a completed upload.
      setError(reason instanceof Error ? reason.message : `Message ${action} failed.`);
    } finally {
      setSending(false);
    }
  }

  async function openThread(thread: ConversationRow) {
    setActiveThread(thread);
    setThreadMessages([]);
    setReply("");
    setReplyAttachment(undefined);
    replyClientMessageId.current = crypto.randomUUID();
    setError("");
    try {
      const response = await fetch(`/api/admin/boardsignal/communications?uid=${encodeURIComponent(thread.userId)}&threadId=${encodeURIComponent(thread.id)}`, { cache: "no-store" });
      const data = await response.json() as { ok: boolean; conversation?: { messages: ConversationMessage[] }; error?: string };
      if (!response.ok || !data.ok || !data.conversation) throw new Error(data.error ?? "Conversation could not be loaded.");
      setThreadMessages(data.conversation.messages);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversation could not be loaded.");
    }
  }

  function replyChanged() {
    replyClientMessageId.current = crypto.randomUUID();
  }

  async function sendReply() {
    if (!activeThread || sending || replyUploadBusy || (!reply.trim() && !replyAttachment)) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          uid: activeThread.userId,
          threadId: activeThread.id,
          body: reply.trim(),
          attachment: replyAttachment?.attachment,
          clientMessageId: replyClientMessageId.current,
        }),
      });
      const data = await response.json() as { ok: boolean; result?: { message: ConversationMessage }; error?: string };
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? "Message wasn't sent.");
      setThreadMessages((items) => [...items.filter((item) => item.id !== data.result!.message.id), data.result!.message]);
      setReply("");
      setReplyAttachment(undefined);
      replyClientMessageId.current = crypto.randomUUID();
      await load();
    } catch (reason) {
      // Preserve the attachment for the same idempotent reply request when the response is ambiguous.
      setError(reason instanceof Error ? reason.message : "Message wasn't sent.");
    } finally {
      setSending(false);
    }
  }

  function togglePlayer(uid: string) {
    setSelected((items) => items.includes(uid) ? items.filter((item) => item !== uid) : [...items, uid]);
  }

  function loadFriendsRivalsReleaseDraft() {
    setAudienceKind("all_active_beta");
    setSelected([]);
    setType("beta_update");
    setTitle("BoardSignal update — Friends & Rivals are here");
    setBody("Connect with other BoardSignal players, compare your recent Reviews, see who's closing the gap and follow Head-to-Head movement as new weeks land.");
    setLink("/boardsignal/player-room?tab=friends");
    setAllowReply(false);
    setBrowserPush(false);
    setEmail(false);
    setManualContact(false);
    setCampaignAttachment(undefined);
    setPreview(null);
    setNotice("Friends & Rivals release draft loaded. Preview it before sending after Production release.");
  }

  async function sendTestBrowserAlert() {
    const uid = audienceKind === "one" ? selected[0] : undefined;
    if (!uid) { setError("Select exactly one player before sending a test browser alert."); return; }
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/boardsignal/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "testPush", uid }),
      });
      const data = await response.json() as { ok: boolean; result?: { status: "delivered" | "failed" | "not_eligible"; delivered: number; failed: number; reason?: string }; error?: string };
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? "Test browser alert failed.");
      if (data.result.status === "delivered") setNotice(`TEST browser alert delivered to ${data.result.delivered} registered device${data.result.delivered === 1 ? "" : "s"}.`);
      else setError(`TEST browser alert ${data.result.status === "not_eligible" ? "not eligible" : "failed"}: ${data.result.reason ?? "No delivery was confirmed."}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Test browser alert failed.");
    } finally { setSending(false); }
  }

  async function copyExternalMessage() {
    const attachmentLine = campaignAttachment ? `[Attachment in BoardSignal: ${campaignAttachment.attachment.name}]` : "";
    const text = [title.trim(), body.trim(), attachmentLine, link.trim()].filter(Boolean).join("\n\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setNotice("External message copied. The attachment itself remains inside authorized BoardSignal messaging.");
    } catch {
      setError("The message could not be copied automatically. Select the text and copy it manually.");
    }
  }

  const campaignHasContent = Boolean(body.trim() || campaignAttachment);

  return <>
    <section className="desk-section founder-composer">
      <div className="room-section-heading"><div><p className="kicker">COMMUNICATIONS</p><h2>Send a BoardSignal message</h2><p>In-app delivery is always available. Add one image or PDF when useful. Browser push and email receive safe message wording only—never an attachment URL.</p></div><button className="button button-outline" type="button" onClick={loadFriendsRivalsReleaseDraft}>Load Friends & Rivals release draft</button></div>
      <div className="founder-composer-grid">
        <div className="composer-field"><label htmlFor="audience-kind">Audience</label><select id="audience-kind" value={audienceKind} onChange={(event) => { setAudienceKind(event.target.value as CommunicationAudienceKind); setPreview(null); }}><option value="one">One player</option><option value="selected">Selected players</option><option value="all_active_beta">All active players</option><option value="segment">Segment</option></select></div>
        {audienceKind === "segment" ? <div className="composer-field"><label htmlFor="segment">Segment</label><select id="segment" value={segment} onChange={(event) => setSegment(event.target.value as CommunicationSegment)}>{segments.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div> : null}
        {(audienceKind === "one" || audienceKind === "selected") ? <fieldset className="composer-player-select"><legend>{audienceKind === "one" ? "Player" : "Players"}</legend>{players.map((player) => <label key={player.uid}><input type={audienceKind === "one" ? "radio" : "checkbox"} name={audienceKind === "one" ? "player" : undefined} checked={selected.includes(player.uid)} onChange={() => audienceKind === "one" ? setSelected([player.uid]) : togglePlayer(player.uid)} /> {player.username}</label>)}</fieldset> : null}
        <div className="composer-field"><label htmlFor="message-type">Message type</label><select id="message-type" value={type} onChange={(event) => setType(event.target.value as BoardSignalMessageType)}>{messageTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="composer-field wide"><label htmlFor="campaign-title">Title</label><input id="campaign-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} /></div>
        <div className="composer-field wide"><label htmlFor="campaign-body">Message</label><textarea id="campaign-body" value={body} onChange={(event) => setBody(event.target.value)} rows={6} maxLength={4000} /></div>
        <div className="composer-field wide"><BoardSignalAttachmentComposer value={campaignAttachment} onChange={(next) => { setCampaignAttachment(next); setPreview(null); }} onBusyChange={setCampaignUploadBusy} onError={setError} offline={!connectivity.online} disabled={sending} resetKey="founder:campaign" /></div>
        <div className="composer-field wide"><label htmlFor="campaign-link">Optional BoardSignal link/action</label><input id="campaign-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="/boardsignal/player-room" maxLength={500} /></div>
      </div>
      <div className="campaign-channel-options"><label><input type="checkbox" checked disabled /> In-app</label><label><input type="checkbox" checked={browserPush} disabled={!deliveryStatus.browserPushConfigured} onChange={(event) => setBrowserPush(event.target.checked)} /> Browser push if granted</label><label><input type="checkbox" checked={email} disabled={!deliveryStatus.emailConfigured} onChange={(event) => setEmail(event.target.checked)} /> Email if consented</label><label><input type="checkbox" checked={manualContact} onChange={(event) => setManualContact(event.target.checked)} /> External contact — manual/copy</label><label><input type="checkbox" checked={allowReply} onChange={(event) => setAllowReply(event.target.checked)} /> Allow private replies</label><span>Push: {deliveryStatus.browserPushConfigured ? "ready" : "configuration required"} · Email: {deliveryStatus.emailConfigured ? "ready" : "configuration required"}</span></div>
      {preview ? <><div className="campaign-preview-metrics"><div><span>Audience</span><strong>{preview.audienceCount}</strong></div><div><span>Push eligible</span><strong>{preview.pushEligibleCount}</strong></div><div><span>Email eligible</span><strong>{preview.emailEligibleCount}</strong></div></div>{campaignAttachment ? <p className="quality-reference">Attachment: {campaignAttachment.attachment.kind === "pdf" ? "PDF" : "Image"} · {campaignAttachment.attachment.name}. Uploaded once and referenced by the recipient projections.</p> : null}{manualContact ? <div className="manual-contact-preview"><div><strong>External contact — manual</strong><p>Contact details stay private and are shown only where the player consented to BoardSignal communication.</p></div><button className="button button-outline" type="button" onClick={copyExternalMessage}><Clipboard size={15} /> Copy external message</button><div className="manual-contact-list">{preview.users?.length ? preview.users.map((player) => <div key={player.uid}><strong>{player.username}</strong><span>{player.preferredContactMethod && player.preferredContactValue ? `${player.preferredContactMethod}: ${player.preferredContactValue}` : "No consented external contact available"}</span></div>) : <p>No preview contacts are available.</p>}</div></div> : null}</> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="form-success" role="status">{notice}</p> : null}
      <div className="composer-actions"><button className="button button-outline" type="button" onClick={() => campaignAction("preview")} disabled={sending || campaignUploadBusy || !title.trim() || !campaignHasContent}><Users size={15} /> Preview</button>{audienceKind === "one" && selected.length === 1 ? <button className="button button-outline" type="button" onClick={sendTestBrowserAlert} disabled={sending || !deliveryStatus.browserPushConfigured}><BellRing size={15} /> Send test browser alert</button> : null}<button className="button button-lime" type="button" onClick={() => campaignAction("send")} disabled={sending || campaignUploadBusy || !title.trim() || !campaignHasContent}>{sending ? <><LoaderCircle className="button-spinner" size={15} /> Sending</> : <><Send size={15} /> Send</>}</button></div>
    </section>

    <section className="desk-section founder-conversations"><div className="room-section-heading"><div><p className="kicker">REPLIES / CONVERSATIONS</p><h2>Founder ↔ player</h2><p>Private individual threads only. No public group chat is created.</p></div></div>{loading ? <div className="founder-directory-loading"><LoaderCircle className="button-spinner" /> Loading conversations</div> : <div className="founder-conversation-layout"><div className="founder-conversation-list">{conversations.length ? conversations.map((thread) => <button type="button" key={`${thread.userId}:${thread.id}`} className={`${thread.unreadForFounder ? "is-unread" : ""} ${activeThread?.id === thread.id && activeThread.userId === thread.userId ? "is-selected" : ""}`} onClick={() => openThread(thread)}><span>{thread.username}</span><strong>{thread.title}</strong><small>{new Date(thread.updatedAt).toLocaleString()}</small>{thread.unreadForFounder ? <i>Reply waiting</i> : null}</button>) : <div className="inbox-empty"><MessageCircle size={20} /><div><strong>No private replies yet.</strong><p>Replyable founder messages will create individual player threads here.</p></div></div>}</div><article className="founder-thread-reader">{activeThread ? <><p className="kicker">{activeThread.username}</p><h3>{activeThread.title}</h3><div className="conversation-thread">{threadMessages.map((message) => <div key={message.id} className={`conversation-message ${message.senderType}`}><span>{message.senderType === "player" ? activeThread.username : "Ayanda"}</span>{message.body ? <p>{message.body}</p> : null}<BoardSignalChatAttachmentRenderer attachment={message.attachment}/><small>{new Date(message.createdAt).toLocaleString()}</small></div>)}</div>{activeThread.allowReply !== false ? <div className="conversation-reply"><label htmlFor="founder-reply">Reply</label><textarea id="founder-reply" value={reply} onChange={(event) => { setReply(event.target.value); replyChanged(); }} rows={4} maxLength={2000} disabled={sending} /><BoardSignalAttachmentComposer value={replyAttachment} onChange={(next) => { setReplyAttachment(next); replyChanged(); }} onBusyChange={setReplyUploadBusy} onError={setError} offline={!connectivity.online} disabled={sending} resetKey={`founder:${activeThread.userId}:${activeThread.id}`} /><button type="button" className="button button-lime" onClick={sendReply} disabled={sending || replyUploadBusy || (!reply.trim() && !replyAttachment)}><Send size={14} /> Reply</button></div> : null}</> : <div className="inbox-reader-placeholder"><MessageCircle size={22} /><p>Select a player conversation.</p></div>}</article></div>}</section>

    <section className="desk-section campaign-history"><div className="room-section-heading"><div><p className="kicker">RECENT CAMPAIGNS</p><h2>Delivery history</h2></div></div>{campaigns.length ? <div className="campaign-history-table">{campaigns.map((campaign) => <article key={campaign.id}><div><strong>{campaign.title}</strong><span>{boardSignalPresentationLabel(campaign.type)} · {new Date(campaign.createdAt).toLocaleString()}</span>{campaign.attachment ? <span>{campaign.attachment.kind === "pdf" ? "PDF" : "Image"}: {campaign.attachment.name}</span> : null}</div><dl><div><dt>Audience</dt><dd>{campaign.audienceCount}</dd></div><div><dt>Sent</dt><dd>{campaign.sentCount}</dd></div><div><dt>Read</dt><dd>{campaign.readCount ?? 0}</dd></div><div><dt>Push eligible</dt><dd>{campaign.pushEligibleCount ?? 0}</dd></div><div><dt>Push delivered</dt><dd>{campaign.pushDelivered ?? 0}</dd></div><div><dt>Push failed</dt><dd>{campaign.pushFailed ?? 0}</dd></div><div><dt>Email eligible</dt><dd>{campaign.emailEligibleCount ?? 0}</dd></div><div><dt>Email delivered</dt><dd>{campaign.emailDelivered ?? 0}</dd></div><div><dt>Email failed</dt><dd>{campaign.emailFailed ?? 0}</dd></div></dl></article>)}</div> : <div className="universe-empty"><p>No communications campaigns have been sent yet.</p></div>}</section>
  </>;
}
