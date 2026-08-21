import "server-only";

import { getBoardSignalDeliveryStatus } from "./delivery";

export type BoardSignalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type BoardSignalEmailResult = {
  configured: boolean;
  delivered: boolean;
  providerId?: string;
  error?: string;
};

export async function sendBoardSignalEmail(input: BoardSignalEmailInput): Promise<BoardSignalEmailResult> {
  const status = getBoardSignalDeliveryStatus();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.BOARDSIGNAL_EMAIL_FROM?.trim();
  if (!status.emailConfigured || !apiKey || !from) {
    return { configured: false, delivered: false, error: "BoardSignal email delivery is not configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject.slice(0, 200),
        text: input.text.slice(0, 12000),
        ...(input.html ? { html: input.html.slice(0, 20000) } : {}),
        ...(input.replyTo || process.env.BOARDSIGNAL_EMAIL_REPLY_TO?.trim()
          ? { reply_to: input.replyTo || process.env.BOARDSIGNAL_EMAIL_REPLY_TO?.trim() }
          : {}),
      }),
    });
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: { message?: string } };
    if (!response.ok) {
      return { configured: true, delivered: false, error: data.error?.message ?? data.message ?? `Resend returned HTTP ${response.status}.` };
    }
    return { configured: true, delivered: true, ...(data.id ? { providerId: data.id } : {}) };
  } catch (error) {
    return { configured: true, delivered: false, error: error instanceof Error ? error.message : "BoardSignal email delivery failed." };
  }
}
