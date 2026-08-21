"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ArrowLeft,
  BookOpen,
  ImageIcon,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import { uploadFiles } from "@/utils/uploadthing";
import AdminHubLoader from "@/components/AdminHubLoader";

type UploadThingResult = {
  url?: string;
  ufsUrl?: string;
  appUrl?: string;
  name?: string;
  type?: string;
};

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const id = params.id || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageType, setImageType] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      router.replace("/admin/blog");
      return;
    }

    let alive = true;

    async function loadPost() {
      try {
        const snap = await getDoc(doc(firestore, "blogs", id));

        if (!snap.exists()) {
          throw new Error("Post not found.");
        }

        const data = snap.data() as Record<string, unknown>;

        if (!alive) return;

        setTitle(typeof data.title === "string" ? data.title : "");
        setBody(typeof data.body === "string" ? data.body : "");
        setImageUrl(typeof data.imageUrl === "string" ? data.imageUrl : "");
        setImageName(typeof data.imageName === "string" ? data.imageName : "");
        setImageType(typeof data.imageType === "string" ? data.imageType : "");
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load post.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPost();

    return () => {
      alive = false;
    };
  }, [id, router]);

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

  const handleRemoveImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setImageFile(null);
    setPreviewUrl("");
    setImageUrl("");
    setImageName("");
    setImageType("");
    setFileInputKey((prev) => prev + 1);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle) {
      setError("Please enter a title.");
      return;
    }

    if (!cleanBody) {
      setError("Please enter the post body.");
      return;
    }

    if (!id) {
      setError("Missing post ID.");
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = imageUrl.trim();
      let finalImageName = imageName.trim();
      let finalImageType = imageType.trim();

      if (imageFile) {
        const uploaded = await uploadFiles("fileUploader" as any, {
          files: [imageFile],
        });

        const firstUpload = uploaded?.[0] as UploadThingResult | undefined;

        finalImageUrl =
          firstUpload?.url || firstUpload?.ufsUrl || firstUpload?.appUrl || "";

        finalImageName = firstUpload?.name || imageFile.name || "";
        finalImageType = firstUpload?.type || imageFile.type || "";

        if (!finalImageUrl) {
          console.log("UploadThing response:", uploaded);
          throw new Error("Image uploaded, but no image URL was returned.");
        }
      }

      await updateDoc(doc(firestore, "blogs", id), {
        admin_id: "admin",
        title: cleanTitle,
        body: cleanBody,
        imageUrl: finalImageUrl,
        imageName: finalImageUrl ? finalImageName || "Featured image" : "",
        imageType: finalImageUrl ? finalImageType || "" : "",
        updated_at: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/admin/blog");
    } catch (e: any) {
      console.error("Failed to update post:", e);
      setError(e?.message || "Failed to update post.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("Are you sure you want to delete this post?");
    if (!ok || !id) return;

    setError("");
    setDeleting(true);

    try {
      await deleteDoc(doc(firestore, "blogs", id));
      router.push("/admin/blog");
    } catch (e: any) {
      console.error("Failed to delete post:", e);
      setError(e?.message || "Failed to delete post.");
      setDeleting(false);
    }
  };

  if (loading) return <AdminHubLoader />;

  const displayImage = previewUrl || imageUrl || "";

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
                    <Pencil size={15} />
                    Sparkle Legacy • Edit Insight
                  </div>

                  <h1 className="max-w-[12ch]">
                    Refine and update this insight post.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Edit the title, body, and featured image for this post. Keep
                    it practical, readable, and useful enough to be shared
                    publicly through the Insights page.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Public-facing content
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Changes here affect how the post appears on the public
                        Sparkle Legacy insights pages.
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        UploadThing image support
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Replace the featured image by uploading a new one. The
                        hosted image URL is saved automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Editing checklist
                  </div>

                  <h2 className="mt-2 text-2xl">Before saving</h2>

                  <ul className="mt-5 space-y-3">
                    {[
                      "Make sure the title is clear and readable.",
                      "Keep the article practical and relevant to a real insurance situation.",
                      "Check spacing and paragraph breaks for easier reading.",
                      "Use a featured image only when it supports the article clearly.",
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
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Post ID
                    </p>
                    <p className="mt-2 break-all text-xs leading-6 text-[var(--text-muted)]">
                      {id}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-8">
              <form onSubmit={handleUpdate} className="card-outline-gold">
                <div className="card-inner space-y-5 md:p-8">
                  <div className="eyebrow mb-0">
                    <BookOpen size={15} />
                    Edit post details
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
                      placeholder="Title"
                      required
                      className="input mt-2"
                      disabled={saving || deleting}
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
                      disabled={saving || deleting}
                    />

                    <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                      Upload a new image to replace the current one. Remove it
                      to let the public post use the default placeholder.
                    </p>

                    {displayImage ? (
                      <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)]">
                        <img
                          src={displayImage}
                          alt="Featured image preview"
                          className="max-h-[320px] w-full object-cover"
                        />

                        <div className="flex items-center justify-between gap-3 p-3">
                          <span className="min-w-0 truncate text-xs text-[var(--text-muted)]">
                            {imageFile
                              ? `Selected image: ${imageFile.name}`
                              : imageName || "Current featured image"}
                          </span>

                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                            disabled={saving || deleting}
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
                      placeholder="Body"
                      required
                      className="input mt-2 min-h-[220px] resize-y rounded-[1.25rem]"
                      disabled={saving || deleting}
                    />
                  </div>

                  {error ? (
                    <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="submit"
                      disabled={saving || deleting}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : imageFile ? (
                        <UploadCloud size={18} />
                      ) : (
                        <Pencil size={18} />
                      )}
                      {saving ? "Updating..." : "Update Post"}
                    </button>

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving || deleting}
                      className="btn btn-outline"
                    >
                      {deleting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                      {deleting ? "Deleting..." : "Delete"}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/admin/blog")}
                      disabled={saving || deleting}
                      className="btn btn-ghost"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> good
              insight posts are clear, practical, and easy for clients to open,
              understand, and share.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}