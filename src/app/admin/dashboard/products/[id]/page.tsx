"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  FolderKanban,
  Pencil,
  ShieldCheck,
  Trash2,
  XCircle,
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

type InsuranceProduct = {
  id: string;
  name?: string;
  category?: string;
  productType?: string;
  productTypeLabel?: string;
  summary?: string;
  bullets?: string[];
  whatItCovers?: string[];
  whoItsFor?: string[];
  keyNotes?: string[];
  active?: boolean;
  order?: number | null;
  admin_id?: string;
  createdAt?: FirestoreDate;
  created_at?: FirestoreDate;
  updatedAt?: FirestoreDate;
  updated_at?: FirestoreDate;
};

const CATEGORY_LABELS: Record<string, string> = {
  "short-term": "Short-Term Insurance",
  "long-term": "Long-Term Insurance",
  business: "Business / SME Cover",
  retirement: "Retirement & Planning",

  // Legacy support
  motor: "Motor Insurance",
  home: "Home & Contents",
  travel: "Travel Insurance",
  gadget: "Gadget Insurance",
  life: "Life Cover",
  funeral: "Funeral Cover",
  disability: "Disability & Income Protection",
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  motor: "Motor Insurance",
  "home-contents": "Home & Contents",
  travel: "Travel Insurance",
  gadget: "Gadget Insurance",
  "personal-accident": "Personal Accident",
  life: "Life Cover",
  funeral: "Funeral Cover",
  "disability-income": "Disability & Income Protection",
  "credit-life": "Credit Life",
  "retirement-annuity": "Retirement & Annuities",
  "wealth-planning": "Wealth Planning",
  "sme-cover": "Business & SME Cover",
  liability: "Liability Cover",
  fleet: "Fleet Cover",
  "business-interruption": "Business Interruption",
  agriculture: "Agriculture Insurance",
  other: "Other",
};

const LEGACY_PUBLIC_CATEGORY_MAP: Record<string, string> = {
  motor: "short-term",
  home: "short-term",
  travel: "short-term",
  gadget: "short-term",
  life: "long-term",
  funeral: "long-term",
  disability: "long-term",
};

function getCategoryLabel(category?: string) {
  const key = category?.toLowerCase() || "";
  return CATEGORY_LABELS[key] || category || "Other";
}

function getProductTypeLabel(product?: InsuranceProduct) {
  const explicit = product?.productTypeLabel?.trim();
  if (explicit) return explicit;

  const key = product?.productType?.toLowerCase() || "";
  return PRODUCT_TYPE_LABELS[key] || product?.productType || "Not specified";
}

function getPublicCategory(category?: string) {
  const key = category?.toLowerCase() || "short-term";
  return LEGACY_PUBLIC_CATEGORY_MAP[key] || key;
}

