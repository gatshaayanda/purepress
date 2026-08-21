import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { FOUNDING_BETA_AGREEMENT_VERSION } from "@/lib/boardsignal/account";

export const metadata: Metadata = { title: "Founding Access Terms" };

export default function BoardSignalBetaTermsPage() {
  return <div id="main" className="container boardsignal-policy-page">
    <Link href="/boardsignal/player-room" className="desk-back"><ArrowLeft size={16} /> Back to Player Room</Link>
    <header><ShieldCheck /><p className="kicker">BOARD SIGNAL FOUNDING ACCESS</p><h1>Plain-language Founding Access terms.</h1><p>Version: {FOUNDING_BETA_AGREEMENT_VERSION}</p></header>
    <section>
      <h2>What BoardSignal does</h2><p>BoardSignal uses available public Chess.com game data to create your private seven-day Review, including deterministic factual performance summaries, selected position review and supported Signals.</p>
      <h2>Your private experience</h2><p>Your full Review, Red, private Amber, Blue, reviewed positions, evidence, recurring patterns, Inbox and week-to-week progress remain private to your Player Room.</p>
      <h2>Universe participation is included</h2><p>Each completed Review under Founding Access may contribute at least one safe sports-style public coverage item to the BoardSignal Universe. BoardSignal selects only supported positive or neutral, non-embarrassing coverage. It never automatically publishes Red, private Amber, Blue, engine correction evidence, recurrence, private progress, private notes or negative diagnostic language.</p>
      <h2>Recent state</h2><p>BoardSignal stores your current account state and latest four completed Reviews. When a fifth Review publishes, the oldest full Review and its heavy evidence are removed after any already-supported small durable personal records are updated.</p>
      <h2>Communication</h2><p>A reachable email, Discord or Telegram contact is required for a new Founding Access request and is used only for BoardSignal account communication, Review availability, important product updates and BoardSignal feedback. It is not your login identity. Core BoardSignal event categories begin on by default and can be changed later in Profile / Notifications.</p>
      <h2>Browser push</h2><p>Browser alerts are optional. BoardSignal will not trigger the browser permission dialog automatically. You must choose Enable browser alerts before permission is requested, and in-app Inbox delivery continues if push is unavailable or denied.</p>
      <h2>Founding Access</h2><p>Founding Access is currently provided without payment. Features, limits and future commercial terms may change before a paid version; this agreement does not promise permanent free access.</p>
      <h2>Your choice</h2><p>You may change optional communication settings, stop participating or request account deletion. Core safe Universe participation is a disclosed Founding Access participation rule, not an optional checkbox.</p>
    </section>
  </div>;
}
