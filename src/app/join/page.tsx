import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import UsernameDeskForm from "@/components/UsernameDeskForm";

export const metadata = { title: "Get My BoardSignal" };

export default function JoinPage() {
  return (
    <div id="main" className="player-gateway-page">
      <section className="container find-desk-page">
        <Link href="/" className="desk-back"><ArrowLeft size={16} /> Back home</Link>
        <p className="kicker">Founding Access</p>
        <h1>Get your BoardSignal.</h1>
        <p className="standfirst">Start with your public Chess.com username. BoardSignal confirms the canonical account, then you can request Founding Access with one reachable contact method.</p>
        <UsernameDeskForm />
        <div className="gateway-privacy-note"><ShieldCheck size={20} /><div><strong>BoardSignal never asks for a Chess.com password.</strong><p>Your contact is for BoardSignal account communication only. It is not used as your authentication identity or exposed on your public player coverage.</p></div></div>
      </section>
    </div>
  );
}
