import "server-only";

import { createHash, randomBytes } from "node:crypto";

const TOKEN_LIKE = /\b[A-Za-z0-9_-]{40,}\b/g;
const EMAIL_LIKE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g;
const URL_LIKE = /https?:\/\/\S+/gi;

function fingerprint(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

function safeMessage(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || "Unknown server error");
  return message
    .replace(TOKEN_LIKE, "[redacted-token]")
    .replace(EMAIL_LIKE, "[redacted-email]")
    .replace(URL_LIKE, "[redacted-url]")
    .slice(0, 240);
}

export function logPurePressQuoteServerError(
  scope: string,
  context: { action?: string; projectId?: string; quoteId?: string },
  reason: unknown,
) {
  const diagnosticId = `PPQ-${randomBytes(5).toString("hex").toUpperCase()}`;
  const errorCode = typeof reason === "object" && reason && "code" in reason
    ? String((reason as { code?: unknown }).code || "")
    : "";

  console.error("[PurePress quotation]", {
    diagnosticId,
    scope,
    ...(context.action ? { action: context.action } : {}),
    ...(context.projectId ? { projectRef: fingerprint(context.projectId) } : {}),
    ...(context.quoteId ? { quoteRef: fingerprint(context.quoteId) } : {}),
    errorName: reason instanceof Error ? reason.name : typeof reason,
    ...(errorCode ? { errorCode: errorCode.slice(0, 80) } : {}),
    message: safeMessage(reason),
  });

  return diagnosticId;
}
