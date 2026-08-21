"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertTriangle,
  Briefcase,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  Home,
  MessageCircle,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";

const WHATSAPP_NUMBER = "+26772971852";
const CLAIMS_CACHE_KEY = "sparkle_legacy_claims_page_v1";

function waLink(message: string) {
  const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const BASE_WHATSAPP = "Hi Sparkle Legacy 👋 I need help with a claim.";

type ClaimType = {
  title: string;
  desc: string;
  type?: string;
  iconKey?: "motor" | "home" | "life" | "business";
  message?: string;
};

type ProcessStep = {
  title: string;
  desc: string;
};

type ClaimsContent = {
  eyebrow?: string;
  heroTitle?: string;
  heroCopy?: string;
  primaryButtonLabel?: string;
  quickStartEyebrow?: string;
  quickStartTitle?: string;
  quickStartCopy?: string;
  claimTypes?: ClaimType[];
  processTitle?: string;
  processSteps?: ProcessStep[];
  checklistTitle?: string;
  checklistCopy?: string;
  checklistItems?: string[];
  urgentNote?: string;
  disclaimer?: string;
};

type ClaimsCachePayload = {
  savedAt: string;
  content: ClaimsContent;
};

const DEFAULT_CLAIM_TYPES: ClaimType[] = [
  {
    title: "Motor claim",
    iconKey: "motor",
    type: "Motor",
    desc: "Accident, theft, windscreen, damage, or vehicle-related incidents.",
    message: `${BASE_WHATSAPP}\n\nType: Motor\nIncident date:\nLocation:\nWhat happened:\nVehicle:\nRegistration:\nPolice report (if any):\nYour name & phone:\n\nAttachments: photos, police report, license/ID, repair quote (if available).`,
  },
  {
    title: "Home / contents",
    iconKey: "home",
    type: "Home/Contents",
    desc: "Fire, theft, storm damage, burglary, or household loss and damage.",
    message: `${BASE_WHATSAPP}\n\nType: Home/Contents\nIncident date:\nLocation:\nWhat happened:\nItems affected:\nPolice report (if theft):\nYour name & phone:\n\nAttachments: photos, inventory/list, receipts (if any), police report (if theft).`,
  },
  {
    title: "Life / disability",
    iconKey: "life",
    type: "Life/Disability",
    desc: "Life-related claims, disability-related support, or protection linked to health and income.",
    message: `${BASE_WHATSAPP}\n\nType: Life/Disability\nEvent date:\nPolicy holder name:\nClaimant name:\nWhat happened:\nYour contact:\n\nAttachments: ID, claim forms, medical docs (if applicable), any policy reference.`,
  },
  {
    title: "Business / SME",
    iconKey: "business",
    type: "Business/SME",
    desc: "Assets, liability, fleet, interruption, or other business-related loss events.",
    message: `${BASE_WHATSAPP}\n\nType: Business/SME\nIncident date:\nBusiness name:\nLocation:\nWhat happened:\nItems/asset affected:\nYour contact:\n\nAttachments: photos, invoices/asset list, police report (if theft), supporting docs.`,
  },
];

const DEFAULT_PROCESS_STEPS: ProcessStep[] = [
  {
    title: "Report the incident",
    desc: "Share what happened, when it happened, and where it happened.",
  },
  {
    title: "Send supporting evidence",
    desc: "This may include photos, forms, police reports, medical documents, invoices, or repair-related information depending on the case.",
  },
  {
    title: "Assessment",
    desc: "The insurer reviews the matter and may ask for more information if required.",
  },
  {
    title: "Decision and settlement",
    desc: "The outcome may involve repair, replacement, or a pay-out depending on the product terms and claim assessment.",
  },
];

const DEFAULT_CHECKLIST = [
  "ID / Omang or passport for the policyholder or claimant",
  "Policy number or quote reference if available",
  "Incident date, time, and location",
  "Clear photos or videos of the damage or scene",
  "Police report where required, especially for theft or certain accidents",
  "Medical report or death certificate where applicable",
  "Repair quotes, invoices, or asset-related documents where relevant",
  "Any claim forms provided by the insurer",
];

const DEFAULT_CONTENT: ClaimsContent = {
  eyebrow: "Sparkle Legacy • Claims Support",
  heroTitle: "Claims help with clearer steps and faster guidance.",
  heroCopy:
    "If something happened, do not panic. Share the basics and Sparkle Legacy can guide you on likely next steps, supporting documents, and how to move the claim forward more clearly.",
  primaryButtonLabel: "Start Claim on WhatsApp",
  quickStartEyebrow: "Quick start",
  quickStartTitle: "Choose your claim type.",
  quickStartCopy:
    "Tap one of the options below and WhatsApp will open with a ready-to-send message template to help you start with the right details.",
  claimTypes: DEFAULT_CLAIM_TYPES,
  processTitle: "How claims usually work",
  processSteps: DEFAULT_PROCESS_STEPS,
  checklistTitle: "Helpful claim checklist",
  checklistCopy:
    "Exact requirements depend on the product and insurer, but the items below often help speed up the process.",
  checklistItems: DEFAULT_CHECKLIST,
  urgentNote:
    "If the situation is urgent, such as injury, theft, or major damage, message Sparkle Legacy immediately on WhatsApp so the team can guide the safest and most practical next step.",
  disclaimer:
    "Claim outcomes, benefits, settlement decisions, and timelines remain subject to insurer underwriting, product terms, and the relevant policy wording. If you are unsure, ask for guidance and Sparkle Legacy can help you understand the next step more clearly.",
};

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanArray<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) && value.length > 0 ? (value as T[]) : fallback;
}

