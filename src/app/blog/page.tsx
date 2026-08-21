"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";

interface Blog {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  created_at?: { seconds: number; nanoseconds: number };
  createdAt?: { seconds: number; nanoseconds: number };
}

type BlogCachePayload = {
  posts: Blog[];
  savedAt: string;
};

const WHATSAPP_NUMBER = "+26772971852";
const BLOG_CACHE_KEY = "sparkle_legacy_blog_posts_v1";

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

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
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

function readBlogCache(): BlogCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(BLOG_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as BlogCachePayload;
    if (!Array.isArray(parsed.posts)) return null;

    return parsed;
  } catch {
    return null;
  }
}

function saveBlogCache(posts: Blog[]) {
  if (typeof window === "undefined") return;

  try {
    const payload: BlogCachePayload = {
      posts,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(BLOG_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not save blog posts for offline use:", error);
  }
}

function getPostSeconds(post: Blog) {
  return post.created_at?.seconds || post.createdAt?.seconds || 0;
}

function formatDate(post?: Blog) {
  const seconds = post ? getPostSeconds(post) : 0;

  if (!seconds) return "Recently published";

  return new Date(seconds * 1000).toLocaleDateString("en-BW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCacheTime(value?: string) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("en-BW", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getExcerpt(body?: string, max = 150) {
  const text = (body || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "Practical insurance guidance from Sparkle Legacy to help clients understand real-world risk, cover, and the right next step.";
  }

  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function getPostUrl(origin: string, postId: string) {
  return origin ? `${origin}/blog/${postId}` : `/blog/${postId}`;
}

function getAskMessage(post: Blog) {
  return [
    "Hi Sparkle Legacy 👋",
    `I read your article about: ${post.title || "Sparkle Legacy Insight"}`,
    "",
    "I would like guidance on this topic.",
    "",
    "Name:",
    "City/Town:",
    "Question:",
  ].join("\n");
}

function safeImageSrc(src?: string) {
  const clean = src?.trim();

  if (!clean) return "/placeholder.png";

  if (
    clean.startsWith("/") ||
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("data:")
  ) {
    return clean;
  }

  return "/placeholder.png";
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState("");
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  async function loadPosts() {
    setLoadError("");

    const cached = readBlogCache();

    if (cached?.posts?.length) {
      setPosts(cached.posts);
      setUsingCachedData(true);
      setCacheSavedAt(cached.savedAt || "");
      setLoading(false);
    }

    try {
      const snap = await getDocs(collection(firestore, "blogs"));

      const freshPosts = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Blog, "id">),
        }))
        .filter((post) => post.title || post.body)
        .sort((a, b) => getPostSeconds(b) - getPostSeconds(a));

      setPosts(freshPosts);
      setUsingCachedData(false);
      setCacheSavedAt(new Date().toISOString());
      saveBlogCache(freshPosts);
    } catch (error) {
      console.error("Failed to load blog posts:", error);

      const fallback = readBlogCache();

      if (fallback?.posts?.length) {
        setPosts(fallback.posts);
        setUsingCachedData(true);
        setCacheSavedAt(fallback.savedAt || "");
      } else {
        setPosts([]);
        setLoadError(
          "Insights could not be loaded right now. Check your connection and try again."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  const featuredPosts = useMemo(() => posts.slice(0, 3), [posts]);
  const remainingPosts = useMemo(() => posts.slice(3), [posts]);

  const refreshPosts = async () => {
    setRefreshing(true);
    await loadPosts();
  };

  return (
    <main id="main" className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          {usingCachedData ? (
            <div className="mb-5 rounded-[1.25rem] border border-[var(--border)] bg-white/80 px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <WifiOff
                    size={17}
                    className="mt-1 shrink-0 text-[var(--brand-primary-strong)]"
                  />
                  <p>
                    Showing saved offline insights
                    {cacheSavedAt
                      ? ` • Updated ${formatCacheTime(cacheSavedAt)}`
                      : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refreshPosts}
                  disabled={refreshing}
                  className="btn btn-outline"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="card-elevated overflow-hidden">
            <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
              <div className="eyebrow">
                <ShieldCheck size={15} />
                Sparkle Legacy • About & Insights
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

                <button
                  type="button"
                  onClick={refreshPosts}
                  disabled={refreshing}
                  className="btn btn-outline"
                >
                  <RefreshCw
                    size={18}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  {refreshing ? "Refreshing..." : "Refresh Insights"}
                </button>
              </div>
            </div>
          </div>

          {loadError ? (
            <div className="mt-6 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">
              {loadError}
            </div>
          ) : null}
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
                <Link
                  href="/contact"
                  className="btn btn-outline w-full"
                  prefetch={false}
                >
                  Contact
                  <ArrowRight size={18} />
                </Link>
              </div>
            </InfoPanel>

            {loading ? (
              <LoadingCard />
            ) : featuredPosts[0] ? (
              <InsightCard post={featuredPosts[0]} origin={origin} />
            ) : (
              <PlaceholderInsightCard />
            )}

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

                <Link
                  href="/claims"
                  className="btn btn-outline w-full"
                  prefetch={false}
                >
                  Claims Page
                  <ArrowRight size={18} />
                </Link>
              </div>
            </InfoPanel>

            {loading ? (
              <LoadingCard />
            ) : featuredPosts[1] ? (
              <InsightCard post={featuredPosts[1]} origin={origin} />
            ) : (
              <QuickHelpCard />
            )}

            {loading ? (
              <LoadingCard />
            ) : featuredPosts[2] ? (
              <InsightCard post={featuredPosts[2]} origin={origin} />
            ) : (
              <WhyInsightsCard />
            )}
          </div>
        </div>
      </section>

      {remainingPosts.length > 0 ? (
        <section className="section-shell pt-0">
          <div className="container">
            <div className="mb-6">
              <div className="eyebrow">
                <CalendarDays size={15} />
                More from Sparkle Legacy
              </div>

              <h2 className="section-title">More insights and updates</h2>
              <p className="section-copy mt-2">
                More educational articles clients can open, read, share, and use
                as a direct starting point for WhatsApp guidance.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {remainingPosts.map((post) => (
                <InsightCard key={post.id} post={post} origin={origin} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section-shell pt-0">
        <div className="container">
          <div className="frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
            <b className="text-[var(--text-primary)]">Note:</b> Cover terms,
            premiums, exclusions, benefits, and acceptance remain subject to
            insurer underwriting and the relevant policy wording.
          </div>
        </div>
      </section>
    </main>
  );
}

function InsightCard({ post, origin }: { post: Blog; origin: string }) {
  const title = post.title?.trim() || "Sparkle Legacy Insight";
  const imageSrc = safeImageSrc(post.imageUrl);
  const askMessage = getAskMessage(post);
  const articleUrl = getPostUrl(origin, post.id);

  const handleShare = async () => {
    await shareArticle({
      title,
      url: articleUrl,
    });
  };

  return (
    <article className="card-outline-gold overflow-hidden">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface-2)]">
        <img
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = "/placeholder.png";
          }}
        />
      </div>

      <div className="card-inner md:p-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-strong)]">
          <CalendarDays size={14} />
          {formatDate(post)}
        </div>

        <h2 className="mt-3 text-2xl">{title}</h2>

        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          {getExcerpt(post.body)}
        </p>

        <div className="mt-5 grid gap-2">
          <Link
            href={`/blog/${post.id}`}
            className="btn btn-outline w-full justify-center"
            prefetch={false}
          >
            Read insight
            <ArrowRight size={18} />
          </Link>

          <button
            type="button"
            onClick={handleShare}
            className="btn btn-ghost w-full justify-center"
          >
            <Share2 size={18} />
            Share Article
          </button>

          <a
            href={waLink(askMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full justify-center"
          >
            <Send size={18} />
            Ask about this topic
          </a>
        </div>
      </div>
    </article>
  );
}

function PlaceholderInsightCard() {
  return (
    <section className="card-outline-gold">
      <div className="card-inner md:p-6">
        <div className="eyebrow mb-0">
          <Sparkles size={18} />
          Latest insights
        </div>

        <h2 className="mt-2 text-xl">No insights published yet</h2>

        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          Once articles are published in the blog collection, they will appear
          inside this mixed About and Insights layout.
        </p>

        <div className="mt-5">
          <a
            href={waLink(
              "Hi Sparkle Legacy 👋 I have a question about insurance guidance and would like help."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <MessageCircle size={18} />
            Ask on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

function QuickHelpCard() {
  return (
    <section className="card-outline-gold">
      <div className="card-inner md:p-6">
        <div className="eyebrow mb-0">
          <MessageCircle size={18} />
          Fast support
        </div>

        <h2 className="mt-2 text-xl">Need an answer quickly?</h2>

        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          If you already know what you need, go straight to WhatsApp with your
          product, city or town, and a short explanation of the situation.
        </p>

        <div className="mt-5">
          <a
            href={waLink(
              "Hi Sparkle Legacy 👋 I need help.\n\nProduct:\nCity/Town:\nQuestion:"
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full"
          >
            <MessageCircle size={18} />
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

function WhyInsightsCard() {
  return (
    <section className="card-outline-gold">
      <div className="card-inner md:p-6">
        <div className="eyebrow mb-0">
          <ShieldCheck size={18} />
          Why insights matter
        </div>

        <h2 className="mt-2 text-xl">
          Useful articles clients can actually share.
        </h2>

        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
          These insights help Sparkle Legacy turn real-life insurance examples
          into useful guidance people can open, understand, share, and act on.
        </p>
      </div>
    </section>
  );
}

function LoadingCard() {
  return (
    <div className="card overflow-hidden">
      <div className="h-[220px] animate-pulse bg-[var(--surface-2)]" />
      <div className="card-inner md:p-6">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
    </div>
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