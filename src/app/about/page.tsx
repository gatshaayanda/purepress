"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const WHATSAPP_NUMBER = "+26772971852";

function waLink(message: string) {
  const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function AboutPage() {
  return (
    <main id="main" className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="card-elevated overflow-hidden">
            <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
              <div className="eyebrow">
                <ShieldCheck size={15} />
                Sparkle Legacy • About
              </div>

              <h1 className="max-w-[13ch]">
                A clearer, more modern insurance broker experience.
              </h1>

              <p className="mt-4 max-w-[64ch] text-base leading-8 text-[var(--text-secondary)]">
                Sparkle Legacy helps individuals and businesses in Botswana
                request quotes, understand cover more clearly, and navigate
                claims with confidence. The focus is simple: clearer guidance,
                practical support, and a faster WhatsApp-first experience when
                clients need help.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={waLink(
                    "Hi Sparkle Legacy 👋 I’d like help choosing the right cover.\n\nName:\nCity/Town:\nWhat do you need insured?"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <MessageCircle size={18} />
                  Chat on WhatsApp
                </a>

                <Link
                  href="/c/short-term"
                  className="btn btn-outline"
                  prefetch={false}
                >
                  Browse Cover Types
                  <ArrowRight size={18} />
                </Link>

                <Link href="/claims" className="btn btn-ghost" prefetch={false}>
                  <FileText size={18} />
                  Claims Help
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-3">
            <InfoPanel
              eyebrow="What we help with"
              title="Support across key cover areas"
              icon={<Sparkles size={18} />}
            >
              <ul className="mt-4 space-y-3">
                {[
                  "Short-Term cover such as motor, home and contents, travel, gadgets, and liability-related products.",
                  "Long-Term cover such as life, funeral, disability, and other people-focused protection.",
                  "Retirement and longer-term planning support depending on the product structure.",
                  "Business and SME cover such as assets, liability, fleet, and business continuity-related needs.",
                  "Claims support with guidance on likely steps, forms, and supporting documents.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                  >
                    <CheckCircle2
                      size={16}
                      className="mt-[5px] shrink-0 text-[var(--brand-primary-strong)]"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <Link href="/contact" className="btn btn-outline w-full" prefetch={false}>
                  Contact
                  <ArrowRight size={18} />
                </Link>
              </div>
            </InfoPanel>

            <InfoPanel
              eyebrow="How it works"
              title="A simpler process from question to action"
              icon={<ShieldCheck size={18} />}
            >
              <ol className="mt-4 space-y-3">
                {[
                  {
                    title: "Tell us what you need",
                    desc: "Share the product, your city or town, and the basics of what you want insured.",
                  },
                  {
                    title: "We confirm what is needed",
                    desc: "The team helps clarify the likely details or documents needed for a cleaner quote or claim process.",
                  },
                  {
                    title: "We help you understand your options",
                    desc: "The goal is to explain things more simply before you commit, not leave you guessing.",
                  },
                  {
                    title: "We stay useful after the first step",
                    desc: "If you need help updating cover, following up, or starting a claim, Sparkle Legacy can guide the process.",
                  },
                ].map((step, index) => (
                  <li
                    key={step.title}
                    className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-extrabold text-[var(--text-on-brand)]">
                        {index + 1}
                      </span>
                      <span>
                        <span className="block text-sm font-extrabold text-[var(--text-primary)]">
                          {step.title}
                        </span>
                        <span className="mt-1 block text-sm leading-7 text-[var(--text-secondary)]">
                          {step.desc}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </InfoPanel>

            <InfoPanel
              eyebrow="Helpful preparation"
              title="What to send for faster help"
              icon={<FileText size={18} />}
            >
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Sharing the right information early usually makes quotes and
                claims easier to handle.
              </p>

              <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                <p className="text-sm font-extrabold text-[var(--text-primary)]">
                  For quotes
                </p>
                <ul className="mt-3 space-y-2">
                  {[
                    "Cover type and product",
                    "City or town",
                    "Important details such as vehicle model, sum assured, dependants, or anything relevant to the request",
                    "Name and phone number if you are comfortable sharing them",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                    >
                      <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                <p className="text-sm font-extrabold text-[var(--text-primary)]">
                  For claims
                </p>
                <ul className="mt-3 space-y-2">
                  {[
                    "Incident date and what happened",
                    "Location and any photos or evidence",
                    "Supporting forms or documents if available",
                    "Policy number or reference if you have it",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                    >
                      <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <a
                  href={waLink(
                    "Hi Sparkle Legacy 👋 What documents do you need for my quote/claim?\n\nProduct:\nCover type:\nCity/Town:"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary w-full"
                >
                  <MessageCircle size={18} />
                  Ask on WhatsApp
                </a>

                <Link href="/claims" className="btn btn-outline w-full" prefetch={false}>
                  Claims Page
                  <ArrowRight size={18} />
                </Link>
              </div>
            </InfoPanel>
          </div>

          <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
            <b className="text-[var(--text-primary)]">Note:</b> Cover terms,
            premiums, exclusions, benefits, and acceptance remain subject to
            insurer underwriting and the relevant policy wording.
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoPanel({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card-outline-gold h-full">
      <div className="card-inner md:p-6">
        <div className="eyebrow mb-0">
          {icon}
          {eyebrow}
        </div>

        <h2 className="mt-2 text-xl">{title}</h2>

        {children}
      </div>
    </section>
  );
}