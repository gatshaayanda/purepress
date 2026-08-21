"use client";

import { FileImage, FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUploadThing } from "@/utils/uploadthing";
import {
  BOARDSIGNAL_CHAT_IMAGE_MAX_BYTES,
  BOARDSIGNAL_CHAT_PDF_MAX_BYTES,
  attachmentKindForMimeType,
  formatBoardSignalAttachmentSize,
  type BoardSignalChatAttachment,
  type BoardSignalChatAttachmentView,
} from "@/lib/boardsignal/chatAttachments";
import styles from "./BoardSignalChatAttachment.module.css";

export type BoardSignalAttachmentDraft = {
  attachment: BoardSignalChatAttachment;
  viewUrl?: string;
};

type ComposerProps = {
  value?: BoardSignalAttachmentDraft;
  onChange: (value: BoardSignalAttachmentDraft | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  onError?: (message: string) => void;
  authHeader?: string;
  offline?: boolean;
  disabled?: boolean;
  resetKey: string;
};

type UploadState = "idle" | "selected" | "uploading" | "uploaded" | "failed";

function clientValidation(file: File) {
  const kind = attachmentKindForMimeType(file.type);
  if (!kind) return "Only non-SVG images and PDF files can be attached.";
  if (kind === "image" && file.size > BOARDSIGNAL_CHAT_IMAGE_MAX_BYTES) return "Images may be up to 4MB.";
  if (kind === "pdf" && file.size > BOARDSIGNAL_CHAT_PDF_MAX_BYTES) return "PDFs may be up to 2GB.";
  return "";
}

export function BoardSignalAttachmentComposer({
  value,
  onChange,
  onBusyChange,
  onError,
  authHeader,
  offline = false,
  disabled = false,
  resetKey,
}: ComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(value);
  const resetRef = useRef(resetKey);
  const mountedRef = useRef(true);
  const cleanupAuthHeaderRef = useRef(authHeader);
  const uploadAttemptRef = useRef(0);
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [state, setState] = useState<UploadState>(value ? "uploaded" : "idle");
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState("");

  const { startUpload, isUploading } = useUploadThing("boardSignalChatAttachment", {
    headers: (): Record<string, string> => authHeader ? { Authorization: authHeader } : {},
    uploadProgressGranularity: "fine",
    onUploadProgress: (value) => setProgress(value),
  });

  useEffect(() => {
    const previous = draftRef.current;
    draftRef.current = value;
    cleanupAuthHeaderRef.current = authHeader;
    if (previous && !value && state === "uploaded") void discardWithAuth(previous, authHeader);
  }, [authHeader, state, value]);
  useEffect(() => { onBusyChange?.(!offline && (isUploading || state === "uploading")); }, [isUploading, offline, onBusyChange, state]);
  useEffect(() => {
    if (!value && state === "uploaded") {
      setFile(undefined);
      setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ""; });
      setProgress(undefined);
      setState("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state, value]);

  function report(message: string) {
    setError(message);
    onError?.(message);
  }

  // UploadThing has no offline binary queue in BoardSignal. If connectivity drops
  // during an in-flight upload, invalidate that attempt immediately. A late server
  // success is discarded instead of becoming a fake ready-to-send attachment.
  useEffect(() => {
    if (!offline || state !== "uploading") return;
    uploadAttemptRef.current += 1;
    onChange(undefined);
    setState("failed");
    setProgress(undefined);
    report("Attachment upload was interrupted when the connection was lost. Reconnect and choose the file again to retry.");
    // report/onChange are stable parent callbacks in current composers; this effect is
    // intentionally keyed to the actual connectivity/state transition only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, state]);

  async function discardWithAuth(draft: BoardSignalAttachmentDraft | undefined, header?: string) {
    if (!draft?.attachment.fileKey) return;
    try {
      await fetch("/api/boardsignal/chat-attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(header ? { Authorization: header } : {}) },
        body: JSON.stringify({ action: "discard", fileKey: draft.attachment.fileKey }),
        cache: "no-store",
      });
    } catch {
      // Cleanup is best effort. The existing server receipt remains discoverable for later cleanup.
    }
  }

  async function discard(draft = draftRef.current) {
    return discardWithAuth(draft, authHeader);
  }

  useEffect(() => {
    if (resetRef.current === resetKey) return;
    const previous = draftRef.current;
    resetRef.current = resetKey;
    uploadAttemptRef.current += 1;
    if (previous) void discard(previous);
    onChange(undefined);
    setFile(undefined);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ""; });
    setState("idle");
    setProgress(undefined);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      uploadAttemptRef.current += 1;
      const pending = draftRef.current;
      if (pending) void discardWithAuth(pending, cleanupAuthHeaderRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function resetLocal() {
    uploadAttemptRef.current += 1;
    setFile(undefined);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ""; });
    setProgress(undefined);
    setState("idle");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removeAttachment() {
    const previous = value;
    onChange(undefined);
    if (previous) await discard(previous);
    resetLocal();
  }

  async function upload(next: File) {
    if (offline) { report("Reconnect before attaching an image or PDF."); return; }
    const validation = clientValidation(next);
    if (validation) { setState("failed"); report(validation); return; }
    if (value) await discard(value);
    const attempt = uploadAttemptRef.current + 1;
    uploadAttemptRef.current = attempt;
    const uploadResetKey = resetKey;
    const uploadAuthHeader = authHeader;
    onChange(undefined);
    setError("");
    setState("selected");
    setFile(next);
    setProgress(0);
    if (next.type.startsWith("image/") && next.type !== "image/svg+xml") {
      setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(next); });
    } else {
      setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ""; });
    }
    setState("uploading");
    try {
      const result = await startUpload([next]);
      const first = result?.[0];
      const serverData = first?.serverData as { attachment?: BoardSignalChatAttachment; viewUrl?: string } | null | undefined;
      if (!serverData?.attachment) throw new Error("Upload finished, but BoardSignal did not receive a valid attachment receipt.");
      const draft = { attachment: serverData.attachment, viewUrl: serverData.viewUrl };
      if (!mountedRef.current || resetRef.current !== uploadResetKey || uploadAttemptRef.current !== attempt || offline) {
        await discardWithAuth(draft, uploadAuthHeader);
        return;
      }
      onChange(draft);
      setState("uploaded");
      setProgress(100);
    } catch (reason) {
      if (uploadAttemptRef.current !== attempt) return;
      onChange(undefined);
      setState("failed");
      report(reason instanceof Error ? reason.message : "Attachment upload failed. Text messaging is still available.");
    }
  }

  const unavailable = disabled || state === "uploading" || isUploading;
  const kind = file ? attachmentKindForMimeType(file.type) : value?.attachment.kind;
  const name = file?.name ?? value?.attachment.name;
  const size = file?.size ?? value?.attachment.size;

  return <div className={styles.composer}>
    <div className={styles.controls}>
      <label className={styles.attachButton} aria-disabled={unavailable || offline ? "true" : undefined}>
        <Paperclip size={16} aria-hidden="true" /> Attach image or PDF
        <input
          ref={inputRef}
          className={styles.input}
          type="file"
          accept="image/*,application/pdf"
          disabled={unavailable || offline}
          aria-label="Attach image or PDF"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void upload(selected);
          }}
        />
      </label>
      <span className={styles.limit}>{offline ? "Attachments need a connection · no upload is queued" : "Image max 4MB · PDF max 2GB · one attachment"}</span>
    </div>

    {name ? <div className={styles.preview}>
      {kind === "image" && previewUrl ? <img className={styles.previewImage} src={previewUrl} alt={`Selected attachment: ${name}`} /> : <span className={styles.fileIcon}>{kind === "image" ? <FileImage size={20} aria-hidden="true"/> : <FileText size={20} aria-hidden="true"/>}</span>}
      <div className={styles.meta}>
        <strong title={name}>{name}</strong>
        <span>{kind === "pdf" ? "PDF" : "Image"}{size ? ` · ${formatBoardSignalAttachmentSize(size)}` : ""}</span>
        {state === "uploading" ? <small className={styles.statusUploading}><LoaderCircle className="button-spinner" size={12} aria-hidden="true"/> Uploading {kind === "pdf" ? "PDF" : "image"}{typeof progress === "number" ? ` · ${Math.round(progress)}%` : "…"}</small> : null}
        {state === "uploaded" ? <small>Ready to send</small> : null}
        {state === "failed" ? <small className={styles.statusFailed}>Attachment failed or was interrupted. Reconnect and choose the file again to retry; nothing is queued.</small> : null}
        {state === "uploading" && typeof progress === "number" ? <progress className={styles.progress} max={100} value={progress} aria-label={`Upload progress ${Math.round(progress)} percent`} /> : null}
      </div>
      <button type="button" className={styles.removeButton} disabled={state === "uploading" || isUploading} onClick={() => void removeAttachment()}><X size={14} aria-hidden="true"/> Remove</button>
    </div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </div>;
}

