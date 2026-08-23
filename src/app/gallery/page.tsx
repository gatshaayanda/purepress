import Image from "next/image";
import Link from "next/link";
import { getPublishedPurePressWorkMedia } from "@/data/purepressPublicWork";

export default function GalleryPage() {
  const work = getPublishedPurePressWorkMedia();

  return (
    <div className="pp-site">
      <section className="pp-section">
        <div className="pp-container">
          <p className="pp-kicker">Our Work</p>
          <span className="pp-stitch-line" aria-hidden="true" />
          <h1 className="pp-display pp-display-wide">
            Made to be worn. Made to represent you.
          </h1>
          <p className="pp-lede">
            Embroidery is in the detail — placement, thread, texture and the
            way a finished piece carries your identity.
          </p>

          {work.length === 0 ? (
            <div className="pp-work-placeholder pp-work-placeholder-spaced">
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
                <h2>More PurePress work is coming to the gallery.</h2>
                <p>
                  In the meantime, tell us what you&apos;re branding and we&apos;ll
                  help you plan the right finish.
                </p>
                <Link
                  className="pp-button pp-button-primary"
                  href="/request-a-quote"
                >
                  Request a Quote
                </Link>
              </div>
            </div>
          ) : (
            <div className="pp-service-list pp-service-list-spaced">
              {work.map((item) => (
                <article className="pp-service-row" key={item.id}>
                  <span className="index">WORK</span>
                  <strong>{item.caption ?? item.alt}</strong>
                  <span>{item.category}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