function normalizeClaimsContent(data?: ClaimsContent): ClaimsContent {
  return {
    eyebrow: cleanString(data?.eyebrow, DEFAULT_CONTENT.eyebrow!),
    heroTitle: cleanString(data?.heroTitle, DEFAULT_CONTENT.heroTitle!),
    heroCopy: cleanString(data?.heroCopy, DEFAULT_CONTENT.heroCopy!),
    primaryButtonLabel: cleanString(
      data?.primaryButtonLabel,
      DEFAULT_CONTENT.primaryButtonLabel!
    ),
    quickStartEyebrow: cleanString(
      data?.quickStartEyebrow,
      DEFAULT_CONTENT.quickStartEyebrow!
    ),
    quickStartTitle: cleanString(
      data?.quickStartTitle,
      DEFAULT_CONTENT.quickStartTitle!
    ),
    quickStartCopy: cleanString(
      data?.quickStartCopy,
      DEFAULT_CONTENT.quickStartCopy!
    ),
    claimTypes: cleanArray<ClaimType>(
      data?.claimTypes,
      DEFAULT_CONTENT.claimTypes!
    ),
    processTitle: cleanString(data?.processTitle, DEFAULT_CONTENT.processTitle!),
    processSteps: cleanArray<ProcessStep>(
      data?.processSteps,
      DEFAULT_CONTENT.processSteps!
    ),
    checklistTitle: cleanString(
      data?.checklistTitle,
      DEFAULT_CONTENT.checklistTitle!
    ),
    checklistCopy: cleanString(
      data?.checklistCopy,
      DEFAULT_CONTENT.checklistCopy!
    ),
    checklistItems: cleanArray<string>(
      data?.checklistItems,
      DEFAULT_CONTENT.checklistItems!
    ),
    urgentNote: cleanString(data?.urgentNote, DEFAULT_CONTENT.urgentNote!),
    disclaimer: cleanString(data?.disclaimer, DEFAULT_CONTENT.disclaimer!),
  };
}

