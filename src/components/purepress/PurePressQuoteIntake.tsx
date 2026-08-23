"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadFiles } from "@/utils/uploadthing";
import { validatePurePressUploadCandidate } from "@/lib/purepress/uploads";
import styles from "./PurePressQuoteIntake.module.css";

const ITEM_OPTIONS = [
  ["corporate_uniforms", "Corporate uniforms"],
  ["school_items", "School items"],
  ["team_wear", "Team wear"],
  ["shirts_polos", "Shirts / polos"],
  ["jackets_workwear", "Jackets / workwear"],
  ["bags", "Bags"],
  ["towels", "Towels"],
  ["leather", "Leather"],
  ["gifts_promotional", "Gifts / promotional items"],
  ["custom", "Something custom"],
] as const;

const SUPPLY_OPTIONS = [
  ["customer_supplied", "I already have the items / garments"],
  ["purepress_supplied", "I need PurePress to help supply them"],
  ["mixed", "Some are mine, some need supplying"],
  ["unknown", "I'm not sure yet"],
] as const;

const PLACEMENT_OPTIONS = [
  ["left_chest", "Left chest"],
  ["right_chest", "Right chest"],
  ["sleeve", "Sleeve"],
  ["back", "Back"],
  ["badge_position", "Badge position"],
  ["pocket", "Pocket"],
  ["bag_towel_position", "Bag / towel position"],
  ["other", "Other"],
] as const;

const ARTWORK_OPTIONS = [
  ["artwork_ready", "Yes, I have a logo/design"],
  ["artwork_needs_work", "I have something but it may need work"],
  ["needs_design_help", "No, I need help"],
  ["unsure", "Not sure"],
] as const;

const STEPS = [
  "What are we branding?",
  "Where are the items coming from?",
  "How many?",
  "Where should the embroidery go?",
  "Do you have artwork?",
  "When do you need it?",
  "How should we reach you?",
  "Collection / delivery intent",
  "Anything else PurePress should know?",
] as const;

interface IntakeSession {
  intakeId: string;
  token: string;
  expiresAt: string;
}

interface UploadedArtwork {
  jobFileId: string;
  fileName: string;
}

interface FormState {
  itemCategory: string;
  customItemDescription: string;
  supplySource: string;
  quantity: string;
  sizeBreakdown: string;
  itemColours: string;
  placements: string[];
  placementNotes: string;
  artworkState: string;
  requestedDate: string;
  timingFlexible: boolean;
  fullName: string;
  organisation: string;
  email: string;
  phone: string;
  preferredContactMethod: string;
  fulfillmentIntent: string;
  customerNotes: string;
  processingAcknowledged: boolean;
}

const initialState: FormState = {
  itemCategory: "",
  customItemDescription: "",
  supplySource: "",
  quantity: "",
  sizeBreakdown: "",
  itemColours: "",
  placements: [],
  placementNotes: "",
  artworkState: "",
  requestedDate: "",
  timingFlexible: false,
  fullName: "",
  organisation: "",
  email: "",
  phone: "",
  preferredContactMethod: "email",
  fulfillmentIntent: "",
  customerNotes: "",
  processingAcknowledged: false,
};

function splitColours(value: string) {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean).slice(0, 12);
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Something went wrong. Please try again.";
}

