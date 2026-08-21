"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { ayandaPortfolio } from "@/data/ayandaPortfolio";
import styles from "@/app/ayanda/AyandaPortfolio.module.css";

const externalRel = "noopener noreferrer";

function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel={externalRel} className={className} data-print-url>
      {children}<span className={styles.externalCue} aria-hidden="true"> ↗</span>
    </a>
  );
}

function SectionHeading({ number, eyebrow, title, copy }: { number: string; eyebrow: string; title: string; copy?: string }) {
  return (
    <div className={styles.sectionHeading} data-reveal>
      <div className={styles.sectionNumber} aria-hidden="true">{number}</div>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
        {copy ? <p className={styles.sectionIntro}>{copy}</p> : null}
      </div>
    </div>
  );
}

export default function AyandaPortfolioClient() {
  const data = ayandaPortfolio;

  useEffect(() => {
    const root = document.documentElement;
    const previousColorScheme = root.style.colorScheme;
    root.style.colorScheme = "light";

    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.setAttribute("data-revealed", "true"));
      return () => { root.style.colorScheme = previousColorScheme; };
    }

    nodes.forEach((node) => node.setAttribute("data-reveal-ready", "true"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      root.style.colorScheme = previousColorScheme;
    };
  }, []);

  const evidenceById = new Map(data.evidence.map((item) => [item.id, item]));

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main">Skip to content</a>

      <header className={styles.siteHeader}>
        <nav className={styles.nav} aria-label="Ayanda portfolio navigation">
          <a className={styles.monogram} href="#top" aria-label="Ayanda Kopano Gatsha — top of page">AKG</a>
          <div className={styles.navLinks}>
            <a href="#work">Work</a>
            <a href="#experience">Experience</a>
            <a href="#proof">Proof</a>
            <a href="#contact">Contact</a>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className={styles.hero} id="top" aria-labelledby="portfolio-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroMain}>
              <p className={`${styles.eyebrow} ${styles.heroKicker}`}>TECHNICAL SUPPORT · SaaS CUSTOMER SUCCESS · PRODUCT OPS</p>
              <h1 id="portfolio-title" className={styles.heroName}>
                <span>AYANDA</span>{" "}<span>KOPANO</span>{" "}<span>GATSHA</span>
              </h1>
              <div className={styles.roleBlock}>
                <p>{data.profile.primaryRole}</p>
                <p>{data.profile.secondaryRole}</p>
              </div>
              <p className={styles.positioning}>{data.profile.positioning}</p>
              <p className={styles.statement}>“{data.profile.statement}”</p>
              <p className={styles.summary}>{data.profile.summary}</p>

              <div className={styles.heroActions} data-print-hide>
                <a className={styles.primaryButton} href="#proof">VIEW THE PROOF</a>
                <a className={styles.secondaryButton} href={data.contact.emailHref}>CONTACT AYANDA</a>
                <ExternalLink className={styles.textButton} href={data.contact.currentCv}>OPEN CURRENT CV</ExternalLink>
              </div>

              <div className={styles.secondaryLinks}>
                <ExternalLink href={data.contact.linkedin}>LinkedIn</ExternalLink>
                <ExternalLink href={data.contact.github}>GitHub</ExternalLink>
                <button type="button" onClick={() => window.print()} className={styles.printButton} data-print-hide>
                  Print / Save as PDF
                </button>
              </div>
            </div>

            <aside className={styles.heroAside} aria-label="Professional profile summary">
              <div className={styles.locationCard}>
                <span>BASE</span>
                <strong>{data.profile.location}</strong>
                <p>{data.profile.workProfile}</p>
              </div>
              <div className={styles.openTo}>
                <span>OPEN TO</span>
                <ul>
                  {data.profile.openTo.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className={styles.contactMini}>
                <a href={data.contact.emailHref}>{data.contact.email}</a>
                <a href={data.contact.phoneHref}>{data.contact.phone}</a>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.section} id="proof" aria-labelledby="proof-heading">
          <SectionHeading
            number="02"
            eyebrow="PROOF AT A GLANCE"
            title="Evidence before adjectives."
            copy="A recruiter should not have to take the résumé on faith. Each signal below points to a specific work record or case study."
          />
          <div className={styles.proofGrid}>
            {data.proof.map((item) => {
              const evidence = evidenceById.get(item.evidenceId);
              return (
                <article className={styles.proofCard} key={item.metric} data-reveal>
                  <strong>{item.metric}</strong>
                  <p>{item.label}</p>
                  {evidence ? <ExternalLink href={evidence.url} className={styles.sourceLink}>Source: {item.source}</ExternalLink> : <span className={styles.sourceLink}>Source: {item.source}</span>}
                </article>
              );
            })}
          </div>
        </section>

        <section className={`${styles.section} ${styles.darkSection}`} aria-labelledby="work-method-heading">
          <SectionHeading
            number="03"
            eyebrow="HOW I WORK"
            title="Support is a method, not a script."
            copy="The same operating pattern runs through customer support, technical investigations and product work."
          />
          <div className={styles.methodGrid}>
            {data.howIWork.map((item, index) => (
              <article className={styles.methodCard} key={item.title} data-reveal style={{ "--reveal-delay": `${index * 70}ms` } as CSSProperties}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} id="work" aria-labelledby="selected-work-heading">
          <SectionHeading
            number="04"
            eyebrow="SELECTED WORK / CASE STUDIES"
            title="Problems I have actually owned."
            copy="Four different environments; the common thread is taking responsibility for what is happening, finding evidence and keeping the work moving."
          />
          <div className={styles.caseList}>
            {data.caseStudies.map((study) => (
              <article className={styles.caseStudy} key={study.id} data-reveal>
                <div className={styles.caseRail}>
                  <span>{study.number}</span>
                  <p>{study.role}</p>
                </div>
                <div className={styles.caseBody}>
                  <h3>{study.title}</h3>
                  <dl className={styles.caseFacts}>
                    <div><dt>CONTEXT</dt><dd>{study.context}</dd></div>
                    <div><dt>PROBLEM</dt><dd>{study.problem}</dd></div>
                    <div>
                      <dt>WHAT I OWNED</dt>
                      <dd><ul>{study.owned.map((item) => <li key={item}>{item}</li>)}</ul></dd>
                    </div>
                    <div><dt>WHAT I DID</dt><dd>{study.did}</dd></div>
                    <div><dt>RESULT</dt><dd>{study.result}</dd></div>
                    <div><dt>EVIDENCE</dt><dd>{study.evidenceLabel}</dd></div>
                  </dl>
                  <div className={styles.caseActions} data-print-hide>
                    {study.actions.map((action) => <ExternalLink key={action.label} href={action.url}>{action.label}</ExternalLink>)}
                  </div>
                  <div className={styles.printEvidence} aria-hidden="true">
                    {study.actions.map((action) => <span key={action.url}>{action.label}: {action.url}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.experienceSection}`} id="experience" aria-labelledby="experience-heading">
          <SectionHeading
            number="05"
            eyebrow="EXPERIENCE"
            title="A remote career built on ownership."
            copy="Open any role for the selected evidence. In print, the role details expand automatically."
          />
          <div className={styles.timeline}>
            {data.experience.map((item, index) => (
              <details className={styles.timelineItem} key={item.company} data-reveal>
                <summary>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <span className={styles.timelineIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.timelineSummary}>
                    <strong>{item.company}</strong>
                    <span>{item.role}</span>
                  </span>
                  <time>{item.period}</time>
                  <span className={styles.expandLabel} aria-hidden="true">DETAILS +</span>
                </summary>
                <div className={styles.timelineDetails}>
                  <ul>{item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.proofLibrary}`} aria-labelledby="evidence-heading">
          <SectionHeading
            number="06"
            eyebrow="EVIDENCE & REFERENCES"
            title="Open the work behind the claims."
            copy="Only explicitly approved professional evidence is linked here. No Drive folders, private contracts, identity documents or beta-player material are exposed."
          />
          <div className={styles.evidenceGrid}>
            {data.evidence.map((item, index) => (
              <article className={styles.evidenceCard} key={item.id} data-reveal style={{ "--reveal-delay": `${(index % 3) * 60}ms` } as CSSProperties}>
                <div className={styles.evidenceMeta}>
                  <span>{item.type}</span>
                  <span>{item.format}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.date}</p>
                <ExternalLink href={item.url}>OPEN EVIDENCE</ExternalLink>
                <small>{item.accessNote}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="tools-heading">
          <SectionHeading
            number="07"
            eyebrow="TOOLS"
            title="Grouped by the job they help me do."
            copy="A practical working set across customer operations, technical troubleshooting and documentation."
          />
          <div className={styles.toolsGrid}>
            {data.tools.map((group) => (
              <article className={styles.toolGroup} key={group.group} data-reveal>
                <h3>{group.group}</h3>
                <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.educationSection}`} aria-labelledby="education-heading">
          <SectionHeading
            number="08"
            eyebrow="EDUCATION & TRAINING"
            title="Research, verification and systems learning."
          />
          <div className={styles.educationGrid}>
            {data.education.map((item) => (
              <article className={styles.educationCard} key={item.institution} data-reveal>
                <span>{item.year}</span>
                <h3>{item.institution}</h3>
                <strong>{item.qualification}</strong>
                <p>{item.location}</p>
                <p>{item.relevance}</p>
              </article>
            ))}
            <article className={styles.trainingCard} data-reveal>
              <p className={styles.eyebrow}>ADDITIONAL TRAINING</p>
              <ul>{data.training.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          </div>
        </section>

        <section className={styles.contactSection} id="contact" aria-labelledby="contact-heading">
          <div className={styles.contactInner} data-reveal>
            <p className={styles.eyebrow}>09 — CONTACT</p>
            <p className={styles.contactPrompt}>Need someone who can own the problem, investigate what is actually happening, explain it clearly and keep the customer moving?</p>
            <h2 id="contact-heading">LET&apos;S TALK.</h2>
            <div className={styles.contactActions} data-print-hide>
              <a className={styles.lightButton} href={data.contact.emailHref}>EMAIL AYANDA</a>
              <ExternalLink className={styles.lightOutlineButton} href={data.contact.linkedin}>VIEW LINKEDIN</ExternalLink>
              <ExternalLink className={styles.lightOutlineButton} href={data.contact.github}>VIEW GITHUB</ExternalLink>
              <ExternalLink className={styles.lightOutlineButton} href={data.contact.currentCv}>OPEN CURRENT CV</ExternalLink>
            </div>
            <div className={styles.contactDetails}>
              <a href={data.contact.emailHref}>{data.contact.email}</a>
              <a href={data.contact.phoneHref}>{data.contact.phone}</a>
              <span>{data.profile.location}</span>
              <span>International remote</span>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Ayanda Kopano Gatsha</span>
        <span>Technical Support · SaaS Customer Success · Product Operations</span>
        <span>{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
