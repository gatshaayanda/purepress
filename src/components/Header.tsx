"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import SignalMark from "@/components/SignalMark";
import BoardSignalThemeControl from "@/components/BoardSignalThemeControl";
import { isStandaloneBoardSignal } from "@/lib/boardsignal/offline/install";
import { BOARDSIGNAL_FOUNDER_DEVICE_EVENT, BOARDSIGNAL_FOUNDER_DEVICE_KEY } from "@/lib/boardsignal/offline/founderDevice";

const primaryNav = [
  { label: "Home", href: "/" },
  { label: "Around BoardSignal", href: "/feed" },
  { label: "My BoardSignal", href: "/boardsignal/player-room" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [founderEntry, setFounderEntry] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const refresh = () => {
      try { setFounderEntry(isStandaloneBoardSignal() && window.localStorage.getItem(BOARDSIGNAL_FOUNDER_DEVICE_KEY) === "true"); }
      catch { setFounderEntry(false); }
    };
    refresh();
    window.addEventListener(BOARDSIGNAL_FOUNDER_DEVICE_EVENT, refresh);
    return () => window.removeEventListener(BOARDSIGNAL_FOUNDER_DEVICE_EVENT, refresh);
  }, []);


  const active = (href: string) => href === "/" ? pathname === "/" : pathname?.startsWith(href);
  const insideOwnerFlow = pathname?.startsWith("/boardsignal/player-room") || pathname?.startsWith("/boardsignal/build/");

  return (
    <header className="site-header">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="container masthead">
        <Link href="/" className="brand-lockup" aria-label="BoardSignal home">
          <SignalMark className="brand-mark" />
          <span><span className="brand-name">BoardSignal</span><span className="brand-line">Your games, understood</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {primaryNav.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}>{item.label}</Link>)}
        </nav>
        <div className="header-actions">
          <BoardSignalThemeControl className="bs-theme-control-desktop" />
          {!insideOwnerFlow ? <Link href="/#get-my-boardsignal" className="button button-dark header-join">Get My BoardSignal</Link> : null}
          <button type="button" className="menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {open ? <nav className="mobile-nav container" aria-label="Mobile navigation">
        <BoardSignalThemeControl className="bs-theme-control-mobile" />
        {primaryNav.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}>{item.label}</Link>)}
        {founderEntry ? <Link href="/admin">Founder Newsroom</Link> : null}
        {!insideOwnerFlow ? <Link href="/#get-my-boardsignal" className="button button-lime">Get My BoardSignal</Link> : null}
      </nav> : null}
    </header>
  );
}
