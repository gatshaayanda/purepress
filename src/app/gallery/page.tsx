import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getPublishedPurePressWorkProjects,
  type PublishedPurePressWorkProject,
  type PurePressPublicWorkMedia,
} from "@/data/purepressPublicWork";
import GalleryVideo from "./GalleryVideo";
import styles from "./gallery.module.css";

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "Step inside PurePress: real embroidery production, close-up stitching, branded workwear and finished custom apparel.",
};

type WorkMediaProps = {
  item: PurePressPublicWorkMedia;
  priority?: boolean;
  className?: string;
  sizes: string;
  loopPreview?: boolean;
};

function WorkMedia({
  item,
  priority = false,
  className = "",
  sizes,
  loopPreview = false,
}: WorkMediaProps) {
  const sourceRatio = {
    "--source-ratio": `${item.width} / ${item.height}`,
  } as CSSProperties;

  return (
    <figure className={`${styles.shot} ${className}`} style={sourceRatio}>
      <div className={styles.imageFrame}>
        {item.mediaType === "video" ? (
          <GalleryVideo
            className={styles.video}
            src={item.src}
            poster={item.poster}
            label={item.alt}
            loopPreview={loopPreview}
          />
        ) : (
          <Image
            className={styles.image}
            src={item.src}
            alt={item.alt}
            fill
            priority={priority}
            sizes={sizes}
          />
        )}
        <span className={styles.imageOverlay} aria-hidden="true" />
        {item.mediaType === "video" ? (
          <span className={loopPreview ? styles.motionBadge : styles.soundBadge}>
            {loopPreview ? "LIVE PROCESS" : "90 SEC · PLAY FOR SOUND"}
          </span>
        ) : null}
      </div>
      {item.caption ? <figcaption>{item.caption}</figcaption> : null}
    </figure>
  );
}

function mediaById(
  project: PublishedPurePressWorkProject,
  id: string,
): PurePressPublicWorkMedia | undefined {
  return project.media.find((item) => item.id === id);
}

