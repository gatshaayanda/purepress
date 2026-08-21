"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

const WHATSAPP_NUMBER = "+26772971852";
const EMAIL = "sparklelegacyinsurancebrokers@gmail.com";

function waLink(message: string) {
  const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const GENERAL_MESSAGE =
  "Hi Sparkle Legacy 👋 I need help with a quote / policy / claim.\n\nName:\nCity/Town:\nTopic:\nDetails:";

const QUOTE_MESSAGE =
  "Hi Sparkle Legacy 👋 I’d like a quote.\n\nCover type (Short-Term / Long-Term / SME / Retirement):\nProduct:\nCity/Town:\nName:\nPhone (optional):\nNotes (optional):";

const CLAIM_MESSAGE =
  "Hi Sparkle Legacy 👋 I need help with a claim.\n\nClaim type (Motor/Home/Life/Funeral/Business):\nIncident date:\nLocation:\nWhat happened:\nName:\nPhone:\n\n(Attach photos/documents if available.)";

const CALLBACK_MESSAGE =
  "Hi Sparkle Legacy 👋 Please call me back.\n\nName:\nBest time:\nTopic (quote/policy/claim):";

export default function ContactPage() {
  const [online, setOnline] = useState(true);
  const [copiedLabel, setCopiedLabel] = useState("");

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);

    updateStatus();

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  async function copyMessage(label: string, message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel(""), 1800);
    } catch {
      window.alert("Copy failed. Please copy the message manually.");
    }
  }

  const waGeneral = waLink(GENERAL_MESSAGE);
  const waQuote = waLink(QUOTE_MESSAGE);
  const waClaim = waLink(CLAIM_MESSAGE);
  const waCallback = waLink(CALLBACK_MESSAGE);

  return (
    <main id="main" className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          {!online ? (
            <div className="mb-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
              <div className="flex items-start gap-2">
                <WifiOff size={17} className="mt-1 shrink-0" />
                <p>
                  You are offline. This contact page can still be viewed, but
                  WhatsApp, email, and external links need internet. You can copy
                  a prepared message and send it when you reconnect.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-5 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm leading-7 text-green-700">
              <div className="flex items-start gap-2">
                <Wifi size={17} className="mt-1 shrink-0" />
                <p>Online. WhatsApp and email contact buttons are ready.</p>
              </div>
            </div>
          )}

          <div className="card-elevated overflow-hidden">
            <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
              <div className="eyebrow">
                <ShieldCheck size={15} />
                Sparkle Legacy • Contact
              </div>

              <h1 className="max-w-[11ch]">Contact Sparkle Legacy.</h1>

              <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                WhatsApp-first support for quotes, policy guidance, and claims
                help. If you prefer a longer written explanation or formal
                follow-up, email works too.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={waGeneral}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <MessageCircle size={18} />
                  Chat on WhatsApp
                </a>

                <a href={`mailto:${EMAIL}`} className="btn btn-outline">
                  <Mail size={18} />
                  Email Us
                </a>

                <button
                  type="button"
                  onClick={() => copyMessage("general", GENERAL_MESSAGE)}
                  className="btn btn-outline"
                >
                  {copiedLabel === "general" ? <Check size={18} /> : <Copy size={18} />}
                  {copiedLabel === "general" ? "Copied" : "Copy Message"}
                </button>

                <Link href="/claims" className="btn btn-ghost" prefetch={false}>
                  <FileText size={18} />
                  Claims Help
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-3">
            <InfoPanel
              eyebrow="Fastest support"
              title="WhatsApp support"
              icon={<MessageCircle size={18} />}
            >
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Best for faster replies, document sharing, claim follow-up, and
                practical quote requests.
              </p>

              <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <PhoneCall
                    size={16}
                    className="text-[var(--brand-primary-strong)]"
                  />
                  <span>{WHATSAPP_NUMBER}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock
                    size={16}
                    className="text-[var(--brand-primary-strong)]"
                  />
                  <span>Typical response: as soon as possible</span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <a
                  href={waQuote}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary w-full"
                >
                  <MessageCircle size={18} />
                  Request a Quote
                </a>

                <button
                  type="button"
                  onClick={() => copyMessage("quote", QUOTE_MESSAGE)}
                  className="btn btn-outline w-full"
                >
                  {copiedLabel === "quote" ? <Check size={18} /> : <Copy size={18} />}
                  {copiedLabel === "quote" ? "Quote Message Copied" : "Copy Quote Message"}
                </button>

                <a
                  href={waClaim}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline w-full"
                >
                  <FileText size={18} />
                  Start a Claim
                </a>

                <button
                  type="button"
                  onClick={() => copyMessage("claim", CLAIM_MESSAGE)}
                  className="btn btn-outline w-full"
                >
                  {copiedLabel === "claim" ? <Check size={18} /> : <Copy size={18} />}
                  {copiedLabel === "claim" ? "Claim Message Copied" : "Copy Claim Message"}
                </button>

                <a
                  href={waCallback}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline w-full"
                >
                  <PhoneCall size={18} />
                  Request a Callback
                </a>
              </div>

              <p className="mt-4 text-xs leading-6 text-[var(--text-muted)]">
                Tip: attach clear photos or PDFs such as ID, forms, evidence, or
                supporting documents where relevant.
              </p>
            </InfoPanel>

            <InfoPanel
              eyebrow="Formal follow-up"
              title="Email"
              icon={<Mail size={18} />}
            >
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Use email for longer detail, more formal submissions, or written
                follow-ups.
              </p>

              <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <Mail
                    size={16}
                    className="text-[var(--brand-primary-strong)]"
                  />
                  <a
                    className="transition hover:text-[var(--text-primary)] hover:underline"
                    href={`mailto:${EMAIL}`}
                  >
                    {EMAIL}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Clock
                    size={16}
                    className="text-[var(--brand-primary-strong)]"
                  />
                  <span>Response: same day where possible</span>
                </div>
              </div>

              <div className="mt-5">
                <a href={`mailto:${EMAIL}`} className="btn btn-primary w-full">
                  <Mail size={18} />
                  Compose Email
                </a>
              </div>

              <div className="mt-4 frame-gold p-4">
                <p className="text-sm leading-7 text-[var(--text-secondary)]">
                  Helpful details to include: cover type, product, city or town,
                  and the practical facts that matter most to your request.
                </p>
              </div>
            </InfoPanel>

            <InfoPanel
              eyebrow="Helpful details"
              title="What to send for faster help"
              icon={<MapPin size={18} />}
            >
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                If you want guidance faster, sending the basics early usually
                helps.
              </p>

              <ul className="mt-4 space-y-2">
                {[
                  "Your name and city or town",
                  "Cover type such as Short-Term, Long-Term, SME, or Retirement",
                  "Product such as Motor, Home, Funeral, Life, or similar",
                  "If it is a claim: the incident date and what happened",
                  "Any supporting photos or documents",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                  >
                    <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href="/c/short-term"
                  className="btn btn-outline w-full"
                  prefetch={false}
                >
                  Browse Short-Term
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/c/long-term"
                  className="btn btn-outline w-full"
                  prefetch={false}
                >
                  Browse Long-Term
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/c/retirement"
                  className="btn btn-outline w-full"
                  prefetch={false}
                >
                  Retirement & Wealth
                  <ArrowRight size={18} />
                </Link>
              </div>

              <p className="mt-4 text-xs leading-6 text-[var(--text-muted)]">
                Cover terms, premiums, and benefits remain subject to insurer
                underwriting and policy wording.
              </p>
            </InfoPanel>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoPanel({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card-outline-gold h-full">
      <div className="card-inner md:p-6">
        <div className="eyebrow mb-0">
          {icon}
          {eyebrow}
        </div>

        <h2 className="mt-2 text-xl">{title}</h2>

        {children}
      </div>
    </section>
  );
}