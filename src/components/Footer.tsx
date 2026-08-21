import Link from "next/link";
import SignalMark from "@/components/SignalMark";

const footerLinks = [
  { label: "Get My BoardSignal", href: "/#get-my-boardsignal" },
  { label: "BoardSignal Universe", href: "/feed" },
  { label: "My Player Room", href: "/boardsignal/player-room" },
  { label: "Founding Access terms", href: "/boardsignal/beta-terms" },
  { label: "Privacy", href: "/boardsignal/privacy" },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <SignalMark className="footer-mark" />
          <div>
            <p className="brand-name">BoardSignal</p>
            <p>One seven-day episode at a time.</p>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="footer-links">
          {footerLinks.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>

        <div className="footer-note">
          <p className="kicker">Privacy rule</p>
          <p>Public highlight. Private weakness. Players control when their name and game links appear.</p>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} BoardSignal</span>
        <span>Built by Admin Hub · Gaborone, Botswana</span>
      </div>
    </footer>
  );
}
