import Link from "next/link";

const prompts = [
  [
    "What are we branding?",
    "Garments, uniforms, school items, team wear, bags, towels, leather, gifts or something custom.",
  ],
  ["How many?", "An approximate quantity is enough to get started."],
  [
    "Where should the embroidery go?",
    "For example: chest, sleeve, back, badge position or another placement.",
  ],
  [
    "Do you already have a logo?",
    "Have your logo or artwork ready if you already have it. We'll ask for it securely when we prepare your quotation.",
  ],
  [
    "When do you need it?",
    "Share your required date so we can understand the timing of the job.",
  ],
  [
    "How should we reach you?",
    "Have your preferred contact details ready so our team can follow up with you.",
  ],
] as const;

export default function RequestQuotePage() {
  return (
    <div className="pp-site">
      <section className="pp-section">
        <div className="pp-container">
          <p className="pp-kicker">Start a PurePress job</p>
          <span className="pp-stitch-line" aria-hidden="true" />
          <h1 className="pp-display pp-display-wide">
            Tell us what you&apos;re branding.
          </h1>
          <p className="pp-lede">
            We&apos;ll start with a few useful details so the PurePress team can
            understand the item, embroidery placement, quantity and timing.
          </p>

          <div className="pp-service-list pp-service-list-spaced">
            {prompts.map(([title, copy], index) => (
              <section
                className="pp-service-row pp-quote-prompt"
                key={title}
              >
                <span className="index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </div>
              </section>
            ))}
          </div>

          <p className="pp-quote-note">
            When you&apos;re ready, contact PurePress and we&apos;ll help turn these
            details into the right quotation for your job.
          </p>
          <div className="pp-actions">
            <Link className="pp-button pp-button-primary" href="/contact">
              Contact PurePress
            </Link>
            <Link className="pp-button pp-button-secondary" href="/services">
              Review services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