function formatDate(value?: FirestoreDate) {
  if (!value) return "Not recorded";

  try {
    if (value instanceof Date) {
      return value.toLocaleString("en-BW", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (typeof value === "string") {
      return new Date(value).toLocaleString("en-BW", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString("en-BW", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (value.seconds) {
      return new Date(value.seconds * 1000).toLocaleString("en-BW", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return "Not recorded";
  } catch {
    return "Not recorded";
  }
}

function safeList(value?: string[]) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export default function ViewInsuranceProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id || "";

  const [product, setProduct] = useState<InsuranceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      router.replace("/admin/dashboard/products");
      return;
    }

    let alive = true;

    async function loadProduct() {
      try {
        setLoading(true);
        setError("");

        const snap = await getDoc(doc(firestore, "insurance_products", id));

        if (!alive) return;

        if (!snap.exists()) {
          setProduct(null);
          setError("This insurance product could not be found.");
          return;
        }

        setProduct({
          id: snap.id,
          ...(snap.data() as Omit<InsuranceProduct, "id">),
        });
      } catch (err: any) {
        console.error("Failed to load insurance product:", err);

        if (!alive) return;

        setProduct(null);
        setError(err?.message || "Failed to load insurance product.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadProduct();

    return () => {
      alive = false;
    };
  }, [id, router]);

  const publicCategory = useMemo(
    () => getPublicCategory(product?.category),
    [product?.category]
  );

  const publicPath = `/c/${publicCategory}`;

  const title = product?.name?.trim() || "Insurance Product";

  const handleDelete = async () => {
    if (!product?.id) return;

    const ok = window.confirm(
      `Delete "${title}"?\n\nThis removes the Firestore product record and cannot be undone.`
    );

    if (!ok) return;

    setDeleting(true);

    try {
      await deleteDoc(doc(firestore, "insurance_products", product.id));
      router.push("/admin/dashboard/products");
    } catch (err) {
      console.error("Delete product failed:", err);
      window.alert("Delete failed. Please try again.");
      setDeleting(false);
    }
  };

  if (loading) return <AdminHubLoader />;

  if (error || !product) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="mb-5">
                <Link
                  href="/admin/dashboard/products"
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
                >
                  <ArrowLeft size={16} />
                  Back to Products
                </Link>
              </div>

              <div className="frame-gold p-8 text-center">
                <h1 className="text-2xl">Product not found</h1>
                <p className="mt-3 text-sm leading-7 text-red-700">
                  {error || "This product could not be loaded."}
                </p>

                <div className="mt-5 flex justify-center">
                  <Link
                    href="/admin/dashboard/products"
                    prefetch={false}
                    className="btn btn-outline"
                  >
                    Back to Insurance Products
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/admin/dashboard/products"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Products
              </Link>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link
                  href={publicPath}
                  prefetch={false}
                  className="btn btn-ghost"
                >
                  <ExternalLink size={16} />
                  View Public Category
                </Link>

                <Link
                  href={`/admin/dashboard/products/${product.id}/edit`}
                  prefetch={false}
                  className="btn btn-outline"
                >
                  <Pencil size={16} />
                  Edit Product
                </Link>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={16} />
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <FolderKanban size={15} />
                    Sparkle Legacy • Product View
                  </div>

                  <h1 className="max-w-[15ch]">{title}</h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Review this insurance product exactly as an admin record
                    before editing, deleting, or checking how it fits into the
                    public category page.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {product.active !== false ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
                        <CheckCircle2 size={14} />
                        Active on public pages
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                        <XCircle size={14} />
                        Hidden from public pages
                      </span>
                    )}

                    <span className="badge">
                      {getCategoryLabel(product.category)}
                    </span>

                    <span className="badge badge-neutral">
                      {getProductTypeLabel(product)}
                    </span>

                    {typeof product.order === "number" ? (
                      <span className="badge badge-neutral">
                        Order {product.order}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href={`/admin/dashboard/products/${product.id}/edit`}
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Pencil size={18} />
                      Edit Product
                    </Link>

                    <Link
                      href={publicPath}
                      prefetch={false}
                      className="btn btn-outline"
                    >
                      <Eye size={18} />
                      Public Category
                    </Link>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Product Snapshot
                  </div>

                  <h2 className="mt-2 text-2xl">Admin record</h2>

                  <div className="mt-5 grid gap-3">
                    <SnapshotRow
                      label="Public Category"
                      value={getCategoryLabel(product.category)}
                    />
                    <SnapshotRow
                      label="Product Type"
                      value={getProductTypeLabel(product)}
                    />
                    <SnapshotRow
                      label="Status"
                      value={product.active !== false ? "Active" : "Inactive"}
                    />
                    <SnapshotRow
                      label="Display Order"
                      value={
                        typeof product.order === "number"
                          ? String(product.order)
                          : "Not set"
                      }
                    />
                    <SnapshotRow
                      label="Created"
                      value={formatDate(product.createdAt || product.created_at)}
                    />
                    <SnapshotRow
                      label="Updated"
                      value={formatDate(product.updatedAt || product.updated_at)}
                    />
                  </div>

                  <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Product ID
                    </p>
                    <p className="mt-2 break-all text-xs leading-6 text-[var(--text-muted)]">
                      {product.id}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
              <article className="card overflow-hidden">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <FileText size={15} />
                    Public Content
                  </div>

                  <div className="mt-5 h-px bg-[var(--border)]" />

                  <ReadBlock
                    title="Summary"
                    value={
                      product.summary ||
                      "No summary has been added for this product yet."
                    }
                  />

                  <ListBlock title="Key Points" items={product.bullets} />

                  <ListBlock
                    title="What It Covers"
                    items={product.whatItCovers}
                  />

                  <ListBlock title="Who It’s For" items={product.whoItsFor} />

                  <ListBlock title="Key Notes" items={product.keyNotes} />
                </div>
              </article>

              <aside className="space-y-4 xl:sticky xl:top-24">
                <InfoCard
                  eyebrow="Before publishing"
                  title="Client-safe product checks"
                  icon={<BadgeCheck size={16} />}
                >
                  <ul className="mt-4 space-y-2">
                    {[
                      "Check the product name is clear to a normal client.",
                      "Confirm the public category is correct.",
                      "Keep the summary practical and not over-promising.",
                      "Make sure notes mention underwriting or policy wording where needed.",
                      "Open the public category page after editing.",
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
                  eyebrow="Actions"
                  title="Manage this product"
                  icon={<FolderKanban size={16} />}
                >
                  <div className="mt-5 flex flex-col gap-2">
                    <Link
                      href={`/admin/dashboard/products/${product.id}/edit`}
                      prefetch={false}
                      className="btn btn-primary w-full"
                    >
                      <Pencil size={18} />
                      Edit Product
                    </Link>

                    <Link
                      href={publicPath}
                      prefetch={false}
                      className="btn btn-outline w-full"
                    >
                      <ExternalLink size={18} />
                      View Public Category
                    </Link>

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="btn btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 size={18} />
                      {deleting ? "Deleting..." : "Delete Product"}
                    </button>
                  </div>
                </InfoCard>
              </aside>
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> this is
              the read-only product view. Use it to inspect the product before
              editing or deleting the Firestore record.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SnapshotRow({ label, value }: { label: string; value?: string }) {
  const clean = value && value.trim().length > 0 ? value.trim() : "—";

  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-white/80 px-4 py-3">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">
        {clean}
      </div>
    </div>
  );
}

function ReadBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="mt-6">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-primary-strong)]">
        {title}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-8 text-[var(--text-secondary)]">
        {value}
      </p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  const list = safeList(items);

  return (
    <div className="mt-6">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-primary-strong)]">
        {title}
      </div>

      {list.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {list.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
            >
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
          No items added yet.
        </p>
      )}
    </div>
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