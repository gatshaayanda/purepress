import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getPublishedPurePressWorkProjects,
  type PurePressPublicWorkMedia,
} from "@/data/purepressPublicWork";
import styles from "./gallery.module.css";

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "A closer look at completed PurePress apparel and garment-branding work.",
};

type WorkImageProps = {
  item: PurePressPublicWorkMedia;
  priority?: boolean;
  className?: string;
  sizes: string;
};

function WorkImage({ item, priority = false, className = "", sizes }: WorkImageProps) {
  const sourceRatio = {
    "--source-ratio": `${item.width} / ${item.height}`,
  } as CSSProperties;

  return (
    <figure className={`${styles.shot} ${className}`} style={sourceRatio}>
      <div className={styles.imageFrame}>
        <Image
          className={styles.image}
          src={item.src}
          alt={item.alt}
          fill
          priority={priority}
          sizes={sizes}
        />
        <span className={styles.imageOverlay} aria-hidden="true" />
      </div>
      {item.caption ? <figcaption>{item.caption}</figcaption> : null}
    </figure>
  );
}

export default function GalleryPage() {
  const projects = getPublishedPurePressWorkProjects();

  return (
    <div className="pp-site">
      <section className={`pp-section ${styles.pageIntro}`}>
        <div className="pp-container">
          <p className={`pp-kicker ${styles.reveal}`}>Our Work</p>
          <span className={`pp-stitch-line ${styles.revealDelayOne}`} aria-hidden="true" />
          <h1 className={`pp-display pp-display-wide ${styles.revealDelayTwo}`}>
            Made to be worn. Made to represent you.
          </h1>
          <p className={`pp-lede ${styles.introCopy} ${styles.revealDelayThree}`}>
            A closer look at completed PurePress apparel and branding work,
            from finished garments to artwork details.
          </p>
        </div>
      </section>

      {projects.length === 0 ? (
        <section className={`pp-section ${styles.emptySection}`}>
          <div className="pp-container">
            <div className="pp-work-placeholder">
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
                <Link className="pp-button pp-button-primary" href="/request-a-quote">
                  Request a Quote
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        projects.map((project) => {
          const images = project.media.filter((item) => item.mediaType === "image");
          const hero = images.find((item) => item.featured) ?? images[0];

          if (!hero) return null;

          const supporting = images.filter((item) => item.id !== hero.id);

          return (
            <article
              className={styles.project}
              key={project.slug}
              aria-labelledby={`${project.slug}-title`}
            >
              <div className="pp-container">
                <header className={`${styles.projectHeader} ${styles.reveal}`}>
                  <div>
                    <p className="pp-kicker">Featured Work</p>
                    <h2 id={`${project.slug}-title`}>{project.title}</h2>
                    <p className={styles.descriptor}>{project.descriptor}</p>
                  </div>
                  {project.tagline ? (
                    <p className={styles.tagline}>{project.tagline}</p>
                  ) : null}
                </header>

                <WorkImage
                  item={hero}
                  priority
                  className={`${styles.heroShot} ${styles.revealDelayOne}`}
                  sizes="(max-width: 560px) calc(100vw - 22px), (max-width: 1200px) calc(100vw - 32px), 1120px"
                />

                <div className={`${styles.projectIntro} ${styles.revealDelayTwo}`}>
                  <p>{project.summary}</p>
                  <ul className={styles.serviceChips} aria-label="Services shown in this project">
                    {project.serviceLabels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </div>

                <div className={styles.supportGrid}>
                  {supporting.map((item) => (
                    <WorkImage
                      key={item.id}
                      item={item}
                      className={styles.supportShot}
                      sizes="(max-width: 700px) calc(100vw - 22px), (max-width: 1024px) 48vw, 54vw"
                    />
                  ))}
                </div>
              </div>
            </article>
          );
        })
      )}

      <section className={`pp-section ${styles.ctaSection}`}>
        <div className="pp-container">
          <div className={`${styles.cta} ${styles.reveal}`}>
            <div>
              <p className={styles.ctaKicker}>Your next piece</p>
              <h2>Have something like this in mind?</h2>
            </div>
            <Link
              className={`pp-button pp-button-primary ${styles.ctaButton}`}
              href="/request-a-quote"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