function readClaimsCache(): ClaimsCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CLAIMS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ClaimsCachePayload;

    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.content || typeof parsed.content !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function saveClaimsCache(content: ClaimsContent) {
  if (typeof window === "undefined") return;

  try {
    const payload: ClaimsCachePayload = {
      savedAt: new Date().toISOString(),
      content,
    };

    localStorage.setItem(CLAIMS_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not save claims page content for offline use:", error);
  }
}

function formatCacheTime(value?: string) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("en-BW", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getIcon(iconKey?: ClaimType["iconKey"]) {
  switch (iconKey) {
    case "motor":
      return <Car size={18} />;
    case "home":
      return <Home size={18} />;
    case "life":
      return <HeartPulse size={18} />;
    case "business":
      return <Briefcase size={18} />;
    default:
      return <ShieldCheck size={18} />;
  }
}

function claimMessage(item: ClaimType) {
  if (item.message?.trim()) return item.message.trim();

  return `${BASE_WHATSAPP}\n\nType: ${
    item.type || item.title
  }\nIncident date:\nLocation:\nWhat happened:\nYour name:\nPhone:\n\nAttachments: photos/documents if available.`;
}

export default function ClaimsPage() {
  const [content, setContent] = useState<ClaimsContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadClaimsContent() {
      const cached = readClaimsCache();

      if (cached?.content) {
        setContent(normalizeClaimsContent(cached.content));
        setUsingCachedData(true);
        setCacheSavedAt(cached.savedAt);
        setLoading(false);
      }

      try {
        const snap = await getDoc(doc(firestore, "site_content", "claims_page"));

        if (!alive) return;

        if (!snap.exists()) {
          const normalizedDefault = normalizeClaimsContent(DEFAULT_CONTENT);
          setContent(normalizedDefault);
          setUsingCachedData(false);
          setCacheSavedAt("");
          saveClaimsCache(normalizedDefault);
          return;
        }

        const normalized = normalizeClaimsContent(snap.data() as ClaimsContent);

        setContent(normalized);
        setUsingCachedData(false);
        setCacheSavedAt(new Date().toISOString());
        saveClaimsCache(normalized);
      } catch (error) {
        console.error("Failed to load latest claims page content:", error);

        if (!alive) return;

        const fallback = readClaimsCache();

        if (fallback?.content) {
          setContent(normalizeClaimsContent(fallback.content));
          setUsingCachedData(true);
          setCacheSavedAt(fallback.savedAt);
        } else {
          setContent(normalizeClaimsContent(DEFAULT_CONTENT));
          setUsingCachedData(false);
          setCacheSavedAt("");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadClaimsContent();

    return () => {
      alive = false;
    };
  }, []);

  const claimTypes = useMemo(
    () => content.claimTypes || DEFAULT_CLAIM_TYPES,
    [content.claimTypes]
  );

  const processSteps = useMemo(
    () => content.processSteps || DEFAULT_PROCESS_STEPS,
    [content.processSteps]
  );

  const checklistItems = useMemo(
    () => content.checklistItems || DEFAULT_CHECKLIST,
    [content.checklistItems]
  );

  return (
    <main id="main" className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="card-elevated overflow-hidden">
            <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
              <div className="eyebrow">
                <ShieldCheck size={15} />
                {content.eyebrow}
              </div>

              {usingCachedData ? (
                <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                  <WifiOff
                    size={14}
                    className="shrink-0 text-[var(--brand-primary-strong)]"
                  />
                  <span>
                    Showing saved offline claims guidance
                    {cacheSavedAt ? ` • Updated ${formatCacheTime(cacheSavedAt)}` : ""}
                  </span>
                </div>
              ) : null}

              <h1 className="max-w-[12ch]">{content.heroTitle}</h1>

              <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                {content.heroCopy}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={waLink(
                    `${BASE_WHATSAPP}\n\nClaim type (Motor/Home/Life/Funeral/Business):\nDate of incident:\nWhat happened:\nLocation:\nYour name:\nPhone:\n\n(Attach photos/documents if you have them.)`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <MessageCircle size={18} />
                  {content.primaryButtonLabel}
                </a>

                <Link href="/contact" className="btn btn-outline" prefetch={false}>
                  <FileText size={18} />
                  Contact / Office Info
                </Link>

                <Link
                  href="/c/short-term"
                  className="btn btn-ghost"
                  prefetch={false}
                >
                  Browse Cover Types
                </Link>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <InfoCard
                  icon={<Clock size={18} />}
                  title="Faster processing"
                  desc="Clear photos, dates, and supporting documents early can reduce back-and-forth and help the process move more smoothly."
                />
                <InfoCard
                  icon={<CheckCircle2 size={18} />}
                  title="Clear requirements"
                  desc="The exact requirements depend on the product, but the team can guide you on what is actually needed for your case."
                />
                <InfoCard
                  icon={<AlertTriangle size={18} />}
                  title="Avoid delays"
                  desc="Report incidents as soon as possible and keep the facts, names, dates, and documents consistent throughout the process."
                />
              </div>

              {loading ? (
                <p className="mt-5 text-xs font-semibold text-[var(--text-muted)]">
                  Checking latest claims guidance…
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container">
          <div className="mb-6">
            <div className="eyebrow">{content.quickStartEyebrow}</div>
            <h2 className="section-title">{content.quickStartTitle}</h2>
            <p className="section-copy mt-2">{content.quickStartCopy}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {claimTypes.map((item, index) => (
              <ClaimCard
                key={`${item.title}-${index}`}
                title={item.title}
                icon={getIcon(item.iconKey)}
                desc={item.desc}
                message={claimMessage(item)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card h-full">
              <div className="card-inner md:p-8">
                <div className="eyebrow">
                  <ShieldCheck size={15} />
                  Process overview
                </div>

                <h2 className="text-2xl">{content.processTitle}</h2>

                <ol className="mt-5 space-y-4">
                  {processSteps.map((step, index) => (
                    <li key={`${step.title}-${index}`} className="flex gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-extrabold text-[var(--text-on-brand)]">
                        {index + 1}
                      </span>
                      <span>
                        <span className="block text-sm font-extrabold text-[var(--text-primary)]">
                          {step.title}
                        </span>
                        <span className="mt-1 block text-sm leading-7 text-[var(--text-secondary)]">
                          {step.desc}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <a
                    href={waLink(
                      `${BASE_WHATSAPP}\n\nWhat documents do you need for my claim?`
                    )}
                    className="btn btn-outline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText size={18} />
                    Ask for required documents
                  </a>

                  <a
                    href={waLink(BASE_WHATSAPP)}
                    className="btn btn-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={18} />
                    Chat now
                  </a>
                </div>
              </div>
            </div>

            <div className="card-outline-gold h-full">
              <div className="card-inner md:p-8">
                <div className="eyebrow">
                  <FileText size={15} />
                  General checklist
                </div>

                <h2 className="text-2xl">{content.checklistTitle}</h2>

                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  {content.checklistCopy}
                </p>

                <ul className="mt-5 space-y-2">
                  {checklistItems.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                    >
                      <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 frame-gold p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 text-[var(--brand-primary-strong)]"
                    />
                    <p className="text-sm leading-7 text-[var(--text-secondary)]">
                      {content.urgentNote}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container">
          <div className="frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
            <b className="text-[var(--text-primary)]">Note:</b>{" "}
            {content.disclaimer}
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card-outline-gold">
      <div className="card-inner">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <span className="text-[var(--brand-primary-strong)]">{icon}</span>
          <span className="font-extrabold">{title}</span>
        </div>
        <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
          {desc}
        </p>
      </div>
    </div>
  );
}

function ClaimCard({
  title,
  desc,
  icon,
  message,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
  message: string;
}) {
  return (
    <a
      href={waLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="card group block h-full overflow-hidden"
    >
      <div className="card-inner flex h-full flex-col">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--brand-tint)] text-[var(--brand-primary-strong)]">
          {icon}
        </div>

        <h3 className="text-lg">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
          {desc}
        </p>

        <div className="mt-auto pt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand-primary-strong)]">
          <MessageCircle size={16} />
          Start on WhatsApp
        </div>
      </div>
    </a>
  );
}