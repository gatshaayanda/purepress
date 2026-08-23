import Image from "next/image";
import Link from "next/link";
import PurePressStudioVisual from "@/components/purepress/PurePressStudioVisual";
import {
  PUREPRESS_CLIENT_TYPES,
  PUREPRESS_SERVICES,
} from "@/lib/purepress/brand";

const starters = [
  "Uniforms",
  "School items",
  "Team wear",
  "Bags",
  "Towels",
  "Leather",
  "Gifts",
  "Something custom",
] as const;

const process = [
  ["01", "Tell us what you need", "Item, quantity, branding idea and required date."],
  ["02", "Share your artwork", "Have your logo or design ready if you already have it."],
  ["03", "Review the direction", "PurePress confirms the job details and prepares the work for approval."],
  ["04", "Into production", "Approved work moves into computerized embroidery and quality checking."],
  ["05", "Ready", "Your completed branded items are prepared for collection or the agreed handover."],
] as const;

export default function HomePage() {
  return (
    <div className="pp-site">
      <section className="pp-hero">
        <div className="pp-container pp-hero-grid">
          <div>
            <p className="pp-kicker">PurePress Printers · Gaborone, Botswana</p>
            <span className="pp-stitch-line" aria-hidden="true" />
            <h1 className="pp-display">
              Your vision, <em>stitched</em> to stand out.
            </h1>
            <p className="pp-lede">
              Computerized embroidery and garment branding for companies,
              schools, teams, clothing brands and organisations that want a
              clean, durable finish.
            </p>
            <div
              className="pp-thread-swatches"
              aria-label="PurePress thread colour language"
            >
              <span className="pp-thread-chip cyan" title="PurePress cyan" />
              <span
                className="pp-thread-chip magenta"
                title="PurePress magenta"
              />
              <span
                className="pp-thread-chip yellow"
                title="PurePress yellow"
              />
              <span
                className="pp-thread-chip charcoal"
                title="PurePress charcoal"
              />
            </div>
            <div className="pp-actions">
              <Link
                className="pp-button pp-button-primary"
                href="/request-a-quote"
              >
                Request a Quote
              </Link>
              <Link className="pp-button pp-button-secondary" href="/gallery">
                See Our Work
              </Link>
            </div>
          </div>
          <PurePressStudioVisual />
        </div>
      </section>

      <section className="pp-section">
        <div className="pp-container pp-service-discovery">
          <div className="pp-material-panel">
            <p className="pp-kicker pp-kicker-on-dark">Start with the item</p>
            <h2>What are you branding?</h2>
            <p>
              PurePress starts with the real thing in your hands — the garment,
              bag, towel, leather item, badge or gift — then works back to the
              right embroidery approach.
            </p>
            <div className="pp-thread-swatches" aria-hidden="true">
              <span className="pp-thread-chip cyan" />
              <span className="pp-thread-chip magenta" />
              <span className="pp-thread-chip yellow" />
            </div>
          </div>

          <div>
            <p className="pp-kicker">Embroidery services</p>
            <span className="pp-stitch-line" aria-hidden="true" />
            <div className="pp-service-list">
              {PUREPRESS_SERVICES.map((service, index) => (
                <Link
                  className="pp-service-row"
                  href="/services"
                  key={service.title}
                >
                  <span className="index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{service.title}</strong>
                  <span className="arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
            <p className="pp-starting-points">
              Common starting points: {starters.join(" · ")}
            </p>
          </div>
        </div>
      </section>

      <section className="pp-section pp-section-soft">
        <div className="pp-container">
          <p className="pp-kicker">How work moves through the studio</p>
          <span className="pp-stitch-line" aria-hidden="true" />
          <h2 className="pp-section-heading">From idea to finished stitch.</h2>
          <div className="pp-process">
            {process.map(([number, title, copy]) => (
              <div className="pp-process-step" key={number}>
                <b>
                  {number} · {title}
                </b>
                <span>{copy}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pp-section">
        <div className="pp-container pp-work-placeholder">
          <div className="visual" aria-hidden="true">
            <div className="pp-production-stamp">
              <Image
                src="/purepress/brand/purepress-mark.svg"
                alt=""
                width={92}
                height={77}
              />
            </div>
          </div>
          <div className="copy">
            <p className="pp-kicker">Our Work</p>
            <span className="pp-stitch-line" aria-hidden="true" />
            <h2>Made to be worn. Made to represent you.</h2>
            <p>
              We&apos;re preparing more PurePress work for the gallery. In the
              meantime, tell us what you&apos;re branding and we&apos;ll help you plan
              the right finish.
            </p>
            <Link className="pp-button pp-button-secondary" href="/gallery">
              Open Our Work
            </Link>
          </div>
        </div>
      </section>

      <section className="pp-section pp-section-yellow">
        <div className="pp-container pp-final-cta">
          <div>
            <p className="pp-kicker pp-kicker-on-yellow">
              Made for Botswana organisations and teams
            </p>
            <h2 className="pp-section-heading pp-section-heading-wide">
              Bring us the garment. Bring us the idea.
            </h2>
            <p className="pp-final-cta-copy">
              PurePress serves {PUREPRESS_CLIENT_TYPES.join(", ")} and
              customers with custom embroidery needs.
            </p>
          </div>
          <Link
            className="pp-button pp-button-secondary"
            href="/request-a-quote"
          >
            Start your quote
          </Link>
        </div>
      </section>
    </div>
  );
}
