"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FolderKanban,
  Loader2,
  Pencil,
  ShieldCheck,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";

type InsuranceCategory = "short-term" | "long-term" | "business" | "retirement";

type ProductType =
  | "motor"
  | "home-contents"
  | "travel"
  | "gadget"
  | "personal-accident"
  | "life"
  | "funeral"
  | "disability-income"
  | "credit-life"
  | "retirement-annuity"
  | "wealth-planning"
  | "sme-cover"
  | "liability"
  | "fleet"
  | "business-interruption"
  | "agriculture"
  | "other";

type FormState = {
  name: string;
  category: InsuranceCategory;
  productType: ProductType;
  summary: string;
  bullets: string;
  whatItCovers: string;
  whoItsFor: string;
  keyNotes: string;
  order: string;
  active: boolean;
};

const CATEGORY_OPTIONS: {
  value: InsuranceCategory;
  label: string;
  help: string;
}[] = [
  {
    value: "short-term",
    label: "Short-Term Insurance",
    help: "Motor, home, contents, travel, gadgets, accident, and similar cover.",
  },
  {
    value: "long-term",
    label: "Long-Term Insurance",
    help: "Life, funeral, disability, credit life, and protection products.",
  },
  {
    value: "business",
    label: "Business / SME Cover",
    help: "Business assets, liability, fleet, interruption, agriculture, and SME risk.",
  },
  {
    value: "retirement",
    label: "Retirement & Planning",
    help: "Retirement, annuities, wealth planning, and long-term financial security.",
  },
];

const PRODUCT_TYPE_OPTIONS: Record<
  InsuranceCategory,
  { value: ProductType; label: string }[]
> = {
  "short-term": [
    { value: "motor", label: "Motor Insurance" },
    { value: "home-contents", label: "Home & Contents" },
    { value: "travel", label: "Travel Insurance" },
    { value: "gadget", label: "Gadget Insurance" },
    { value: "personal-accident", label: "Personal Accident" },
    { value: "other", label: "Other Short-Term Cover" },
  ],
  "long-term": [
    { value: "life", label: "Life Cover" },
    { value: "funeral", label: "Funeral Cover" },
    { value: "disability-income", label: "Disability & Income Protection" },
    { value: "credit-life", label: "Credit Life" },
    { value: "other", label: "Other Long-Term Cover" },
  ],
  business: [
    { value: "sme-cover", label: "Business & SME Cover" },
    { value: "liability", label: "Liability Cover" },
    { value: "fleet", label: "Fleet Cover" },
    { value: "business-interruption", label: "Business Interruption" },
    { value: "agriculture", label: "Agriculture Insurance" },
    { value: "other", label: "Other Business Cover" },
  ],
  retirement: [
    { value: "retirement-annuity", label: "Retirement & Annuities" },
    { value: "wealth-planning", label: "Wealth Planning" },
    { value: "other", label: "Other Retirement / Planning Product" },
  ],
};

const LEGACY_CATEGORY_MAP: Record<
  string,
  { category: InsuranceCategory; productType: ProductType }
> = {
  "short-term": { category: "short-term", productType: "motor" },
  motor: { category: "short-term", productType: "motor" },
  home: { category: "short-term", productType: "home-contents" },
  travel: { category: "short-term", productType: "travel" },
  gadget: { category: "short-term", productType: "gadget" },

  "long-term": { category: "long-term", productType: "life" },
  life: { category: "long-term", productType: "life" },
  funeral: { category: "long-term", productType: "funeral" },
  disability: { category: "long-term", productType: "disability-income" },

  business: { category: "business", productType: "sme-cover" },

  retirement: { category: "retirement", productType: "retirement-annuity" },
};

function listToText(value?: string[]) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function toList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProductTypeLabel(
  category: InsuranceCategory,
  productType: ProductType
) {
  return (
    PRODUCT_TYPE_OPTIONS[category].find((item) => item.value === productType)
      ?.label || "Other"
  );
}

