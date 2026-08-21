"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  ExternalLink,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

type Msg = { sender: "user" | "bot"; text: string };
type Stage = "browse" | "inquire" | "lead" | "handoff";

type Lead = {
  name: string;
  phone: string;
  coverType: string;
  product: string;
  city: string;
  note: string;
};

const STORAGE_KEY = "sparkle_chat_history_v1";
const LEAD_KEY = "sparkle_chat_lead_v1";
const WHATSAPP_NUMBER = "+26772971852";

function waLink(message: string) {
  const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clampText(s: string, max = 1200) {
  const t = (s || "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function getCurrentPath() {
  if (typeof window === "undefined") return "";
  return window.location.pathname || "";
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("browse");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);

  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [leadOpen, setLeadOpen] = useState(false);
  const [lead, setLead] = useState<Lead>({
    name: "",
    phone: "",
    coverType: "",
    product: "",
    city: "",
    note: "",
  });

  const FALLBACKS = useMemo(
    () => [
      "I can help with quotes, claims, cover questions, and finding your way around this page. Tell me what you need, and I’ll guide you clearly.",
      "You can ask about motor, home, funeral, life, business cover, retirement, claims support, the client portal, PDF generation, or where to click next.",
      "For the fastest next step, tap “Get a quote” and I’ll prepare a WhatsApp message for you.",
    ],
    []
  );

  const DEFAULT_SUGGESTIONS = useMemo(
    () => [
      "What can I do on this page?",
      "Get a quote",
      "Short-Term cover",
      "Claims help",
      "Talk on WhatsApp",
    ],
    []
  );

  const fallbackIdx = useRef(0);

  const rotatedFallback = () =>
    FALLBACKS[fallbackIdx.current++ % FALLBACKS.length];

  useEffect(() => {
    try {
      const savedMsgs = safeJsonParse<Msg[]>(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(savedMsgs)) setMessages(savedMsgs);

      const savedLead = safeJsonParse<Partial<Lead>>(
        localStorage.getItem(LEAD_KEY)
      );

      if (savedLead && typeof savedLead === "object") {
        setLead((prev) => ({ ...prev, ...savedLead }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    if (!open && messages.length) {
      const last = messages[messages.length - 1];
      if (last?.sender === "bot") setUnread((u) => u + 1);
    }
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;

    setUnread(0);

    if (messages.length === 0) {
      setStage("inquire");
      setMessages([
        {
          sender: "bot",
          text:
            "Hi 👋 I’m the Sparkle Legacy assistant.\nI can help you understand cover, request a quote, guide you on claims, and show you what this page can do.\n\nYou can ask things like:\n• What can I do on this page?\n• Where is the PDF button?\n• How do I share an article?\n• How does offline mode work?\n\nWhat would you like help with today?",
        },
      ]);
      setSuggestions(DEFAULT_SUGGESTIONS);
    }

    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open, messages.length, DEFAULT_SUGGESTIONS]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const pushBot = (text: string, sugg?: string[]) => {
    setMessages((prev) => [
      ...prev,
      { sender: "bot", text: clampText(text, 1800) },
    ]);
    setSuggestions(Array.isArray(sugg) ? sugg : []);
  };

  const toWhatsAppQuote = (leadData: Lead, transcript: Msg[]) => {
    const cleanTranscript = transcript.slice(-10).map((m) => {
      const label = m.sender === "user" ? "Me" : "Assistant";
      return `${label}: ${clampText(m.text, 220)}`;
    });

    const lines = [
      "Hi Sparkle Legacy 👋 I’d like a quote:",
      "",
      `Name: ${leadData.name || "-"}`,
      `Phone: ${leadData.phone || "-"}`,
      `Cover type: ${leadData.coverType || "-"}`,
      `Product: ${leadData.product || "-"}`,
      `City/Town: ${leadData.city || "-"}`,
      `Notes: ${leadData.note || "-"}`,
      "",
      cleanTranscript.length ? "— Chat context —" : "",
      ...cleanTranscript,
    ].filter(Boolean);

    return waLink(lines.join("\n"));
  };

  async function sendMessage(override?: string) {
    const text = (override ?? input).trim();
    if (!text) return;

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");
    setTyping(true);

    try {
      const res = await fetch("/api/fake-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          path: getCurrentPath(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      const botReply = (data?.reply || "").trim() || rotatedFallback();
      const botSugg = Array.isArray(data?.suggestions) ? data.suggestions : [];

      setTyping(false);
      pushBot(botReply, botSugg.length ? botSugg : DEFAULT_SUGGESTIONS);
      setStage((s) => (s === "browse" ? "inquire" : s));
    } catch {
      setTyping(false);
      pushBot(rotatedFallback(), DEFAULT_SUGGESTIONS);
    }
  }

  const onSuggestion = (s: string) => {
    if (s === "Talk on WhatsApp") {
      window.location.href = waLink(
        "Hi Sparkle Legacy 👋 I need help with a quote / policy / claim."
      );
      return;
    }

    if (s === "Get a quote") {
      setLeadOpen(true);
      setStage("lead");
      pushBot(
        "Sure — fill in these quick details and I’ll prepare your WhatsApp quote request.",
        []
      );
      return;
    }

    if (s === "Short-Term cover") {
      window.location.href = "/c/short-term";
      return;
    }

    if (s === "Long-Term cover") {
      window.location.href = "/c/long-term";
      return;
    }

    if (s === "SME cover") {
      window.location.href = "/c/business";
      return;
    }

    if (s === "Retirement") {
      window.location.href = "/c/retirement";
      return;
    }

    if (s === "Claims help") {
      window.location.href = "/claims";
      return;
    }

    if (s === "Contact") {
      window.location.href = "/contact";
      return;
    }

    sendMessage(s);
  };

  const submitLead = () => {
    const clean: Lead = {
      name: lead.name.trim(),
      phone: lead.phone.trim(),
      coverType: lead.coverType.trim(),
      product: lead.product.trim(),
      city: lead.city.trim(),
      note: lead.note.trim(),
    };

    try {
      localStorage.setItem(LEAD_KEY, JSON.stringify(clean));
    } catch {}

    const url = toWhatsAppQuote(clean, messages);

    setLeadOpen(false);
    setStage("handoff");
    pushBot("Opening WhatsApp now.", [
      "Short-Term cover",
      "Long-Term cover",
      "Claims help",
      "Talk on WhatsApp",
    ]);

    window.location.href = url;
  };

  const clearChat = () => {
    const ok = window.confirm("Clear this chat history?");
    if (!ok) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

    setMessages([
      {
        sender: "bot",
        text:
          "Chat cleared. 👋\nI can help with quotes, claims, page guidance, PDF buttons, portal support, and offline/PWA questions.\n\nWhat would you like help with?",
      },
    ]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setUnread(0);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full border border-[rgba(255,253,248,0.7)] text-[var(--text-on-brand)] shadow-[var(--shadow-lg)] transition hover:-translate-y-0.5"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-primary-strong), var(--brand-primary))",
          }}
          aria-label="Open Sparkle Legacy chat"
        >
          <MessageCircle size={22} />

          {unread > 0 && (
            <span
              className="absolute -right-1 -top-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white"
              style={{
                background: "var(--danger)",
                boxShadow: "0 10px 20px rgba(179, 38, 30, 0.22)",
              }}
            >
              {unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white shadow-[var(--shadow-lg)]"
          style={{
            width: "min(92vw, 24rem)",
            height: leadOpen ? "39rem" : "33rem",
            animation: "sparkleSlideIn 0.34s cubic-bezier(0.45,0,0.25,1)",
          }}
          role="dialog"
          aria-label="Sparkle Legacy Assistant"
          aria-modal="false"
        >
          <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] bg-white text-xs font-extrabold text-[var(--brand-primary-strong)] shadow-[var(--shadow-sm)]">
                  SL
                </div>

                <div className="min-w-0 leading-tight">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-extrabold text-[var(--text-primary)]">
                      Sparkle Legacy Assistant
                    </div>

                    <span
                      className="badge"
                      style={{ fontSize: 12, padding: "0.18rem 0.55rem" }}
                    >
                      <ShieldCheck size={14} />
                      Secure help
                    </span>
                  </div>

                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {stage === "lead"
                      ? "Quote request"
                      : "Page guide • Quotes • Claims • Portal help"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => sendMessage("What can I do on this page?")}
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:bg-[var(--brand-tint)] hover:text-[var(--text-primary)]"
              >
                Page help
              </button>

              <button
                type="button"
                onClick={clearChat}
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
              >
                Clear chat
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fffdf9_0%,#fcfbf7_100%)] p-3 text-sm"
            aria-live="polite"
          >
            <div className="space-y-2">
              {messages.map((m, i) => {
                const isUser = m.sender === "user";

                return (
                  <div
                    key={`${m.sender}-${i}`}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[86%] whitespace-pre-line rounded-2xl border px-3 py-2.5 ${
                        isUser
                          ? "border-[var(--brand-primary-strong)] bg-[var(--brand-primary-strong)] text-[var(--text-on-brand)]"
                          : "border-[var(--border)] bg-white text-[var(--text-primary)]"
                      }`}
                      style={{
                        boxShadow: isUser ? "none" : "var(--shadow-sm)",
                        animation: "sparkleBubbleIn 150ms ease-out",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}

              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5 text-[var(--text-primary)] shadow-[var(--shadow-sm)]">
                    <span className="sparkle-typing-dot" />
                    <span
                      className="sparkle-typing-dot"
                      style={{ animationDelay: "120ms" }}
                    />
                    <span
                      className="sparkle-typing-dot"
                      style={{ animationDelay: "240ms" }}
                    />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {leadOpen && (
            <div className="border-t border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--text-primary)]">
                  <ClipboardList
                    size={16}
                    className="text-[var(--brand-primary-strong)]"
                  />
                  Quote details
                </div>

                <a
                  href={waLink("Hi Sparkle Legacy 👋 I’d like help with a quote.")}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--brand-primary-strong)]"
                  aria-label="Open WhatsApp without form"
                >
                  Skip form
                  <ExternalLink size={14} />
                </a>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="label">Name</label>
                  <input
                    value={lead.name}
                    onChange={(e) =>
                      setLead((s) => ({ ...s, name: e.target.value }))
                    }
                    placeholder="Your name"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input
                    value={lead.phone}
                    onChange={(e) =>
                      setLead((s) => ({ ...s, phone: e.target.value }))
                    }
                    placeholder="Phone number"
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label">Cover type</label>
                    <input
                      value={lead.coverType}
                      onChange={(e) =>
                        setLead((s) => ({
                          ...s,
                          coverType: e.target.value,
                        }))
                      }
                      placeholder="Short-Term / Long-Term"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">City / Town</label>
                    <input
                      value={lead.city}
                      onChange={(e) =>
                        setLead((s) => ({ ...s, city: e.target.value }))
                      }
                      placeholder="City or town"
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Product</label>
                  <input
                    value={lead.product}
                    onChange={(e) =>
                      setLead((s) => ({ ...s, product: e.target.value }))
                    }
                    placeholder="Motor, Funeral, Life, Home..."
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    rows={3}
                    value={lead.note}
                    onChange={(e) =>
                      setLead((s) => ({ ...s, note: e.target.value }))
                    }
                    placeholder="Any details that will help with your quote"
                    className="textarea"
                  />
                </div>

                <p className="text-xs leading-6 text-[var(--text-muted)]">
                  These details are only used to prepare your WhatsApp quote
                  request.
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={submitLead}
                    className="btn btn-primary"
                  >
                    <Phone size={18} />
                    Send to WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLeadOpen(false);
                      setStage("inquire");
                      setSuggestions(DEFAULT_SUGGESTIONS);
                    }}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {!leadOpen && suggestions.length > 0 && (
            <div className="border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s}-${i}`}
                    type="button"
                    onClick={() => onSuggestion(s)}
                    className="rounded-full border border-[var(--border-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-tint)] hover:text-[var(--text-primary)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!leadOpen && (
            <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--surface)] p-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Ask about this page, quotes, claims..."
                className="input flex-1"
                aria-label="Type your message"
              />

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => sendMessage()}
                aria-label="Send message"
              >
                <Send size={18} />
                Send
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes sparkleSlideIn {
          from {
            transform: translateY(16px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes sparkleBubbleIn {
          from {
            transform: scale(0.985);
            opacity: 0.7;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes sparkleTyping {
          0%,
          80%,
          100% {
            transform: scale(0.35);
            opacity: 0.35;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .sparkle-typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          margin-right: 4px;
          border-radius: 999px;
          background: linear-gradient(
            135deg,
            var(--brand-primary),
            var(--brand-primary-strong)
          );
          animation: sparkleTyping 1.35s infinite ease-in-out;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </>
  );
}