function ProductionStory({ project }: { project: PublishedPurePressWorkProject }) {
  const opener = mediaById(project, "production-floor-machine-wide");
  const anchor = mediaById(project, "production-floor-full-process");
  const stitchBlack = mediaById(project, "production-floor-stitch-black");
  const stitchBlue = mediaById(project, "production-floor-stitch-blue");
  const security = mediaById(project, "production-floor-security-workwear");
  const school = mediaById(project, "production-floor-school-knitwear");
  const orange = mediaById(project, "production-floor-orange-polos");

  if (!opener || !anchor || !stitchBlack || !stitchBlue || !security || !school || !orange) {
    return null;
  }

  return (
    <article
      className={`${styles.project} ${styles.productionProject}`}
      aria-labelledby="inside-the-workshop-title"
    >
      <div className="pp-container">
        <header className={`${styles.projectHeader} ${styles.reveal}`}>
          <div>
            <p className="pp-kicker">PurePress in action</p>
            <h2 id="inside-the-workshop-title">{project.title}</h2>
            <p className={styles.descriptor}>{project.descriptor}</p>
          </div>
          {project.tagline ? <p className={styles.tagline}>{project.tagline}</p> : null}
        </header>

        <div className={`${styles.portal} ${styles.revealDelayOne}`}>
          <div className={styles.portalCopy}>
            <p className={styles.portalEyebrow}>Workshop view · Gaborone</p>
            <h3>See the work before you see the result.</h3>
            <p>
              This is the production floor: machines moving, garments on the table and
              embroidery becoming something you can wear.
            </p>
            <span className="pp-stitch-line" aria-hidden="true" />
          </div>
          <WorkMedia
            item={opener}
            className={styles.portalMedia}
            sizes="(max-width: 780px) calc(100vw - 44px), 42vw"
            loopPreview
          />
        </div>

        <div className={`${styles.projectIntro} ${styles.revealDelayTwo}`}>
          <p>{project.summary}</p>
          <ul className={styles.serviceChips} aria-label="Services shown inside the workshop">
            {project.serviceLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>

        <div className={styles.processGrid}>
          <WorkMedia
            item={stitchBlack}
            className={`${styles.processTall} ${styles.storyReveal}`}
            sizes="(max-width: 700px) calc(100vw - 22px), 32vw"
            loopPreview
          />
          <div className={`${styles.processCopy} ${styles.storyReveal}`}>
            <p className="pp-kicker">Close enough to see the stitches</p>
            <h3>Production is the proof.</h3>
            <p>
              Short loops keep the floor alive; the longer workshop cut is there when you
              want to watch the process properly, with its original sound available on play.
            </p>
          </div>
          <WorkMedia
            item={stitchBlue}
            className={`${styles.processMedium} ${styles.storyReveal}`}
            sizes="(max-width: 700px) calc(100vw - 22px), 38vw"
            loopPreview
          />
        </div>

        <div className={`${styles.anchorBlock} ${styles.storyReveal}`}>
          <div className={styles.anchorCopy}>
            <p className="pp-kicker">Inside the full process</p>
            <h3>From setup to machine embroidery.</h3>
            <p>
              A longer look at the hands-on work behind a finished branded garment. Press
              play when you want the full workshop sequence and sound.
            </p>
          </div>
          <WorkMedia
            item={anchor}
            className={styles.anchorMedia}
            sizes="(max-width: 900px) calc(100vw - 22px), 68vw"
          />
        </div>

        <div className={styles.resultLead}>
          <div className={`${styles.resultLeadCopy} ${styles.storyReveal}`}>
            <p className="pp-kicker">Then the work leaves the machine</p>
            <h3>Built for organisations, schools and teams.</h3>
            <p>
              The same floor moves from close-up stitching to finished workwear, school
              pieces and branded polos ready to represent the people wearing them.
            </p>
          </div>
          <WorkMedia
            item={security}
            className={`${styles.resultSecurity} ${styles.storyReveal}`}
            sizes="(max-width: 700px) calc(100vw - 22px), 44vw"
          />
          <WorkMedia
            item={school}
            className={`${styles.resultSchool} ${styles.storyReveal}`}
            sizes="(max-width: 700px) calc(100vw - 22px), 36vw"
          />
          <WorkMedia
            item={orange}
            className={`${styles.resultOrange} ${styles.storyReveal}`}
            sizes="(max-width: 700px) calc(100vw - 22px), 36vw"
          />
        </div>
      </div>
    </article>
  );
}

function FinishedProject({ project }: { project: PublishedPurePressWorkProject }) {
  const images = project.media.filter((item) => item.mediaType === "image");
  const hero = images.find((item) => item.featured) ?? images[0];
  if (!hero) return null;
  const supporting = images.filter((item) => item.id !== hero.id);

  return (
    <article
      className={`${styles.project} ${styles.finishedProject}`}
      key={project.slug}
      aria-labelledby={`${project.slug}-title`}
    >
      <div className="pp-container">
        <header className={`${styles.projectHeader} ${styles.reveal}`}>
          <div>
            <p className="pp-kicker">Creative payoff</p>
            <h2 id={`${project.slug}-title`}>{project.title}</h2>
            <p className={styles.descriptor}>{project.descriptor}</p>
          </div>
          {project.tagline ? <p className={styles.tagline}>{project.tagline}</p> : null}
        </header>

        <WorkMedia
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
            <WorkMedia
              key={item.id}
              item={item}
              className={`${styles.supportShot} ${styles.storyReveal}`}
              sizes="(max-width: 700px) calc(100vw - 22px), (max-width: 1024px) 48vw, 54vw"
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function ProductionVariety({ project }: { project: PublishedPurePressWorkProject }) {
  const ids = [
    "production-floor-radiation-therapist",
    "production-floor-white-logo-detail",
    "production-floor-irvines-polos",
    "production-floor-coffin-badge",
  ];
  const items = ids
    .map((id) => mediaById(project, id))
    .filter((item): item is PurePressPublicWorkMedia => Boolean(item));

  if (items.length === 0) return null;

  return (
    <section className={`${styles.varietySection} pp-section`} aria-labelledby="more-from-floor-title">
      <div className="pp-container">
        <header className={`${styles.varietyHeader} ${styles.storyReveal}`}>
          <div>
            <p className="pp-kicker">More from the floor</p>
            <h2 id="more-from-floor-title">Different jobs. Same production reality.</h2>
          </div>
          <p>
            Workwear, logo details, branded polos and custom embroidery — more of the range
            that moves through PurePress.
          </p>
        </header>
        <div className={styles.varietyRail}>
          {items.map((item) => (
            <WorkMedia
              key={item.id}
              item={item}
              className={`${styles.varietyCard} ${styles.storyReveal}`}
              sizes="(max-width: 700px) 78vw, (max-width: 1100px) 42vw, 30vw"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function GalleryPage() {
  const projects = getPublishedPurePressWorkProjects();
  const production = projects.find((project) => project.slug === "inside-the-workshop");
  const finishedProjects = projects.filter((project) => project.slug !== "inside-the-workshop");

  return (
    <div className="pp-site">
      <section className={`pp-section ${styles.pageIntro}`}>
        <div className="pp-container">
          <p className={`pp-kicker ${styles.reveal}`}>Our Work</p>
          <span className={`pp-stitch-line ${styles.revealDelayOne}`} aria-hidden="true" />
          <h1 className={`pp-display pp-display-wide ${styles.revealDelayTwo}`}>
            Step inside PurePress.
          </h1>
          <p className={`pp-lede ${styles.introCopy} ${styles.revealDelayThree}`}>
            Made to be worn. Made to represent you. Step inside the real production,
            close-up stitching and finished branded garments behind the final piece.
          </p>
        </div>
      </section>

      {projects.length === 0 ? (
        <section className={`pp-section ${styles.emptySection}`}>
          <div className="pp-container">
            <div className="pp-work-placeholder">
              <div className="visual" aria-hidden="true">
                <div className="pp-production-stamp">
                  <Image src="/purepress/brand/purepress-mark.svg" alt="" width={92} height={77} />
                </div>
              </div>
              <div className="copy">
                <h2>More PurePress work is coming to the gallery.</h2>
                <p>
                  In the meantime, tell us what you&apos;re branding and we&apos;ll help you
                  plan the right finish.
                </p>
                <Link className="pp-button pp-button-primary" href="/request-a-quote">
                  Request a Quote
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {production ? <ProductionStory project={production} /> : null}
          {finishedProjects.map((project) => (
            <FinishedProject project={project} key={project.slug} />
          ))}
          {production ? <ProductionVariety project={production} /> : null}
        </>
      )}

      <section className={`pp-section ${styles.ctaSection}`}>
        <div className="pp-container">
          <div className={`${styles.cta} ${styles.storyReveal}`}>
            <div>
              <p className={styles.ctaKicker}>Your next piece</p>
              <h2>Tell us what you&apos;re branding.</h2>
              <p className={styles.ctaCopy}>
                Garments, quantity, artwork and required date — start with what you know.
              </p>
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
