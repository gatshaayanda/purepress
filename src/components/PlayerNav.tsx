import Link from "next/link";

const links = [
  { label: "My Room", href: "/app" },
  { label: "My Week", href: "/app/desk/week-001#replay" },
  { label: "Weakness", href: "/app/desk/week-001#weakness" },
  { label: "Guidance", href: "/app/desk/week-001#guidance" },
  { label: "Positions", href: "/app/desk/week-001#positions" },
];

export default function PlayerNav() {
  return <nav className="player-nav" aria-label="Player Room navigation">{links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</nav>;
}

