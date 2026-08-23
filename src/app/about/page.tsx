import { PUREPRESS_CLIENT_TYPES, PUREPRESS_VALUES } from "@/lib/purepress/brand";

export default function AboutPage() {
  return (
    <div className="pp-site">
      <section className="pp-section">
        <div className="pp-container">
          <p className="pp-kicker">PurePress Printers · Gaborone</p>
          <span className="pp-stitch-line" aria-hidden="true" />
          <h1 className="pp-display pp-display-wide">
            Embroidery with a clear, professional finish.
          </h1>
          <p className="pp-lede">
            PurePress provides computerized embroidery and garment branding for
            organisations, teams, schools, brands and customers who want durable
            stitched identity on the items they use and wear.
          </p>

          <div className="pp-service-discovery pp-service-discovery-spaced">
            <div className="pp-material-panel">
              <p className="pp-kicker pp-kicker-on-dark">Who we work with</p>
              <h2>Built around real branding jobs.</h2>
              <p>{PUREPRESS_CLIENT_TYPES.join(" · ")}</p>
            </div>

            <div className="pp-service-list">
              {PUREPRESS_VALUES.map((value, index) => (
                <article className="pp-service-row" key={value.name}>
                  <span className="index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{value.name}</strong>
                    <p>{value.copy}</p>
                  </div>
                  <span className="arrow" aria-hidden="true">
                    •
                  </span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
