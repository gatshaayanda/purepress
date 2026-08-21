"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  MessageCircle,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";

interface Blog {
  title: string;
  body: string;
  imageUrl?: string;
  created_at?: { seconds: number; nanoseconds: number };
}

const WHATSAPP_NUMBER = "+26772971852";

function waLink(message: string) {
  const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function whatsAppShareLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

async function shareArticle({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const text = "This Sparkle Legacy insurance insight may help:";
  const message = [text, "", title, "", url].join("\n");

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
      return;
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
    }
  }

  if (typeof window !== "undefined") {
    window.open(whatsAppShareLink(message), "_blank", "noopener,noreferrer");
  }
}

function formatDate(seconds?: number) {
  if (!seconds) return "Recently published";
  return new Date(seconds * 1000).toLocaleDateString("en-BW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function splitParagraphs(body?: string) {
  return (body || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function getIntroText(body?: string, max = 230) {
  const text = (body || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "Practical guidance from Sparkle Legacy to help you understand the insurance relevance of a real-world situation.";
  }

  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function getPostUrl(origin: string, id?: string) {
  if (!id) return origin ? `${origin}/blog` : "/blog";
  return origin ? `${origin}/blog/${id}` : `/blog/${id}`;
}

function getAskMessage(title?: string) {
  return [
    "Hi Sparkle Legacy 👋",
    `I read your article about: ${title || "-"}`,
    "",
    "I would like guidance on how this applies to my situation.",
    "",
    "Name:",
    "City/Town:",
    "Product / cover type:",
    "Question:",
  ].join("\n");
}

export default function BlogPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [post, setPost] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const snap = await getDoc(doc(firestore, "blogs", id));

        if (!snap.exists()) {
          router.replace("/blog");
          return;
        }

        setPost(snap.data() as Blog);
      } catch (error) {
        console.error("Failed to load blog post:", error);
        router.replace("/blog");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const imageSrc = post?.imageUrl?.trim() || "/placeholder.png";
  const paragraphs = splitParagraphs(post?.body);
  const intro = getIntroText(post?.body);
  const articleUrl = useMemo(() => getPostUrl(origin, id), [origin, id]);

  const whatsappMessage = useMemo(() => {
    return waLink(getAskMessage(post?.title));
  }, [post?.title]);

  const handleShareArticle = async () => {
    if (!post) return;

    await shareArticle({
      title: post.title,
      url: articleUrl,
    });
  };

  if (loading) {
    return (
      <main className="bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card overflow-hidden">
                <div className="card-inner md:p-8">
                  <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="mt-4 h-12 w-4/5 animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="mt-3 h-4 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="mt-5 h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="mt-2 h-4 w-11/12 animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="mt-6 flex gap-3">
                    <div className="h-11 w-40 animate-pulse rounded-full bg-[var(--surface-2)]" />
                    <div className="h-11 w-40 animate-pulse rounded-full bg-[var(--surface-2)]" />
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="h-[320px] animate-pulse bg-[var(--surface-2)]" />
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="card overflow-hidden">
                <div className="card-inner md:p-8">
                  <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="mt-6 space-y-3">
                    <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="h-4 w-11/12 animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="h-4 w-10/12 animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--surface-2)]" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="card overflow-hidden">
                  <div className="card-inner md:p-6">
                    <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="mt-4 h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-[var(--surface-2)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="frame-gold p-8 text-center">
              <h1 className="text-2xl">Insight not found</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                This article could not be found. You can return to the Insights page.
              </p>

              <div className="mt-5 flex justify-center">
                <Link href="/blog" className="btn btn-outline" prefetch={false}>
                  <ArrowLeft size={18} />
                  Back to Insights
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="main" className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mb-5">
            <Link
              href="/blog"
              prefetch={false}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
            >
              <ArrowLeft size={16} />
              Back to Insights
            </Link>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="card-elevated overflow-hidden">
              <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-8">
                <div className="eyebrow mb-0">
                  <Sparkles size={15} />
                  Sparkle Legacy • Insight
                </div>

                <div className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <CalendarDays size={16} />
                  {formatDate(post.created_at?.seconds)}
                </div>

                <h1 className="mt-3 max-w-[16ch]">{post.title}</h1>

                <p className="mt-5 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                  {intro}
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href={whatsappMessage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    <MessageCircle size={18} />
                    Ask on WhatsApp
                  </a>

                  <button
                    type="button"
                    onClick={handleShareArticle}
                    className="btn btn-outline"
                  >
                    <Share2 size={18} />
                    Share Article
                  </button>

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

            <div className="card-outline-gold overflow-hidden">
              <div className="relative aspect-[16/10] w-full bg-[var(--surface-2)] xl:min-h-[100%]">
                <Image
                  src={imageSrc}
                  alt={post.title}
                  fill
                  sizes="(min-width: 1280px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <article className="card overflow-hidden">
              <div className="card-inner md:p-8">
                <div className="eyebrow mb-0">
                  <FileText size={15} />
                  Article
                </div>

                <div className="mt-5 h-px bg-[var(--border)]" />

                <div className="mt-6 space-y-5 text-[15px] leading-8 text-[var(--text-secondary)]">
                  {paragraphs.length > 0 ? (
                    paragraphs.map((paragraph, index) => (
                      <div key={index}>
                        <p className="whitespace-pre-wrap">{paragraph}</p>

                        {index === 1 ? (
                          <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                            <div className="eyebrow mb-0">
                              <ShieldCheck size={15} />
                              Practical next step
                            </div>

                            <h2 className="mt-2 text-xl text-[var(--text-primary)]">
                              Need help applying this to your own situation?
                            </h2>

                            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                              Sparkle Legacy can help you understand what type
                              of cover may be relevant, what details are needed,
                              and what the right next move looks like.
                            </p>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <a
                                href={whatsappMessage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                              >
                                <MessageCircle size={18} />
                                Ask on WhatsApp
                              </a>

                              <button
                                type="button"
                                onClick={handleShareArticle}
                                className="btn btn-outline"
                              >
                                <Share2 size={18} />
                                Share Article
                              </button>

                              <Link
                                href="/c/short-term"
                                className="btn btn-outline"
                                prefetch={false}
                              >
                                Browse Cover Types
                                <ArrowRight size={18} />
                              </Link>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p>No article content available.</p>
                  )}
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-5 md:p-6">
                  <div className="eyebrow mb-0">
                    <Send size={15} />
                    Turn this insight into action
                  </div>

                  <h2 className="mt-2 text-2xl text-[var(--text-primary)]">
                    Want guidance based on this article?
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                    Send Sparkle Legacy a message with this topic already filled
                    in. The team can guide you on the relevant cover type,
                    documents, or next step.
                  </p>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <a
                      href={whatsappMessage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                    >
                      <MessageCircle size={18} />
                      Ask about this article
                    </a>

                    <button
                      type="button"
                      onClick={handleShareArticle}
                      className="btn btn-outline"
                    >
                      <Share2 size={18} />
                      Share Article
                    </button>
                  </div>
                </div>

                <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
                  <b className="text-[var(--text-primary)]">Note:</b> Insights
                  are shared for education and practical guidance. Actual cover
                  terms, premiums, benefits, exclusions, and acceptance remain
                  subject to insurer underwriting and policy wording.
                </div>
              </div>
            </article>

            <aside className="space-y-4 xl:sticky xl:top-24">
              <InfoCard
                eyebrow="Next step"
                title="Turn this insight into action"
                icon={<MessageCircle size={16} />}
              >
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  If this article reflects your own situation, Sparkle Legacy can
                  help you understand what kind of cover may be relevant and
                  what information is needed next.
                </p>

                <div className="mt-5 flex flex-col gap-2">
                  <a
                    href={whatsappMessage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary w-full"
                  >
                    <MessageCircle size={18} />
                    Ask on WhatsApp
                  </a>

                  <button
                    type="button"
                    onClick={handleShareArticle}
                    className="btn btn-outline w-full"
                  >
                    <Share2 size={18} />
                    Share Article
                  </button>

                  <Link
                    href="/claims"
                    className="btn btn-outline w-full"
                    prefetch={false}
                  >
                    <FileText size={18} />
                    Claims Help
                  </Link>
                </div>
              </InfoCard>

              <InfoCard
                eyebrow="Useful reminders"
                title="How to get help faster"
                icon={<CheckCircle2 size={16} />}
              >
                <ul className="mt-3 space-y-2">
                  {[
                    "Mention the product or cover type you are asking about",
                    "Share your city or town",
                    "Include practical details linked to your situation",
                    "Attach documents or photos where relevant",
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
              </InfoCard>

              <InfoCard
                eyebrow="Trusted guidance"
                title="Why Sparkle Legacy shares insights"
                icon={<ShieldCheck size={16} />}
              >
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  These articles help clients understand real-world risks,
                  insurance value, and the practical importance of taking action
                  before a situation becomes more costly or stressful.
                </p>
              </InfoCard>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
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
    <section className="card-outline-gold">
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