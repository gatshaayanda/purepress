"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Eye,
  FileText,
  ImageIcon,
  Pencil,
  ShieldCheck,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";

type TimestampLike = {
  seconds: number;
  nanoseconds?: number;
};

type BlogPost = {
  title: string;
  body: string;
  imageUrl?: string;
  imageName?: string;
  imageType?: string;
  created_at?: TimestampLike;
  createdAt?: TimestampLike;
};

function formatDate(timestamp?: TimestampLike) {
  if (!timestamp?.seconds) return "Draft / recently added";

  return new Date(timestamp.seconds * 1000).toLocaleDateString("en-BW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function splitParagraphs(body?: string) {
  return (body || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function AdminViewBlogPage() {
  const params = useParams() as { id?: string };
  const id = params.id || "";

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Missing post ID.");
      setLoading(false);
      return;
    }

    async function loadPost() {
      try {
        const snap = await getDoc(doc(firestore, "blogs", id));

        if (!snap.exists()) {
          setError("Post not found.");
          return;
        }

        setPost(snap.data() as BlogPost);
      } catch (e: any) {
        setError(e?.message || "Failed to load post.");
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [id]);

  if (loading) return <AdminHubLoader />;

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="mb-5">
                <Link
                  href="/admin/blog"
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
                >
                  <ArrowLeft size={16} />
                  Back to Posts
                </Link>
              </div>

              <div className="frame-gold p-8 text-center">
                <h1 className="text-2xl">Unable to open post</h1>
                <p className="mt-3 text-sm leading-7 text-red-700">{error}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="mb-5">
                <Link
                  href="/admin/blog"
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
                >
                  <ArrowLeft size={16} />
                  Back to Posts
                </Link>
              </div>

              <div className="frame-gold p-8 text-center">
                <h1 className="text-2xl">Post not found</h1>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const imageSrc = post.imageUrl?.trim() || "/placeholder.png";
  const paragraphs = splitParagraphs(post.body);
  const createdDate = post.created_at || post.createdAt;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5">
              <Link
                href="/admin/blog"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Posts
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <BookOpen size={15} />
                    Sparkle Legacy • Admin Post View
                  </div>

                  <h1 className="max-w-[16ch]">{post.title}</h1>

                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <CalendarDays size={16} />
                    {formatDate(createdDate)}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href={`/admin/blog/${id}/edit`}
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Pencil size={18} />
                      Edit This Post
                    </Link>

                    <Link
                      href={`/blog/${id}`}
                      prefetch={false}
                      className="btn btn-outline"
                    >
                      <Eye size={18} />
                      View Public Page
                    </Link>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ImageIcon size={15} />
                    Featured image
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-2)]">
                    <div className="relative aspect-[16/10] w-full">
                      <Image
                        src={imageSrc}
                        alt={post.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
                    {post.imageUrl
                      ? post.imageName || "Uploaded featured image"
                      : "No image is saved for this post, so the default placeholder is shown."}
                  </p>
                </div>
              </div>
            </div>

            <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <article className="card overflow-hidden">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <FileText size={15} />
                    Article content
                  </div>

                  <div className="mt-5 h-px bg-[var(--border)]" />

                  <div className="mt-6 space-y-5 text-[15px] leading-8 text-[var(--text-secondary)]">
                    {paragraphs.length > 0 ? (
                      paragraphs.map((paragraph, index) => (
                        <p key={`${paragraph.slice(0, 30)}-${index}`} className="whitespace-pre-wrap">
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p>No article content available.</p>
                    )}
                  </div>
                </div>
              </article>

              <aside className="space-y-4">
                <div className="card-outline-gold">
                  <div className="card-inner md:p-6">
                    <div className="eyebrow mb-0">
                      <ShieldCheck size={15} />
                      Admin reminder
                    </div>

                    <h2 className="mt-2 text-xl">Before publishing widely</h2>

                    <ul className="mt-4 space-y-2">
                      {[
                        "Make sure the title is clear and useful.",
                        "Keep the article practical and easy to share.",
                        "Check the public page view before sending the link out.",
                        "Use a relevant image where possible.",
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
              </aside>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}