import Link from "next/link";
import { PUREPRESS_BRAND } from "@/lib/purepress/brand";

export default function ContactPage() {
  return (
    <div className="pp-site">
      <section className="pp-section">
        <div className="pp-container">
          <p className="pp-kicker">Contact the studio</p>
          <span className="pp-stitch-line" aria-hidden="true" />
          <h1 className="pp-display pp-display-wide">
            Talk to PurePress about the work.
          </h1>
          <p className="pp-lede">
            Have the item, approximate quantity, logo or wording and your
            required date ready if you know them. PurePress can take it from
            there.
          </p>

          <div className="pp-service-discovery pp-service-discovery-spaced">
            <div className="pp-material-panel">
              <h2>Gaborone West.</h2>
              <p>{PUREPRESS_BRAND.address.join(", ")}</p>
              <p>
                <a className="pp-link-on-dark" href={`mailto:${PUREPRESS_BRAND.email}`}>
                  {PUREPRESS_BRAND.email}
                </a>
              </p>
              {PUREPRESS_BRAND.phones.map((phone) => (
                <p key={phone.href}>
                  <a className="pp-link-on-dark" href={phone.href}>
                    {phone.display}
                  </a>
                </p>
              ))}
            </div>

            <div>
              <p className="pp-kicker">Ready to brief the studio?</p>
              <h2 className="pp-section-heading pp-section-heading-wide">
                Tell us what you are branding.
              </h2>
              <p className="pp-lede">
                Start with the item, quantity, placement and date. If you
                already have a logo or artwork, keep it ready — we&apos;ll ask for
                it securely as the quotation comes together.
              </p>
              <div className="pp-actions">
                <Link
                  className="pp-button pp-button-primary"
                  href="/request-a-quote"
                >
                  Request a Quote
                </Link>
                <Link
                  className="pp-button pp-button-secondary"
                  href="/client/login"
                >
                  Open My PurePress
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