function normalizeLegacyCategory(rawCategory?: string, rawProductType?: string) {
  const mapped = LEGACY_CATEGORY_MAP[rawCategory || ""] || {
    category: "short-term" as InsuranceCategory,
    productType: "motor" as ProductType,
  };

  const validProductType = PRODUCT_TYPE_OPTIONS[mapped.category].some(
    (option) => option.value === rawProductType
  );

  return {
    category: mapped.category,
    productType: validProductType
      ? (rawProductType as ProductType)
      : mapped.productType,
  };
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: "",
    category: "short-term",
    productType: "motor",
    summary: "",
    bullets: "",
    whatItCovers: "",
    whoItsFor: "",
    keyNotes: "",
    order: "",
    active: true,
  });

  const selectedCategory = useMemo(
    () => CATEGORY_OPTIONS.find((item) => item.value === form.category),
    [form.category]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!id) {
          router.replace("/admin/dashboard/products");
          return;
        }

        const ref = doc(firestore, "insurance_products", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          throw new Error("Insurance product not found.");
        }

        const product = snap.data() as any;
        if (!alive) return;

        const normalized = normalizeLegacyCategory(
          product.category,
          product.productType
        );

        setForm({
          name: product.name ?? "",
          category: normalized.category,
          productType: normalized.productType,
          summary: product.summary ?? "",
          bullets: listToText(product.bullets),
          whatItCovers: listToText(product.whatItCovers),
          whoItsFor: listToText(product.whoItsFor),
          keyNotes: listToText(product.keyNotes),
          order: typeof product.order === "number" ? String(product.order) : "",
          active: product.active !== false,
        });
      } catch (error) {
        console.error("Load insurance product failed:", error);
        window.alert("Could not load insurance product.");
        router.push("/admin/dashboard/products");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, router]);

  const handleCategoryChange = (value: InsuranceCategory) => {
    const firstProductType = PRODUCT_TYPE_OPTIONS[value][0]?.value || "other";

    setForm((prev) => ({
      ...prev,
      category: value,
      productType: firstProductType,
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      window.alert("Product name is required.");
      return;
    }

    if (!form.summary.trim()) {
      window.alert("Summary is required.");
      return;
    }

    const orderValue =
      form.order.trim() === "" ? 999 : Number.parseInt(form.order, 10);

    if (form.order.trim() !== "" && Number.isNaN(orderValue)) {
      window.alert("Order must be a valid number.");
      return;
    }

    if (!id) return;

    const productTypeLabel = getProductTypeLabel(
      form.category,
      form.productType
    );

    setSaving(true);

    try {
      await updateDoc(doc(firestore, "insurance_products", id), {
        name: form.name.trim(),

        // Public route bucket: /c/short-term, /c/long-term, /c/business, /c/retirement
        category: form.category,

        // Detailed insurance product inside the bucket
        productType: form.productType,
        productTypeLabel,

        summary: form.summary.trim(),
        bullets: toList(form.bullets),
        whatItCovers: toList(form.whatItCovers),
        whoItsFor: toList(form.whoItsFor),
        keyNotes: toList(form.keyNotes),
        order: orderValue,
        active: form.active,
        admin_id: "admin",
        updatedAt: serverTimestamp(),
      });

      router.push("/admin/dashboard/products");
    } catch (error) {
      console.error("Update failed:", error);
      window.alert("Failed to update insurance product.");
      setSaving(false);
    }
  };

  if (loading) return <AdminHubLoader />;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5">
              <Link
                href="/admin/dashboard/products"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Insurance Products
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <Pencil size={15} />
                    Sparkle Legacy • Edit Insurance Product
                  </div>

                  <h1 className="max-w-[13ch]">
                    Update a public insurance product entry.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Edit this insurance product under one of the four main
                    public product buckets. Detailed product types sit inside
                    those buckets so the public navigation stays clean.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Public category
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        This controls which public page the product appears on.
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Product type
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        This describes the exact insurance product inside the
                        selected category.
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
                      "Keep the public category aligned with the main navigation.",
                      "Choose the correct detailed product type.",
                      "Keep the summary short, practical, and clear.",
                      "Only mark inactive if the product should be hidden publicly.",
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

                  <div className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Current public bucket
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      <b>{selectedCategory?.label}</b>
                      <br />
                      {selectedCategory?.help}
                    </p>
                  </div>

                  <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Product ID
                    </p>
                    <p className="mt-2 break-all text-xs leading-6 text-[var(--text-muted)]">
                      {id}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-8">
              <div className="card-outline-gold">
                <div className="card-inner space-y-5 md:p-8">
                  <div className="eyebrow mb-0">
                    <FileText size={15} />
                    Product details
                  </div>

                  <div>
                    <label
                      htmlFor="name"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Product Name
                    </label>
                    <input
                      id="name"
                      className="input mt-2"
                      placeholder="Example: Comprehensive Motor Cover"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="category"
                        className="text-sm font-semibold text-[var(--text-primary)]"
                      >
                        Public Category
                      </label>
                      <select
                        id="category"
                        className="input mt-2"
                        value={form.category}
                        onChange={(e) =>
                          handleCategoryChange(
                            e.target.value as InsuranceCategory
                          )
                        }
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="productType"
                        className="text-sm font-semibold text-[var(--text-primary)]"
                      >
                        Product Type
                      </label>
                      <select
                        id="productType"
                        className="input mt-2"
                        value={form.productType}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            productType: e.target.value as ProductType,
                          }))
                        }
                      >
                        {PRODUCT_TYPE_OPTIONS[form.category].map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="summary"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Summary
                    </label>
                    <textarea
                      id="summary"
                      className="input mt-2 min-h-[110px] resize-y rounded-[1.25rem]"
                      placeholder="Write a short practical summary of what this product is and why it matters."
                      value={form.summary}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          summary: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="bullets"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Bullets
                    </label>
                    <textarea
                      id="bullets"
                      className="input mt-2 min-h-[140px] resize-y rounded-[1.25rem]"
                      placeholder={`One item per line\nExample:\nCovers accidental damage\nCan include third-party protection\nSupports repair or replacement depending on policy`}
                      value={form.bullets}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bullets: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="whatItCovers"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      What It Covers
                    </label>
                    <textarea
                      id="whatItCovers"
                      className="input mt-2 min-h-[140px] resize-y rounded-[1.25rem]"
                      placeholder={`One item per line\nExample:\nVehicle accident damage\nTheft or attempted theft\nThird-party liability`}
                      value={form.whatItCovers}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          whatItCovers: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="whoItsFor"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Who It’s For
                    </label>
                    <textarea
                      id="whoItsFor"
                      className="input mt-2 min-h-[120px] resize-y rounded-[1.25rem]"
                      placeholder={`One item per line\nExample:\nPrivate vehicle owners\nFamilies protecting their home\nSMEs with business assets`}
                      value={form.whoItsFor}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          whoItsFor: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="keyNotes"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      Key Notes
                    </label>
                    <textarea
                      id="keyNotes"
                      className="input mt-2 min-h-[120px] resize-y rounded-[1.25rem]"
                      placeholder={`One item per line\nExample:\nSubject to underwriting\nBenefits depend on policy wording\nSupporting documents may be required`}
                      value={form.keyNotes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          keyNotes: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="order"
                        className="text-sm font-semibold text-[var(--text-primary)]"
                      >
                        Display Order
                      </label>
                      <input
                        id="order"
                        className="input mt-2"
                        placeholder="Example: 1"
                        value={form.order}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            order: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              active: e.target.checked,
                            }))
                          }
                        />
                        Active on public pages
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={save}
                      className="btn btn-primary"
                      type="button"
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <FolderKanban size={18} />
                      )}
                      {saving ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                      onClick={() => router.push("/admin/dashboard/products")}
                      className="btn btn-outline"
                      type="button"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> the
              public website stays clean with four main product categories,
              while the admin can still manage detailed insurance products
              inside each category.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}