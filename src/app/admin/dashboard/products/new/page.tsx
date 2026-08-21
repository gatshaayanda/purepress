"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FolderKanban,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";

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

export default function NewProductPage() {
  const router = useRouter();
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

    const productTypeLabel = getProductTypeLabel(
      form.category,
      form.productType
    );

    setSaving(true);

    try {
      await addDoc(collection(firestore, "insurance_products"), {
        name: form.name.trim(),

        // Public page bucket. This must match /c/[category]
        category: form.category,

        // Detailed insurance type shown inside the public bucket.
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/admin/dashboard/products");
    } catch (err: any) {
      console.error("Save failed:", err);
      window.alert(err?.message || "Failed to save insurance product.");
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (value: InsuranceCategory) => {
    const firstProductType = PRODUCT_TYPE_OPTIONS[value][0]?.value || "other";

    setForm((prev) => ({
      ...prev,
      category: value,
      productType: firstProductType,
    }));
  };

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
                    <FolderKanban size={15} />
                    Sparkle Legacy • New Insurance Product
                  </div>

                  <h1 className="max-w-[13ch]">
                    Add a new public insurance product.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Create an insurance product entry under one of the four main
                    public product buckets. Detailed products such as Motor,
                    Home, Life, Funeral, or Agriculture now sit inside those
                    broader public categories.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Public category
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        This controls which public page the product appears on:
                        Short-Term, Long-Term, Business / SME, or Retirement.
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Product type
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        This is the specific insurance product shown inside the
                        selected public category.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Product checklist
                  </div>

                  <h2 className="mt-2 text-2xl">Before saving</h2>

                  <ul className="mt-5 space-y-3">
                    {[
                      "Choose the broad public category first.",
                      "Then choose the detailed product type inside that category.",
                      "Use a product name clients can recognize quickly.",
                      "Only mark inactive if the product should stay hidden from public pages.",
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
                      disabled={saving}
                      onClick={save}
                      className="btn btn-primary"
                      type="button"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <FolderKanban size={18} />
                      )}
                      {saving ? "Saving..." : "Save Product"}
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