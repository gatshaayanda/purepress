"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";

type InsuranceProduct = {
  id: string;
  name: string;
  category: string;
  productType?: string;
  productTypeLabel?: string;
  summary?: string;
  bullets?: string[];
  whatItCovers?: string[];
  whoItsFor?: string[];
  keyNotes?: string[];
  active?: boolean;
  order?: number;
  updatedAt?: unknown;
};

const CATEGORY_LABELS: Record<string, string> = {
  "short-term": "Short-Term Insurance",
  "long-term": "Long-Term Insurance",
  business: "Business / SME Cover",
  retirement: "Retirement & Planning",

  // Legacy category support
  motor: "Motor Insurance",
  home: "Home & Contents",
  travel: "Travel Insurance",
  gadget: "Gadget Insurance",
  life: "Life Cover",
  funeral: "Funeral Cover",
  disability: "Disability & Income Protection",
};

function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category?.toLowerCase()] || category || "Other";
}

function safeCount(value?: string[]) {
  return Array.isArray(value) ? value.length : 0;
}

function AdminProductsContent() {
  const [items, setItems] = useState<InsuranceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const cat = (searchParams.get("cat") || "").toLowerCase();

  const load = async () => {
    setLoading(true);

    try {
      const snap = await getDocs(collection(firestore, "insurance_products"));

      const mapped = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<InsuranceProduct, "id">),
      })) as InsuranceProduct[];

      mapped.sort((a, b) => {
        const aCategory = (a.category || "").toLowerCase();
        const bCategory = (b.category || "").toLowerCase();

        if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);

        const aOrder = a.order ?? 9999;
        const bOrder = b.order ?? 9999;

        if (aOrder !== bOrder) return aOrder - bOrder;

        return (a.name || "").localeCompare(b.name || "");
      });

      setItems(mapped);
    } catch (e) {
      console.error("Admin insurance products load failed:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!cat) return items;
    return items.filter((p) => (p.category || "").toLowerCase() === cat);
  }, [items, cat]);

  const grouped = useMemo(() => {
    const map: Record<string, InsuranceProduct[]> = {};

    for (const product of filtered) {
      const key = (product.category || "other").toLowerCase();
      map[key] = map[key] || [];
      map[key].push(product);
    }

    return map;
  }, [filtered]);

  const onDelete = async (id: string) => {
    const ok = window.confirm("Delete this insurance product?");
    if (!ok) return;

    try {
      await deleteDoc(doc(firestore, "insurance_products", id));
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
      window.alert("Delete failed. Please try again.");
    }
  };

  if (loading) return <AdminHubLoader />;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-6xl">
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
                    <FolderKanban size={15} />
                    Sparkle Legacy • Insurance Products
                  </div>

                  <h1 className="max-w-[13ch]">
                    Manage public insurance product content.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Use this area to manage the insurance products that appear
                    across Sparkle Legacy’s public cover pages. View each product
                    before editing, keep public wording clear, and use new
                    records to extend the existing product catalogue.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href="/admin/dashboard/products/new"
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Plus size={18} />
                      New Insurance Product
                    </Link>

                    <button
                      onClick={load}
                      className="btn btn-outline"
                      type="button"
                    >
                      <RefreshCw size={18} />
                      Refresh
                    </button>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Product overview
                  </div>

                  <h2 className="mt-2 text-2xl">Current status</h2>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 text-center">
                      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Total Products
                      </div>
                      <div className="mt-2 text-3xl font-extrabold text-[var(--text-primary)]">
                        {items.length}
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 text-center">
                      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Filter
                      </div>
                      <div className="mt-2 text-sm font-bold text-[var(--brand-primary-strong)]">
                        {cat ? getCategoryLabel(cat) : "All Categories"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Product actions
                    </p>

                    <ul className="mt-3 space-y-2">
                      {[
                        "View lets you inspect the product before changing it.",
                        "Edit updates the Firestore record and public content.",
                        "Delete removes the product completely, so use it carefully.",
                        "New products should add to the catalogue, not replace the baseline content.",
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

            <section className="mt-8">
              <div className="mb-4">
                <div className="eyebrow">
                  <FolderKanban size={15} />
                  Listings
                </div>

                <h2 className="mt-2 text-2xl">
                  Insurance products {cat ? `• ${getCategoryLabel(cat)}` : ""}
                </h2>
              </div>

              {filtered.length === 0 ? (
                <div className="frame-gold p-8 text-center">
                  <h3 className="text-2xl">No insurance products yet</h3>

                  <p className="mx-auto mt-3 max-w-[54ch] text-sm leading-7 text-[var(--text-secondary)]">
                    Add a new insurance product to begin extending the public
                    product sections.
                  </p>

                  <div className="mt-5 flex justify-center">
                    <Link
                      href="/admin/dashboard/products/new"
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Plus size={18} />
                      Create Product
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(grouped)
                    .sort()
                    .map((categoryKey) => (
                      <div
                        key={categoryKey}
                        className="card-outline-gold overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                          <div>
                            <div className="text-lg font-extrabold text-[var(--text-primary)]">
                              {getCategoryLabel(categoryKey)}
                            </div>
                            <div className="text-sm text-[var(--text-muted)]">
                              {grouped[categoryKey].length} product
                              {grouped[categoryKey].length === 1 ? "" : "s"}
                            </div>
                          </div>

                          <button
                            onClick={load}
                            className="btn btn-ghost"
                            type="button"
                          >
                            <RefreshCw size={16} />
                            Refresh
                          </button>
                        </div>

                        <div className="divide-y divide-[var(--border)]">
                          {grouped[categoryKey].map((product) => (
                            <div key={product.id} className="px-5 py-5">
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-extrabold text-[var(--text-primary)]">
                                      {product.name}
                                    </h3>

                                    {product.active !== false ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                                        <CheckCircle2 size={14} />
                                        Active
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                                        <XCircle size={14} />
                                        Inactive
                                      </span>
                                    )}

                                    {typeof product.order === "number" ? (
                                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                                        Order {product.order}
                                      </span>
                                    ) : null}

                                    {product.productTypeLabel ? (
                                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                                        {product.productTypeLabel}
                                      </span>
                                    ) : null}
                                  </div>

                                  {product.summary ? (
                                    <p className="mt-2 max-w-[70ch] text-sm leading-7 text-[var(--text-secondary)]">
                                      {product.summary}
                                    </p>
                                  ) : (
                                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                                      No summary added yet.
                                    </p>
                                  )}

                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                                    {safeCount(product.bullets) > 0 ? (
                                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold">
                                        Bullets: {safeCount(product.bullets)}
                                      </span>
                                    ) : null}

                                    {safeCount(product.whatItCovers) > 0 ? (
                                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold">
                                        Covers:{" "}
                                        {safeCount(product.whatItCovers)}
                                      </span>
                                    ) : null}

                                    {safeCount(product.whoItsFor) > 0 ? (
                                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold">
                                        Who it’s for:{" "}
                                        {safeCount(product.whoItsFor)}
                                      </span>
                                    ) : null}

                                    {safeCount(product.keyNotes) > 0 ? (
                                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold">
                                        Notes: {safeCount(product.keyNotes)}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 xl:justify-end">
                                  <Link
                                    href={`/admin/dashboard/products/${product.id}`}
                                    prefetch={false}
                                    className="btn btn-primary"
                                  >
                                    <Eye size={16} />
                                    View
                                  </Link>

                                  <Link
                                    href={`/admin/dashboard/products/${product.id}/edit`}
                                    prefetch={false}
                                    className="btn btn-outline"
                                  >
                                    <Pencil size={16} />
                                    Edit
                                  </Link>

                                  <button
                                    onClick={() => onDelete(product.id)}
                                    className="btn btn-ghost"
                                    type="button"
                                  >
                                    <Trash2 size={16} />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> these
              records add to the public insurance catalogue. View before editing
              or deleting so the product structure stays clean and client-safe.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<AdminHubLoader />}>
      <AdminProductsContent />
    </Suspense>
  );
}