export default function PurePressQuoteIntake() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [artwork, setArtwork] = useState<UploadedArtwork[]>([]);
  const [uploadState, setUploadState] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ referenceCode: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const progress = useMemo(() => Math.round(((step + 1) / STEPS.length) * 100), [step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function togglePlacement(value: string) {
    setForm((current) => ({
      ...current,
      placements: current.placements.includes(value)
        ? current.placements.filter((item) => item !== value)
        : current.placements.length < 8 ? [...current.placements, value] : current.placements,
    }));
    setError("");
  }

  function validateCurrentStep() {
    if (step === 0 && !form.itemCategory) return "Choose what PurePress will brand.";
    if (step === 0 && form.itemCategory === "custom" && !form.customItemDescription.trim()) return "Tell us what custom item you want branded.";
    if (step === 1 && !form.supplySource) return "Tell us where the items are coming from.";
    if (step === 2 && (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1)) return "Enter an approximate quantity of at least 1.";
    if (step === 3 && form.placements.length === 0) return "Choose at least one embroidery placement.";
    if (step === 4 && !form.artworkState) return "Tell us whether you have artwork.";
    if (step === 5 && !form.timingFlexible && !form.requestedDate) return "Choose a preferred date or mark your timing as flexible.";
    if (step === 6 && !form.fullName.trim()) return "Enter your full name.";
    if (step === 6 && !form.email.trim()) return "Enter your email address.";
    if (step === 6 && (form.preferredContactMethod === "phone" || form.preferredContactMethod === "whatsapp") && !form.phone.trim()) return "Add a phone number for your preferred contact method.";
    return "";
  }

  function next() {
    const message = validateCurrentStep();
    if (message) {
      setError(message);
      return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
    setError("");
  }

  async function ensureIntakeSession() {
    if (session && Date.parse(session.expiresAt) > Date.now() + 30_000) return session;
    const response = await fetch("/api/purepress/quote-intake/session", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "PurePress could not start the artwork upload.");
    const created = data as IntakeSession;
    setSession(created);
    return created;
  }

  async function handleArtwork(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const selected = Array.from(files);
    if (artwork.length + selected.length > 3) {
      setError("You can attach up to 3 artwork files.");
      return;
    }

    try {
      for (const file of selected) validatePurePressUploadCandidate("quote_artwork", file);
      const activeSession = await ensureIntakeSession();
      const completed: UploadedArtwork[] = [];
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        setUploadState(`Uploading ${index + 1} of ${selected.length}: ${file.name}`);
        const result = await uploadFiles("purePressQuoteArtwork", {
          files: [file],
          headers: {
            "x-purepress-intake-id": activeSession.intakeId,
            "x-purepress-intake-token": activeSession.token,
          },
        });
        const serverData = result[0]?.serverData as UploadedArtwork | undefined;
        if (!serverData?.jobFileId) throw new Error(`${file.name} uploaded without a PurePress file receipt.`);
        completed.push(serverData);
      }
      setArtwork((current) => [...current, ...completed]);
      setUploadState("Artwork uploaded securely.");
    } catch (reason) {
      setUploadState("");
      setError(errorMessage(reason));
    }
  }

  async function submit() {
    if (!form.processingAcknowledged) {
      setError("Please confirm PurePress may use these details to prepare and follow up on your request.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const body = {
        itemCategory: form.itemCategory,
        customItemDescription: form.customItemDescription,
        supplySource: form.supplySource,
        quantity: Number(form.quantity),
        sizeBreakdown: form.sizeBreakdown,
        itemColours: splitColours(form.itemColours),
        placements: form.placements.map((position) => ({
          position,
          ...(form.placementNotes.trim() ? { notes: form.placementNotes.trim() } : {}),
        })),
        artworkState: form.artworkState,
        artworkFileIds: artwork.map((file) => file.jobFileId),
        requestedDate: form.timingFlexible ? undefined : form.requestedDate,
        timingFlexible: form.timingFlexible,
        contact: {
          fullName: form.fullName,
          organisation: form.organisation,
          email: form.email,
          phone: form.phone,
          preferredContactMethod: form.preferredContactMethod,
        },
        fulfillmentIntent: form.fulfillmentIntent || undefined,
        customerNotes: form.customerNotes,
        processingAcknowledged: true,
      };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (artwork.length) {
        if (!session) throw new Error("Artwork authorization is missing. Please upload the artwork again.");
        headers["x-purepress-intake-id"] = session.intakeId;
        headers["x-purepress-intake-token"] = session.token;
      }
      const response = await fetch("/api/purepress/quote-requests", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "PurePress could not save your request.");
      setSuccess({ referenceCode: data.referenceCode });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className={styles.success} aria-labelledby="quote-success-title">
        <p className="pp-kicker">REQUEST RECEIVED</p>
        <span className="pp-stitch-line" aria-hidden="true" />
        <h2 id="quote-success-title">Thanks, {form.fullName.trim()}.</h2>
        <p>PurePress has your embroidery brief.</p>
        <p>We&apos;ll review the items, quantity, artwork and timing before preparing the next step.</p>
        <div className={styles.reference}>
          <span>Your reference</span>
          <strong>{success.referenceCode}</strong>
        </div>
        <p className={styles.muted}>Timing will be confirmed by PurePress. This request does not mean a price, deadline or production slot has been accepted.</p>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-labelledby="quote-step-title">
      <div className={styles.progressHeader}>
        <span>STEP {step + 1} OF {STEPS.length}</span>
        <span>{progress}%</span>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <form onSubmit={(event) => event.preventDefault()} noValidate>
        <fieldset className={styles.fieldset}>
          <legend className={styles.srOnly}>Quote request step {step + 1}</legend>
          <h2 id="quote-step-title" ref={headingRef} tabIndex={-1} className={styles.stepTitle}>{STEPS[step]}</h2>

          {step === 0 && (
            <div className={styles.choiceGrid}>
              {ITEM_OPTIONS.map(([value, label]) => (
                <button key={value} type="button" className={form.itemCategory === value ? styles.choiceSelected : styles.choice} onClick={() => update("itemCategory", value)} aria-pressed={form.itemCategory === value}>{label}</button>
              ))}
              {form.itemCategory === "custom" && (
                <label className={styles.fullField}>Tell us what it is
                  <input value={form.customItemDescription} onChange={(event) => update("customItemDescription", event.target.value)} maxLength={300} />
                </label>
              )}
            </div>
          )}

          {step === 1 && (
            <div className={styles.stack}>
              {SUPPLY_OPTIONS.map(([value, label]) => (
                <label key={value} className={styles.radioRow}>
                  <input type="radio" name="supplySource" value={value} checked={form.supplySource === value} onChange={() => update("supplySource", value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className={styles.stack}>
              <label>Approximate quantity
                <input type="number" inputMode="numeric" min="1" max="100000" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} placeholder="e.g. 25" />
              </label>
              <label>Size breakdown <span className={styles.optional}>optional</span>
                <textarea value={form.sizeBreakdown} onChange={(event) => update("sizeBreakdown", event.target.value)} maxLength={500} placeholder="e.g. 5 S, 10 M, 10 L" />
              </label>
              <label>Item colours <span className={styles.optional}>optional</span>
                <input value={form.itemColours} onChange={(event) => update("itemColours", event.target.value)} maxLength={300} placeholder="e.g. navy, white" />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className={styles.stack}>
              <div className={styles.choiceGrid}>
                {PLACEMENT_OPTIONS.map(([value, label]) => (
                  <button key={value} type="button" className={form.placements.includes(value) ? styles.choiceSelected : styles.choice} onClick={() => togglePlacement(value)} aria-pressed={form.placements.includes(value)}>{label}</button>
                ))}
              </div>
              <label>Placement notes <span className={styles.optional}>optional</span>
                <textarea value={form.placementNotes} onChange={(event) => update("placementNotes", event.target.value)} maxLength={200} placeholder="Anything useful about size or exact position" />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className={styles.stack}>
              {ARTWORK_OPTIONS.map(([value, label]) => (
                <label key={value} className={styles.radioRow}>
                  <input type="radio" name="artworkState" value={value} checked={form.artworkState === value} onChange={() => update("artworkState", value)} />
                  <span>{label}</span>
                </label>
              ))}
              {(form.artworkState === "artwork_ready" || form.artworkState === "artwork_needs_work") && (
                <div className={styles.uploadBox}>
                  <label htmlFor="quote-artwork">Attach artwork <span className={styles.optional}>up to 3 files</span></label>
                  <input id="quote-artwork" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf" multiple onChange={(event) => void handleArtwork(event.target.files)} disabled={artwork.length >= 3 || Boolean(uploadState && !uploadState.includes("securely"))} />
                  <p>PNG, JPG, WEBP or PDF. Maximum 8 MB per file. Customer artwork is kept private and is not treated as a production file.</p>
                  {uploadState && <p className={styles.uploadState} role="status">{uploadState}</p>}
                  {artwork.length > 0 && (
                    <ul className={styles.fileList}>{artwork.map((file) => <li key={file.jobFileId}>{file.fileName}</li>)}</ul>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className={styles.stack}>
              <label>Preferred date
                <input type="date" value={form.requestedDate} onChange={(event) => update("requestedDate", event.target.value)} disabled={form.timingFlexible} />
              </label>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={form.timingFlexible} onChange={(event) => update("timingFlexible", event.target.checked)} />
                <span>I&apos;m flexible</span>
              </label>
              <p className={styles.muted}>This is your requested timing, not a promised completion date. PurePress will confirm timing after reviewing the job.</p>
            </div>
          )}

          {step === 6 && (
            <div className={styles.stack}>
              <label>Full name
                <input autoComplete="name" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} maxLength={120} />
              </label>
              <label>Organisation / school / company / team <span className={styles.optional}>optional</span>
                <input autoComplete="organization" value={form.organisation} onChange={(event) => update("organisation", event.target.value)} maxLength={160} />
              </label>
              <label>Email
                <input type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} maxLength={254} />
              </label>
              <label>Phone <span className={styles.optional}>needed for phone / WhatsApp preference</span>
                <input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={40} />
              </label>
              <label>Preferred contact method
                <select value={form.preferredContactMethod} onChange={(event) => update("preferredContactMethod", event.target.value)}>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
            </div>
          )}

          {step === 7 && (
            <div className={styles.stack}>
              {[
                ["collect", "Collect from PurePress"],
                ["delivery_may_be_needed", "Delivery may be needed"],
                ["unsure", "Not sure yet"],
              ].map(([value, label]) => (
                <label key={value} className={styles.radioRow}>
                  <input type="radio" name="fulfillmentIntent" value={value} checked={form.fulfillmentIntent === value} onChange={() => update("fulfillmentIntent", value)} />
                  <span>{label}</span>
                </label>
              ))}
              <p className={styles.muted}>This only records your intent. Delivery availability and any charges will be confirmed separately.</p>
            </div>
          )}

          {step === 8 && (
            <div className={styles.stack}>
              <label>Customer notes <span className={styles.optional}>optional</span>
                <textarea rows={6} value={form.customerNotes} onChange={(event) => update("customerNotes", event.target.value)} maxLength={1500} placeholder="Anything else that will help us understand the job" />
              </label>
              <div className={styles.reviewCard}>
                <strong>Before you send</strong>
                <p>{form.quantity || "—"} item(s) · {form.placements.length} placement(s) · {artwork.length} artwork file(s)</p>
                <p>PurePress will review your brief before confirming price, timing or production.</p>
              </div>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={form.processingAcknowledged} onChange={(event) => update("processingAcknowledged", event.target.checked)} />
                <span>I understand PurePress will use these details to prepare and follow up on my quotation request.</span>
              </label>
            </div>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.actions}>
            {step > 0 && <button type="button" className={styles.secondaryButton} onClick={() => { setStep((current) => current - 1); setError(""); }} disabled={submitting}>Back</button>}
            {step < STEPS.length - 1 ? (
              <button type="button" className={styles.primaryButton} onClick={next}>Continue</button>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={() => void submit()} disabled={submitting}>{submitting ? "Sending request…" : "Send quotation request"}</button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
