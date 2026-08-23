import Image from "next/image";
import Link from "next/link";
import { PUREPRESS_BRAND } from "@/lib/purepress/brand";

const links = [
  ["Services", "/services"],
  ["Our Work", "/gallery"],
  ["About", "/about"],
  ["Contact", "/contact"],
  ["Request a Quote", "/request-a-quote"],
  ["My PurePress", "/client/login"],
] as const;

export default function PurePressFooter() {
  return (
    <footer className="pp-footer">
      <div className="pp-container pp-footer-grid">
        <div className="pp-footer-brand">
          <Image
            src="/purepress/brand/purepress-logo-light.svg"
            alt="PurePress Printers"
            width={285}
            height={78}
          />
          <p>{PUREPRESS_BRAND.tagline}</p>
          <p>Gaborone, Botswana · Computerized embroidery &amp; garment branding</p>
        </div>

        <div>
          <h2>Studio</h2>
          <nav aria-label="Footer navigation">
            {links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2>Contact</h2>
          <address>
            <span>{PUREPRESS_BRAND.address[0]}</span>
            <span>{PUREPRESS_BRAND.address[1]}</span>
            <a href={`mailto:${PUREPRESS_BRAND.email}`}>
              {PUREPRESS_BRAND.email}
            </a>
            {PUREPRESS_BRAND.phones.map((phone) => (
              <a key={phone.href} href={phone.href}>
                {phone.display}
              </a>
            ))}
          </address>
        </div>
      </div>

      <div className="pp-container pp-footer-bottom">
        <span>© {new Date().getFullYear()} PurePress Printers</span>
        <span>Embroidery &amp; garment branding in Gaborone, Botswana</span>
      </div>
    </footer>
  );
}