export function BoardSignalChatAttachmentRenderer({ attachment }: { attachment?: BoardSignalChatAttachmentView }) {
  const [imageBroken, setImageBroken] = useState(false);
  useEffect(() => setImageBroken(false), [attachment?.fileKey]);
  if (!attachment) return null;

  if (attachment.kind === "image" && attachment.viewUrl && !imageBroken) {
    return <div className={styles.messageAttachment}>
      <a className={styles.imageLink} href={attachment.viewUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open image ${attachment.name}`}>
        <img src={attachment.viewUrl} alt={attachment.name || "Message image attachment"} loading="lazy" onError={() => setImageBroken(true)} />
        <span className={styles.imageCaption}>{attachment.name} · {formatBoardSignalAttachmentSize(attachment.size)}</span>
      </a>
    </div>;
  }

  return <div className={`${styles.messageAttachment} ${styles.sentCard}`}>
    <span className={styles.fileIcon}>{attachment.kind === "image" ? <FileImage size={20} aria-hidden="true"/> : <FileText size={20} aria-hidden="true"/>}</span>
    <div className={styles.meta}><strong title={attachment.name}>{attachment.name}</strong><span>{attachment.kind === "pdf" ? "PDF" : "Image"} · {formatBoardSignalAttachmentSize(attachment.size)}</span></div>
    {attachment.viewUrl ? <a className={styles.openLink} href={attachment.viewUrl} target="_blank" rel="noopener noreferrer">{attachment.kind === "pdf" ? "Open PDF" : "Open image"}</a> : <span className={styles.unavailable}>Unavailable</span>}
  </div>;
}
