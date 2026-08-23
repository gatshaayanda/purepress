"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  ["Home", "/"],
  ["Services", "/services"],
  ["Our Work", "/gallery"],
  ["About", "/about"],
  ["Contact", "/contact"],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PurePressHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <a className="pp-skip-link" href="#main">
        Skip to content
      </a>
      <header className="pp-header">
        <div className="pp-container pp-header-inner">
          <Link
            href="/"
            className="pp-brand-link"
            aria-label="PurePress Printers home"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/purepress/brand/purepress-logo.svg"
              alt="PurePress Printers — Your Vision, Fully Printed"
              width={260}
              height={71}
              priority
            />
          </Link>

          <nav className="pp-desktop-nav" aria-label="Primary navigation">
            {nav.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="pp-header-actions">
            <Link className="pp-login-link" href="/client/login">
              My PurePress
            </Link>
            <Link
              className="pp-button pp-button-primary pp-header-quote"
              href="/request-a-quote"
            >
              Request a Quote
            </Link>
            <button
              className="pp-menu-button"
              type="button"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
              aria-controls="pp-mobile-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? (
                <X size={24} aria-hidden="true" />
              ) : (
                <Menu size={24} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <nav
          id="pp-mobile-nav"
          className={`pp-mobile-nav${open ? " is-open" : ""}`}
          aria-label="Mobile navigation"
        >
          <div className="pp-container">
            {nav.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <Link href="/client/login" onClick={() => setOpen(false)}>
              My PurePress
            </Link>
            <Link
              className="pp-button pp-button-primary"
              href="/request-a-quote"
              onClick={() => setOpen(false)}
            >
              Request a Quote
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
