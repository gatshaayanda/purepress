"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Eye,
  FileText,
  ImageIcon,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";

type FirestoreDate =
  | {
      seconds?: number;
      nanoseconds?: number;
      toDate?: () => Date;
    }
  | Date
  | string
  | null
  | undefined;

type BlogPost = {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  imageName?: string;
  imageType?: string;
  admin_id?: string;
  created_at?: FirestoreDate;
  createdAt?: FirestoreDate;
  updated_at?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

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

function getDateObject(value?: FirestoreDate): Date | null {
  if (!value) return null;

  try {
    if (value instanceof Date) return value;

    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value.toDate === "function") {
      return value.toDate();
    }

    if (value.seconds) {
      return new Date(value.seconds * 1000);
    }

    return null;
  } catch {
    return null;
  }
}

function formatDate(value?: FirestoreDate) {
  const date = getDateObject(value);

  if (!date) return "Recently published";

  return date.toLocaleDateString("en-BW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getSortTime(post: BlogPost) {
  const date =
    getDateObject(post.created_at) ||
    getDateObject(post.createdAt) ||
    getDateObject(post.updated_at) ||
    getDateObject(post.updatedAt);

  return date ? date.getTime() : 0;
}

function getExcerpt(body?: string, max = 150) {
  const text = (body || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "No article body has been added yet.";
  }

  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export default function BlogListPage() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPosts() {
      try {
        setLoading(true);
        setError("");

        const snap = await getDocs(collection(firestore, "blogs"));

        if (!alive) return;

        const rows = snap.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<BlogPost, "id">),
          }))
          // Keep admin posts, but also keep older posts that may not have admin_id yet.
          .filter((post) => !post.admin_id || post.admin_id === "admin")
          .sort((a, b) => getSortTime(b) - getSortTime(a));

        setPosts(rows);
      } catch (err: any) {
        console.error("Failed to load blog posts:", err);

        if (!alive) return;

        setError(err?.message || "Failed to load blog posts.");
        setPosts([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPosts();

    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    return {
      total: posts.length,
      withImages: posts.filter((post) => !!post.imageUrl?.trim()).length,
    };
  }, [posts]);

  if (loading) return <AdminHubLoader />;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5">
              <Link
                href="/admin/dashboard"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <BookOpen size={15} />
                    Sparkle Legacy • Admin Insights
                  </div>

                  <h1 className="max-w-[12ch]">
                    Manage shareable insights and educational content.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Use this area to create, view, edit, and manage public
                    insurance insights. These posts feed the combined public
                    About + Insights experience and individual article pages.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href="/admin/blog/new"
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Plus size={18} />
                      New Post
                    </Link>

                    <Link
                      href="/blog"
                      prefetch={false}
                      className="btn btn-outline"
                    >
                      <Eye size={18} />
                      View Public Insights
                    </Link>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Content status
                  </div>

                  <h2 className="mt-2 text-2xl">Insights overview</h2>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 text-center">
                      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Total Posts
                      </div>
                      <div className="mt-2 text-3xl font-extrabold text-[var(--text-primary)]">
                        {stats.total}
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 text-center">
                      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        With Images
                      </div>
                      <div className="mt-2 text-3xl font-extrabold text-[var(--text-primary)]">
                        {stats.withImages}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Good use cases
                    </p>

                    <ul className="mt-3 space-y-2">
                      {[
                        "Storm or hail damage education",
                        "Life cover and family protection guidance",
                        "Claims preparation and document reminders",
                        "Business, SME, and agriculture insurance awareness",
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
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-8 rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-7 text-red-700">
                {error}
              </div>
            ) : null}

            <section className="mt-8">
              <div className="mb-4">
                <div className="eyebrow">
                  <Sparkles size={15} />
                  Posts
                </div>

                <h2 className="mt-2 text-2xl">Blog posts</h2>
              </div>

              {posts.length === 0 ? (
                <div className="frame-gold p-8 text-center">
                  <h3 className="text-2xl">No posts yet</h3>

                  <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-7 text-[var(--text-secondary)]">
                    Create your first insight post so Sparkle Legacy can start
                    sharing practical insurance education through the public
                    Insights page.
                  </p>

                  <div className="mt-5 flex justify-center">
                    <Link
                      href="/admin/blog/new"
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Plus size={18} />
                      Create First Post
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {posts.map((post) => {
                    const title = post.title?.trim() || "Untitled Post";
                    const imageSrc = safeImageSrc(post.imageUrl);
                    const date = formatDate(post.created_at || post.createdAt);
                    const hasImage = !!post.imageUrl?.trim();

                    return (
                      <article
                        key={post.id}
                        className="card-outline-gold flex h-full flex-col overflow-hidden"
                      >
                        <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,#fffefb_0%,#f4eddd_100%)] p-3">
                          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.1rem] border border-[var(--border)] bg-white">
                            <img
                              src={imageSrc}
                              alt={title}
                              className="h-full w-full object-contain"
                              onError={(event) => {
                                event.currentTarget.src = "/placeholder.png";
                              }}
                            />
                          </div>
                        </div>

                        <div className="card-inner flex flex-1 flex-col md:p-6">
                          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-strong)]">
                            <CalendarDays size={14} />
                            {date}
                          </div>

                          <h3 className="mt-3 line-clamp-2 min-h-[3.5rem] text-xl">
                            {title}
                          </h3>

                          <p className="mt-3 line-clamp-3 min-h-[4.9rem] text-sm leading-7 text-[var(--text-secondary)]">
                            {getExcerpt(post.body)}
                          </p>

                          <div className="mt-5 rounded-[1rem] border border-[var(--border)] bg-white/70 px-4 py-3">
                            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                              <ImageIcon size={14} />
                              Image
                            </div>

                            <p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">
                              {hasImage
                                ? "Featured image saved"
                                : "Using placeholder image"}
                            </p>
                          </div>

                          <div className="mt-auto grid gap-2 pt-5">
                            <Link
                              href={`/admin/blog/${post.id}`}
                              prefetch={false}
                              className="btn btn-outline w-full justify-center"
                            >
                              <FileText size={18} />
                              Admin Preview
                            </Link>

                            <Link
                              href={`/admin/blog/${post.id}/edit`}
                              prefetch={false}
                              className="btn btn-primary w-full justify-center"
                            >
                              <Pencil size={18} />
                              Edit
                            </Link>

                            <Link
                              href={`/blog/${post.id}`}
                              prefetch={false}
                              className="btn btn-ghost w-full justify-center"
                            >
                              <Eye size={18} />
                              Public View
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> this is
              the correct file for <b>/admin/blog</b>. Individual admin previews
              belong under <b>/admin/blog/[id]</b>, and the public combined About
              + Insights page belongs under <b>/blog</b>.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}