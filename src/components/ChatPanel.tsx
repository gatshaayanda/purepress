"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  FileText,
  Link as LinkIcon,
  Loader2,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { uploadFiles } from "@/utils/uploadthing";
import { firestore } from "@/utils/firebaseConfig";

type ChatMessage = {
  id?: string;
  text: string;
  sender: string;
  link: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  timestamp: unknown;
};

type UploadThingResult = {
  url?: string;
  ufsUrl?: string;
  appUrl?: string;
  name?: string;
  type?: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUploadUrl(uploaded?: UploadThingResult) {
  return uploaded?.url || uploaded?.ufsUrl || uploaded?.appUrl || "";
}

export default function ChatPanel({
  projectId,
  senderName,
  canDeleteAll = false,
  brand = { primary: "#887337", accent: "#d6b678" },
}: {
  projectId: string;
  senderName: string;
  canDeleteAll?: boolean;
  brand?: { primary: string; accent: string };
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [optionalLink, setOptionalLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const messagesBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(firestore, "projects", projectId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<ChatMessage>;

          return {
            id: docSnap.id,
            text: cleanString(data.text),
            sender: cleanString(data.sender) || "Unknown sender",
            link: cleanString(data.link),
            fileUrl: cleanString(data.fileUrl),
            fileName: cleanString(data.fileName),
            fileType: cleanString(data.fileType),
            timestamp: data.timestamp ?? null,
          };
        });

        setMessages(rows);

        window.setTimeout(() => {
          const box = messagesBoxRef.current;
          if (!box) return;

          box.scrollTo({
            top: box.scrollHeight,
            behavior: "smooth",
          });
        }, 120);
      },
      (error) => {
        console.error("Message listener failed:", error);
      }
    );

    return () => unsub();
  }, [projectId]);

  const clearComposer = () => {
    setNewMessage("");
    setOptionalLink("");
    setFile(null);
    setFileInputKey((prev) => prev + 1);
  };

  async function send(e: FormEvent) {
    e.preventDefault();

    const cleanText = newMessage.trim();
    const cleanLink = optionalLink.trim();

    if (!projectId || busy) return;
    if (!cleanText && !file && !cleanLink) return;

    setBusy(true);

    try {
      let uploadedFileUrl = "";
      let uploadedFileName = "";
      let uploadedFileType = "";

      if (file) {
        const uploaded = await uploadFiles("fileUploader" as any, {
          files: [file],
        });

        const firstUpload = uploaded?.[0] as UploadThingResult | undefined;

        uploadedFileUrl = getUploadUrl(firstUpload);
        uploadedFileName = firstUpload?.name || file.name || "Uploaded file";
        uploadedFileType = firstUpload?.type || file.type || "file";

        if (!uploadedFileUrl) {
          throw new Error("File uploaded, but no file URL was returned.");
        }
      }

      const messagePayload: ChatMessage = {
        text: cleanText,
        sender: senderName?.trim() || "Sparkle Legacy Team",
        link: cleanLink,
        fileUrl: uploadedFileUrl,
        fileName: uploadedFileName,
        fileType: uploadedFileType,
        timestamp: serverTimestamp(),
      };

      await addDoc(
        collection(firestore, "projects", projectId, "messages"),
        messagePayload
      );

      clearComposer();
    } catch (err: any) {
      console.error("Message send failed:", err);
      window.alert(err?.message || "Failed to send message.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (!canDeleteAll || deleting || !projectId) return;

    const ok = window.confirm("Delete all messages in this conversation?");
    if (!ok) return;

    setDeleting(true);

    try {
      const snap = await getDocs(
        collection(firestore, "projects", projectId, "messages")
      );

      await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
    } catch (err) {
      console.error("Delete all messages failed:", err);
      window.alert("Failed to delete messages.");
    } finally {
      setDeleting(false);
    }
  }

  const isOwn = (message: ChatMessage) => message.sender === senderName;

  return (
    <section className="card-outline-gold overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 md:px-6"
        style={{
          background: `linear-gradient(180deg, ${brand.primary} 0%, ${brand.primary}dd 100%)`,
          color: "#fff",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "rgba(255,255,255,0.14)" }}
          >
            💬
          </span>
          <h2 className="text-sm font-semibold tracking-wide md:text-base">
            Client Conversation
          </h2>
        </div>

        {canDeleteAll ? (
          <button
            onClick={deleteAll}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs disabled:opacity-60 md:text-sm"
            style={{
              borderColor: "rgba(255,255,255,0.35)",
              background: "transparent",
              color: "#fff",
            }}
            type="button"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {deleting ? "Deleting..." : "Delete All"}
          </button>
        ) : null}
      </div>

      <div
        ref={messagesBoxRef}
        className="max-h-[430px] space-y-3 overflow-y-auto overscroll-contain border-x border-b border-[var(--border)] bg-[var(--surface)] p-3 md:p-4"
      >
        {messages.length === 0 ? (
          <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-5 text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No messages yet
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
              Start the conversation with a clear update, document request, or
              next step for this client case.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                isOwn(message) ? "ml-auto" : ""
              }`}
              style={{
                background: isOwn(message) ? "#F7F2E7" : "#FFFFFF",
                border: `1px solid ${
                  isOwn(message) ? "#E8D9B0" : "rgba(0,0,0,.08)"
                }`,
              }}
            >
              <div
                className="mb-1 text-[10px] font-semibold"
                style={{
                  color: isOwn(message) ? brand.primary : "#6B7280",
                }}
              >
                {message.sender}
              </div>

              {message.text ? (
                <p className="whitespace-pre-line text-sm leading-6 text-gray-800">
                  {message.text}
                </p>
              ) : null}

              <div className="mt-2 space-y-1">
                {message.link ? (
                  <a
                    href={message.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline"
                    style={{ color: brand.primary }}
                  >
                    <LinkIcon size={13} />
                    Reference link
                  </a>
                ) : null}

                {message.fileUrl ? (
                  <a
                    href={message.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline"
                    style={{ color: brand.primary }}
                  >
                    <FileText size={13} />
                    {message.fileName || "View attached file"}
                  </a>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="space-y-3 bg-white p-3 md:p-4">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Write a clear update or reply..."
          rows={3}
          disabled={busy}
          className="input min-h-[110px] resize-y rounded-[1.25rem] disabled:opacity-60"
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            key={fileInputKey}
            type="file"
            accept="image/*,application/pdf"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block text-xs text-[var(--text-secondary)] disabled:opacity-60"
          />

          <input
            type="url"
            value={optionalLink}
            disabled={busy}
            onChange={(e) => setOptionalLink(e.target.value)}
            placeholder="Optional link"
            className="input w-full disabled:opacity-60 sm:flex-1"
          />

          <button
            type="submit"
            disabled={busy || (!newMessage.trim() && !optionalLink.trim() && !file)}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: brand.accent,
              color: brand.primary,
            }}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {busy ? "Sending..." : "Send"}
          </button>
        </div>

        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <span className="min-w-0 truncate text-sm text-[var(--text-secondary)]">
              {file.name}
            </span>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setFileInputKey((prev) => prev + 1);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] disabled:opacity-60"
            >
              <X size={14} />
              Remove
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}