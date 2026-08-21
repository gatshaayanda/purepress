"use client";

import { useState } from "react";
import { ArrowRight, BellRing, LoaderCircle, ShieldCheck } from "lucide-react";
import type {
  BoardSignalAccount,
  BoardSignalContactMethod,
  BoardSignalNotificationPreferences,
} from "@/lib/boardsignal/account";

export default function PlayerPreferencesGate({
  account,
  onContinue,
}: {
  account: BoardSignalAccount;
  onContinue: (contact: {
    preferredContactMethod: BoardSignalContactMethod;
    preferredContactValue: string;
    betaContactConsent: true;
  }, notifications: BoardSignalNotificationPreferences) => Promise<void>;
}) {
  const [contactMethod, setContactMethod] = useState<BoardSignalContactMethod>(account.preferredContactMethod ?? "email");
  const [contactValue, setContactValue] = useState(account.preferredContactValue ?? "");
  const [consent, setConsent] = useState(account.betaContactConsent === true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!contactValue.trim()) {
      setError("Add one reachable contact for your Founding Access account.");
      return;
    }
    if (!consent) {
      setError("Confirm the Founding Access contact consent to continue.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onContinue({
        preferredContactMethod: contactMethod,
        preferredContactValue: contactValue.trim(),
        betaContactConsent: true,
      }, account.notificationPreferences);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your communication setup could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="main" className="container beta-agreement-page">
      <section className="beta-agreement-card preference-gate-card">
        <div className="agreement-mark"><BellRing /></div>
        <p className="kicker">ONE LAST SETUP</p>
        <h1>How should BoardSignal reach you?</h1>
        <p className="agreement-deck">Your account already has sensible BoardSignal event preferences switched on. You can change individual categories later in Profile / Notifications.</p>

        <div className="onboarding-contact-card">
          <label>Preferred contact
            <select value={contactMethod} onChange={(event) => setContactMethod(event.target.value as BoardSignalContactMethod)}>
              <option value="email">Email</option>
              <option value="discord">Discord</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <label>{contactMethod === "email" ? "Email address" : contactMethod === "discord" ? "Discord username" : "Telegram username / contact"}
            <input
              value={contactValue}
              onChange={(event) => setContactValue(event.target.value)}
              type={contactMethod === "email" ? "email" : "text"}
              autoComplete={contactMethod === "email" ? "email" : "off"}
              maxLength={160}
            />
          </label>
          <label className="agreement-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree BoardSignal may contact me about my Founding Access account, Review availability, important product updates and BoardSignal feedback.</span></label>
        </div>

        <div className="preference-defaults-summary">
          <strong>BoardSignal updates are on by default</strong>
          <p>Review Ready · This Week Progress · Focus Next Reminder · Around BoardSignal Highlight · Founder Updates</p>
          <small>Browser permission is separate and will never be requested automatically. You can enable browser alerts later with a clear button.</small>
        </div>

        <div className="agreement-universe-required compact">
          <span>AROUND BOARDSIGNAL</span>
          <strong>Included with Founding Access ✓</strong>
          <p>Your private improvement guidance, reviewed positions and progress stay private.</p>
        </div>

        <p className="beta-access-safety"><ShieldCheck size={14} /> Your contact is for BoardSignal account communication only. It is not your authentication identity.</p>
        <button className="button button-lime" type="button" disabled={busy} onClick={save}>{busy ? <><LoaderCircle className="button-spinner" size={16} /> Saving</> : <>Enter My BoardSignal <ArrowRight size={16} /></>}</button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
