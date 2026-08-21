"use client";

import Link from "next/link";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  ArrowLeft,
  BookOpen,
  ImageIcon,
  Loader2,
  MessageSquareText,
  PencilLine,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import { uploadFiles } from "@/utils/uploadthing";

type UploadThingResult = {
  url?: string;
  ufsUrl?: string;
  appUrl?: string;
  name?: string;
  type?: string;
};

export default function NewBlogPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleImageChange = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");

    if (!file) {
      setFileInputKey((prev) => prev + 1);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle) {
      setErr("Please enter a blog title.");
      return;
    }

    if (!cleanBody) {
      setErr("Please enter the blog body.");
      return;
    }

    setSaving(true);

    try {
      let imageUrl = "";
      let imageName = "";
      let imageType = "";

      if (imageFile) {
        const uploaded = await uploadFiles("fileUploader" as any, {
          files: [imageFile],
        });

        const firstUpload = uploaded?.[0] as UploadThingResult | undefined;

        imageUrl =
          firstUpload?.url || firstUpload?.ufsUrl || firstUpload?.appUrl || "";

        imageName = firstUpload?.name || imageFile.name || "";
        imageType = firstUpload?.type || imageFile.type || "";

        if (!imageUrl) {
          console.log("UploadThing response:", uploaded);
          throw new Error("Image uploaded, but no image URL was returned.");
        }
      }

      await addDoc(collection(firestore, "blogs"), {
        admin_id: "admin",
        title: cleanTitle,
        body: cleanBody,
        imageUrl,
        imageName,
        imageType,
        created_at: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/admin/blog");
    } catch (e: any) {
      console.error("Failed to save blog post:", e);
      setErr(e?.message || "Failed to save blog post.");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5">
              <Link
                href="/admin/blog"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Blog Posts
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <BookOpen size={15} />
                    Sparkle Legacy • New Insight
                  </div>

                  <h1 className="max-w-[12ch]">
                    Write a practical, shareable insight post.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Use this form to publish educational content that Sparkle
                    Legacy can share through the public Insights page, WhatsApp,
                    and client follow-ups.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Best-performing topics
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Storm damage, life cover, claims guidance, home
                        insurance, SME risk, and practical insurance education.
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        UploadThing image support
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Upload a featured image directly. The hosted image URL
                        will be saved automatically with the blog post.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <PencilLine size={15} />
                    Content checklist
                  </div>

                  <h2 className="mt-2 text-2xl">Before publishing</h2>

                  <ul className="mt-5 space-y-3">
                    {[
                      "Use a clear title tied to a real insurance situation.",
                      "Keep the body practical, readable, and easy to share.",
                      "Link the post to a real problem clients recognize.",
                      "End with a direction that naturally leads to follow-up or cover guidance.",
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

                  <div className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--text-primary)]">
                      <ShieldCheck
                        size={16}
                        className="text-[var(--brand-primary-strong)]"
                      />
                      WhatsApp conversion note
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      Public blog posts should help readers move from awareness
                      to action through WhatsApp sharing and product-specific
                      follow-up prompts.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-8">
              <form onSubmit={handleSubmit} className="card-outline-gold">
                <div className="card-inner space-y-5 md:p-8">
                  <div className="eyebrow mb-0">
                    <MessageSquareText size={15} />
                    Post details
                  </div>

                  <div>
                    <label
                      htmlFor="title"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Title
                    </label>
                    <input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Example: Why Home Insurance Matters After Storm Damage"
                      required
                      className="input mt-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="featuredImage"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
                    >
                      <ImageIcon size={16} />
                      Featured Image
                      <span className="font-normal text-[var(--text-muted)]">
                        (optional)
                      </span>
                    </label>

                    <input
                      key={fileInputKey}
                      id="featuredImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageChange(e.target.files?.[0] || null)
                      }
                      className="input mt-2"
                      disabled={saving}
                    />

                    <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                      Upload an image for this article. If left blank, the
                      public insight page will use the default placeholder image.
                    </p>

                    {previewUrl ? (
                      <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)]">
                        <img
                          src={previewUrl}
                          alt="Featured image preview"
                          className="max-h-[320px] w-full object-cover"
                        />

                        <div className="flex items-center justify-between gap-3 p-3">
                          <span className="text-xs text-[var(--text-muted)]">
                            Selected image: {imageFile?.name}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleImageChange(null)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                            disabled={saving}
                          >
                            <X size={14} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="body"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Body
                    </label>
                    <textarea
                      id="body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write the post body here..."
                      required
                      className="input mt-2 min-h-[220px] resize-y rounded-[1.25rem]"
                    />
                  </div>

                  {err ? (
                    <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {err}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : imageFile ? (
                        <UploadCloud size={18} />
                      ) : (
                        <BookOpen size={18} />
                      )}
                      {saving ? "Saving..." : "Save & Publish"}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="btn btn-outline"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> strong
              insight posts are practical, relevant, and easy for clients to
              understand and share.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}