"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function BetaAgreementGate({ onAccept }: { onAccept: () => Promise<void> }) {
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("boardsignal:context", { detail: { activeTab: "agreement" } }));
    return () => { window.dispatchEvent(new CustomEvent("boardsignal:context", { detail: { activeTab: "desk" } })); };
  }, []);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await onAccept();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The agreement could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="main" className="container beta-agreement-page">
      <section className="beta-agreement-card">
        <div className="agreement-mark"><ShieldCheck size={28} /></div>
        <p className="kicker">FOUNDING ACCESS AGREEMENT</p>
        <h1>Your private review stays private.</h1>
        <p className="agreement-deck">Before entering My BoardSignal, here is the plain-language agreement for Founding Access.</p>
        <ul>
          <li>BoardSignal processes your Chess.com game data to create your BoardSignal experience.</li>
          <li>Your full review, improvement guidance, reviewed positions, recurring patterns and private progress are private.</li>
          <li><strong>Each completed Review may contribute at least one safe positive or neutral public highlight around BoardSignal.</strong></li>
          <li>Public highlights use positive or neutral supported facts only. BoardSignal never automatically publishes private improvement guidance, reviewed positions or negative diagnostic language.</li>
          <li>BoardSignal may store your recent account state and latest four completed reviews.</li>
          <li>Founding Access is currently provided without payment. Features, limits and future commercial terms may evolve before a paid product.</li>
          <li>You may stop participating or request account deletion.</li>
          <li>Communication preferences are separate. Browser alerts require a separate explicit permission action.</li>
        </ul>
        <div className="agreement-universe-required">
          <span>AROUND BOARDSIGNAL</span>
          <strong>Included with Founding Access ✓</strong>
          <p>Public highlights. Private improvement guidance.</p>
        </div>
        <div className="agreement-links"><Link href="/boardsignal/beta-terms">Read Founding Access terms</Link><Link href="/boardsignal/privacy">Read privacy summary</Link></div>
        <label className="agreement-check"><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /><span>I understand and accept the Founding Access Agreement, including safe public participation.</span></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button-lime" type="button" disabled={!understood || busy} onClick={accept}>Continue <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}
