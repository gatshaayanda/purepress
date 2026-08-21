"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";

type ClaimsPageForm = {
  heroBadge: string;
  heroTitle: string;
  heroText: string;

  stat1Title: string;
  stat1Desc: string;
  stat2Title: string;
  stat2Desc: string;
  stat3Title: string;
  stat3Desc: string;

  motorTitle: string;
  motorDesc: string;
  motorMessage: string;

  homeTitle: string;
  homeDesc: string;
  homeMessage: string;

  lifeTitle: string;
  lifeDesc: string;
  lifeMessage: string;

  businessTitle: string;
  businessDesc: string;
  businessMessage: string;

  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  step4Title: string;
  step4Desc: string;

  checklistText: string;
  urgentNote: string;
  footerNote: string;
};

const DEFAULT_FORM: ClaimsPageForm = {
  heroBadge: "Sparkle Legacy • Claims Support",
  heroTitle: "Claims help — clear steps, fast guidance",
  heroText:
    "If something happened, don’t stress. Share the basics and we’ll guide you on the next steps, required documents, and timelines.",

  stat1Title: "Faster processing",
  stat1Desc:
    "Submit clear photos and documents early to reduce back-and-forth.",
  stat2Title: "Clear requirements",
  stat2Desc:
    "We’ll tell you exactly what’s needed based on your product.",
  stat3Title: "Avoid delays",
  stat3Desc:
    "Report incidents ASAP and keep claim details consistent.",

  motorTitle: "Motor claim",
  motorDesc: "Accident, theft, windscreen, damage.",
  motorMessage:
    "Hi Sparkle Legacy 👋 I need help with a claim.\n\nType: Motor\nIncident date:\nLocation:\nWhat happened:\nVehicle:\nRegistration:\nPolice report (if any):\nYour name & phone:\n\nAttachments: photos, police report, license/ID, repair quote (if available).",

  homeTitle: "Home / contents",
  homeDesc: "Fire, theft, storm damage, burglary.",
  homeMessage:
    "Hi Sparkle Legacy 👋 I need help with a claim.\n\nType: Home/Contents\nIncident date:\nLocation:\nWhat happened:\nItems affected:\nPolice report (if theft):\nYour name & phone:\n\nAttachments: photos, inventory/list, receipts (if any), police report (if theft).",

  lifeTitle: "Life / disability",
  lifeDesc: "Life claim, disability/income protection.",
  lifeMessage:
    "Hi Sparkle Legacy 👋 I need help with a claim.\n\nType: Life/Disability\nEvent date:\nPolicy holder name:\nClaimant name:\nWhat happened:\nYour contact:\n\nAttachments: ID, claim forms, medical docs (if applicable), any policy reference.",

  businessTitle: "Business / SME",
  businessDesc: "Assets, liability, fleet, interruption.",
  businessMessage:
    "Hi Sparkle Legacy 👋 I need help with a claim.\n\nType: Business/SME\nIncident date:\nBusiness name:\nLocation:\nWhat happened:\nItems/asset affected:\nYour contact:\n\nAttachments: photos, invoices/asset list, police report (if theft), supporting docs.",

  step1Title: "Report the incident",
  step1Desc:
    "Share the date, what happened, and where.",
  step2Title: "Send supporting evidence",
  step2Desc:
    "Photos, forms, police report where required, and medical or repair documents.",
  step3Title: "Assessment",
  step3Desc:
    "The insurer reviews the case and may request additional information.",
  step4Title: "Decision & settlement",
  step4Desc:
    "Repair, replace, or pay-out based on policy terms.",

  checklistText: [
    "ID / Omang (or passport) for policyholder/claimant",
    "Policy number or quote reference (if available)",
    "Incident date/time and location",
    "Clear photos/videos of damage / scene",
    "Police report (theft/accident where required)",
    "Medical report / death certificate (life/funeral, where applicable)",
    "Repair quotes / invoices (motor/home/business)",
    "Any claim forms provided by the insurer",
  ].join("\n"),

  urgentNote:
    "If it’s urgent (injury, theft, major damage), message us immediately on WhatsApp so we can guide the safest next steps.",
  footerNote:
    "Cover terms, premiums, and benefits depend on insurer underwriting and your policy wording. If you’re unsure, ask us and we’ll clarify.",
};

