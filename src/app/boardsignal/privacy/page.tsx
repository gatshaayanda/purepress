import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

export const metadata: Metadata = { title: "BoardSignal Privacy" };

export default function BoardSignalPrivacyPage() {
  return <div id="main" className="container boardsignal-policy-page">
    <Link href="/boardsignal/player-room" className="desk-back"><ArrowLeft size={16} /> Back to Player Room</Link>
    <header><LockKeyhole /><p className="kicker">PUBLIC COVERAGE · PRIVATE WEAKNESS</p><h1>Your BoardSignal privacy boundary.</h1><p>Founding Access includes a minimal safe sports identity in the BoardSignal Universe. Your diagnostic chess data stays private.</p></header>
    <section>
      <h2>Chess.com identity</h2><p>BoardSignal never requests or stores your Chess.com password. Public Chess.com data is resolved to the stable Chess.com player ID so the same player is not duplicated when usernames or authentication methods change.</p>
      <h2>Private Player Room data</h2><p>Your completed Reviews, Red, private Amber, Blue, reviewed-position evidence, recurrence, private progress, messages, contact details and notification registrations are owner-only data. They are not written into public player or public coverage collections.</p>
      <h2>BoardSignal Universe</h2><p>Founding Access participation includes safe sports-style Universe coverage. Each completed Review can contribute the strongest supported positive coverage item; when no strong positive claim is supported, BoardSignal may use only a neutral non-embarrassing fact or withhold the claim. Private weaknesses and diagnostic evidence are never automatically published.</p>
      <h2>Optional public controls</h2><p>You may choose extra positive highlights, direct public game links or expanded public profile details where those controls are available. The core Founding Access Universe participation itself is included rather than presented as a false off-switch.</p>
      <h2>Messages and browser alerts</h2><p>BoardSignal can deliver private in-app messages. Browser push is separate: BoardSignal asks the browser for notification permission only after you explicitly choose Enable browser alerts. Denial is respected and does not block your Inbox.</p>
      <h2>Retention</h2><p>BoardSignal retains at most four completed Reviews per player. When Review 5 publishes, full Review 1 expires and Reviews 2–5 remain. Small durable personal records may remain only where the existing memory model supports them.</p>
      <h2>Contact</h2><p>Your preferred contact is used for BoardSignal account communication, Review availability, important product updates and BoardSignal feedback. It is not an authentication identity and is not silently converted into unrelated marketing consent.</p>
      <h2>Your choice</h2><p>You may change optional notification categories, stop participating in Founding Access or request deletion of your account data.</p>
    </section>
  </div>;
}
