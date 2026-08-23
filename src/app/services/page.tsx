import Link from "next/link";
import { PUREPRESS_SERVICES } from "@/lib/purepress/brand";

export default function ServicesPage() {
  return (
    <div className="pp-site">
      <section className="pp-section">
        <div className="pp-container">
          <p className="pp-kicker">Inside the PurePress studio</p>
          <span className="pp-stitch-line" aria-hidden="true" />
          <h1 className="pp-display pp-display-wide">What are you branding?</h1>
          <p className="pp-lede">
            Start with the item and the job you need done. PurePress will help
            translate your logo, wording or design into the appropriate
            embroidery approach.
          </p>

          <div className="pp-service-list pp-service-list-spaced">
            {PUREPRESS_SERVICES.map((service, index) => (
              <article
                className="pp-service-row pp-service-row-detail"
                key={service.title}
              >
                <span className="index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="pp-service-title">{service.title}</h2>
                  <p>{service.summary}</p>
                  <p>
                    <b>Often used for:</b> {service.uses}
                  </p>
                  <p>
                    <b>Helpful starting information:</b> {service.send}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="pp-actions">
            <Link
              className="pp-button pp-button-primary"
              href="/request-a-quote"
            >
              Tell PurePress about your job
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