export default function AdminClaimsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ClaimsPageForm>(DEFAULT_FORM);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(firestore, "site_content", "claims_page");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as Partial<ClaimsPageForm>;
          setForm({ ...DEFAULT_FORM, ...data });
        }
      } catch (err) {
        console.error("Failed to load claims page content:", err);
        setError("Failed to load claims page content.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setValue = (key: keyof ClaimsPageForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

const handleSave = async () => {
  setSaving(true);
  setError("");

  try {
    const ref = doc(firestore, "site_content", "claims_page");

    const checklistItems = form.checklistText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const publicClaimsShape = {
      eyebrow: form.heroBadge,
      heroTitle: form.heroTitle,
      heroCopy: form.heroText,
      primaryButtonLabel: "Start Claim on WhatsApp",

      quickStartEyebrow: "Quick start",
      quickStartTitle: "Choose your claim type.",
      quickStartCopy:
        "Tap one of the options below and WhatsApp will open with a ready-to-send message template to help you start with the right details.",

      claimTypes: [
        {
          title: form.motorTitle,
          desc: form.motorDesc,
          message: form.motorMessage,
          type: "Motor",
          iconKey: "motor",
        },
        {
          title: form.homeTitle,
          desc: form.homeDesc,
          message: form.homeMessage,
          type: "Home/Contents",
          iconKey: "home",
        },
        {
          title: form.lifeTitle,
          desc: form.lifeDesc,
          message: form.lifeMessage,
          type: "Life/Disability",
          iconKey: "life",
        },
        {
          title: form.businessTitle,
          desc: form.businessDesc,
          message: form.businessMessage,
          type: "Business/SME",
          iconKey: "business",
        },
      ],

      processTitle: "How claims usually work",
      processSteps: [
        {
          title: form.step1Title,
          desc: form.step1Desc,
        },
        {
          title: form.step2Title,
          desc: form.step2Desc,
        },
        {
          title: form.step3Title,
          desc: form.step3Desc,
        },
        {
          title: form.step4Title,
          desc: form.step4Desc,
        },
      ],

      checklistTitle: "Helpful claim checklist",
      checklistCopy:
        "Exact requirements depend on the product and insurer, but the items below often help speed up the process.",
      checklistItems,

      urgentNote: form.urgentNote,
      disclaimer: form.footerNote,
    };

    await setDoc(
      ref,
      {
        ...form,
        ...publicClaimsShape,
        updatedAt: serverTimestamp(),
        admin_id: "admin",
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to save claims page:", err);
    setError("Failed to save claims page.");
  } finally {
    setSaving(false);
  }
};

  if (loading) return <AdminHubLoader />;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5">
              <Link
                href="/admin/dashboard"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <FileText size={15} />
                    Sparkle Legacy • Claims Page Admin
                  </div>

                  <h1 className="max-w-[13ch]">
                    Manage the public claims page content.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    This page controls the public claims help experience,
                    including the hero text, claim type cards, process steps,
                    checklist, and supporting notes.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      {saving ? "Saving..." : "Save Claims Page"}
                    </button>

                    <Link
                      href="/claims"
                      prefetch={false}
                      className="btn btn-outline"
                    >
                      View Public Claims Page
                    </Link>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Firebase wiring
                  </div>

                  <h2 className="mt-2 text-2xl">How this is stored</h2>

                  <ul className="mt-5 space-y-3">
                    {[
                      "Collection: site_content",
                      "Document: claims_page",
                      "One document stores the whole claims page",
                      "Public /claims can later read the same doc",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                      >
                        <Sparkles
                          size={16}
                          className="mt-[5px] shrink-0 text-[var(--brand-primary-strong)]"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {error ? (
                    <div className="mt-6 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <SectionCard title="Hero">
                <Field
                  label="Badge"
                  value={form.heroBadge}
                  onChange={(v) => setValue("heroBadge", v)}
                />
                <Field
                  label="Title"
                  value={form.heroTitle}
                  onChange={(v) => setValue("heroTitle", v)}
                />
                <TextAreaField
                  label="Hero Text"
                  value={form.heroText}
                  onChange={(v) => setValue("heroText", v)}
                />
              </SectionCard>

              <SectionCard title="Top Support Cards">
                <Field
                  label="Card 1 Title"
                  value={form.stat1Title}
                  onChange={(v) => setValue("stat1Title", v)}
                />
                <TextAreaField
                  label="Card 1 Description"
                  value={form.stat1Desc}
                  onChange={(v) => setValue("stat1Desc", v)}
                />
                <Field
                  label="Card 2 Title"
                  value={form.stat2Title}
                  onChange={(v) => setValue("stat2Title", v)}
                />
                <TextAreaField
                  label="Card 2 Description"
                  value={form.stat2Desc}
                  onChange={(v) => setValue("stat2Desc", v)}
                />
                <Field
                  label="Card 3 Title"
                  value={form.stat3Title}
                  onChange={(v) => setValue("stat3Title", v)}
                />
                <TextAreaField
                  label="Card 3 Description"
                  value={form.stat3Desc}
                  onChange={(v) => setValue("stat3Desc", v)}
                />
              </SectionCard>

              <SectionCard title="Claim Type Cards">
                <ClaimCardFields
                  titleLabel="Motor Title"
                  descLabel="Motor Description"
                  messageLabel="Motor WhatsApp Message"
                  titleValue={form.motorTitle}
                  descValue={form.motorDesc}
                  messageValue={form.motorMessage}
                  onTitle={(v) => setValue("motorTitle", v)}
                  onDesc={(v) => setValue("motorDesc", v)}
                  onMessage={(v) => setValue("motorMessage", v)}
                />

                <ClaimCardFields
                  titleLabel="Home Title"
                  descLabel="Home Description"
                  messageLabel="Home WhatsApp Message"
                  titleValue={form.homeTitle}
                  descValue={form.homeDesc}
                  messageValue={form.homeMessage}
                  onTitle={(v) => setValue("homeTitle", v)}
                  onDesc={(v) => setValue("homeDesc", v)}
                  onMessage={(v) => setValue("homeMessage", v)}
                />

                <ClaimCardFields
                  titleLabel="Life Title"
                  descLabel="Life Description"
                  messageLabel="Life WhatsApp Message"
                  titleValue={form.lifeTitle}
                  descValue={form.lifeDesc}
                  messageValue={form.lifeMessage}
                  onTitle={(v) => setValue("lifeTitle", v)}
                  onDesc={(v) => setValue("lifeDesc", v)}
                  onMessage={(v) => setValue("lifeMessage", v)}
                />

                <ClaimCardFields
                  titleLabel="Business Title"
                  descLabel="Business Description"
                  messageLabel="Business WhatsApp Message"
                  titleValue={form.businessTitle}
                  descValue={form.businessDesc}
                  messageValue={form.businessMessage}
                  onTitle={(v) => setValue("businessTitle", v)}
                  onDesc={(v) => setValue("businessDesc", v)}
                  onMessage={(v) => setValue("businessMessage", v)}
                />
              </SectionCard>

              <SectionCard title="Claims Process Steps">
                <Field
                  label="Step 1 Title"
                  value={form.step1Title}
                  onChange={(v) => setValue("step1Title", v)}
                />
                <TextAreaField
                  label="Step 1 Description"
                  value={form.step1Desc}
                  onChange={(v) => setValue("step1Desc", v)}
                />

                <Field
                  label="Step 2 Title"
                  value={form.step2Title}
                  onChange={(v) => setValue("step2Title", v)}
                />
                <TextAreaField
                  label="Step 2 Description"
                  value={form.step2Desc}
                  onChange={(v) => setValue("step2Desc", v)}
                />

                <Field
                  label="Step 3 Title"
                  value={form.step3Title}
                  onChange={(v) => setValue("step3Title", v)}
                />
                <TextAreaField
                  label="Step 3 Description"
                  value={form.step3Desc}
                  onChange={(v) => setValue("step3Desc", v)}
                />

                <Field
                  label="Step 4 Title"
                  value={form.step4Title}
                  onChange={(v) => setValue("step4Title", v)}
                />
                <TextAreaField
                  label="Step 4 Description"
                  value={form.step4Desc}
                  onChange={(v) => setValue("step4Desc", v)}
                />
              </SectionCard>

              <SectionCard title="Checklist & Notes">
                <TextAreaField
                  label="Checklist Items"
                  help="One item per line."
                  rows={10}
                  value={form.checklistText}
                  onChange={(v) => setValue("checklistText", v)}
                />
                <TextAreaField
                  label="Urgent Note"
                  value={form.urgentNote}
                  onChange={(v) => setValue("urgentNote", v)}
                />
                <TextAreaField
                  label="Footer Note"
                  value={form.footerNote}
                  onChange={(v) => setValue("footerNote", v)}
                />
              </SectionCard>
            </div>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> this
              setup is intentionally simple. One Firestore doc drives the whole
              claims page, which makes the public page easy to wire next.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-outline-gold">
      <div className="card-inner space-y-4 md:p-8">
        <h2 className="text-2xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
      </label>
      <input
        className="input mt-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  help,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
      </label>
      <textarea
        rows={rows}
        className="input mt-2 resize-y rounded-[1.25rem]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {help ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">{help}</p>
      ) : null}
    </div>
  );
}

function ClaimCardFields({
  titleLabel,
  descLabel,
  messageLabel,
  titleValue,
  descValue,
  messageValue,
  onTitle,
  onDesc,
  onMessage,
}: {
  titleLabel: string;
  descLabel: string;
  messageLabel: string;
  titleValue: string;
  descValue: string;
  messageValue: string;
  onTitle: (value: string) => void;
  onDesc: (value: string) => void;
  onMessage: (value: string) => void;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="space-y-4">
        <Field label={titleLabel} value={titleValue} onChange={onTitle} />
        <TextAreaField
          label={descLabel}
          value={descValue}
          onChange={onDesc}
        />
        <TextAreaField
          label={messageLabel}
          value={messageValue}
          onChange={onMessage}
          rows={6}
        />
      </div>
    </div>
  );
}