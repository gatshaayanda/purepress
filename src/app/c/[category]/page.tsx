"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import jsPDF from "jspdf";

import { firestore } from "@/utils/firebaseConfig";
import {
  Briefcase,
  Car,
  ChevronRight,
  Download,
  FileText,
  HeartPulse,
  Landmark,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";

const WHATSAPP_NUMBER = "+26772971852";
const PRODUCT_CACHE_KEY = "sparkle_legacy_insurance_products_v1";

function waLink(text: string) {
  const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

type InsuranceCategory =
  | "short-term"
  | "long-term"
  | "motor"
  | "home"
  | "travel"
  | "gadget"
  | "life"
  | "funeral"
  | "disability"
  | "retirement"
  | "business";

type InsuranceProduct = {
  id: string;
  name: string;
  category: InsuranceCategory;
  summary?: string;
  bullets?: string[];
  whatItCovers?: string[];
  whoItsFor?: string[];
  keyNotes?: string[];
  active?: boolean;
  order?: number;
};

type ProductCachePayload = {
  savedAt: string;
  categories: Partial<Record<InsuranceCategory, InsuranceProduct[]>>;
};

const VALID_CATEGORIES: InsuranceCategory[] = [
  "short-term",
  "long-term",
  "motor",
  "home",
  "travel",
  "gadget",
  "life",
  "funeral",
  "disability",
  "retirement",
  "business",
];

const CATEGORY_META: Record<
  InsuranceCategory,
  {
    title: string;
    subtitle: string;
    eyebrow: string;
    icon: ReactNode;
    ctaLabel: string;
    helperTitle: string;
    helperCopy: string;
  }
> = {
  "short-term": {
    title: "Short-Term Insurance",
    subtitle:
      "Short-Term insurance is generally used to protect things like cars, homes, contents, travel needs, gadgets, and other physical risks.",
    eyebrow: "Protecting what you own",
    icon: <ShieldCheck size={18} />,
    ctaLabel: "Request a Short-Term Quote",
    helperTitle: "What usually falls here",
    helperCopy:
      "This category is usually for things rather than people — for example motor, home, contents, travel, gadgets, and similar practical everyday protection.",
  },
  "long-term": {
    title: "Long-Term Insurance",
    subtitle:
      "Long-Term insurance is generally focused on people, families, income protection, life-related risks, and longer-horizon financial protection.",
    eyebrow: "Protecting people and future security",
    icon: <Sparkles size={18} />,
    ctaLabel: "Request a Long-Term Quote",
    helperTitle: "What usually falls here",
    helperCopy:
      "This category usually includes life cover, funeral cover, disability, credit life, and other protection linked to people, dependants, income, or long-term security.",
  },
  motor: {
    title: "Motor Insurance",
    subtitle:
      "Motor insurance helps protect vehicles through cover options such as third-party or comprehensive protection, depending on the product.",
    eyebrow: "Vehicle protection",
    icon: <Car size={18} />,
    ctaLabel: "Request a Motor Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "If you want protection for a personal or business vehicle, this is usually the right place to start. Share your vehicle details for faster guidance.",
  },
  home: {
    title: "Home & Contents Insurance",
    subtitle:
      "Home and contents cover helps protect property and belongings against selected risks, depending on the product structure.",
    eyebrow: "Property and household protection",
    icon: <ShieldCheck size={18} />,
    ctaLabel: "Request a Home Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "This is usually relevant when you want protection for your house, household contents, or similar property-related risks.",
  },
  travel: {
    title: "Travel Insurance",
    subtitle:
      "Travel insurance can help with selected travel-related risks such as disruptions, medical events, baggage issues, or cancellations, depending on the product.",
    eyebrow: "Travel with more confidence",
    icon: <ShieldCheck size={18} />,
    ctaLabel: "Request a Travel Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "Useful when you are preparing to travel and want guidance on common travel-related risks and cover options before departure.",
  },
  gadget: {
    title: "Gadget Insurance",
    subtitle:
      "Gadget insurance can help protect items like phones, laptops, or electronics against selected risks depending on the policy.",
    eyebrow: "Cover for everyday devices",
    icon: <ShieldCheck size={18} />,
    ctaLabel: "Request a Gadget Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "If you want help protecting valuable personal devices, this is a useful starting point. Mention the device type when requesting a quote.",
  },
  life: {
    title: "Life Cover",
    subtitle:
      "Life cover is designed to support financial protection for loved ones if the insured person passes away, subject to the product terms.",
    eyebrow: "Family-focused protection",
    icon: <HeartPulse size={18} />,
    ctaLabel: "Request a Life Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "Usually relevant if you want financial protection linked to dependants, family responsibilities, or longer-term financial planning.",
  },
  funeral: {
    title: "Funeral Cover",
    subtitle:
      "Funeral cover is designed to help with funeral-related costs when a covered member passes away, depending on the plan.",
    eyebrow: "Support during difficult times",
    icon: <Sparkles size={18} />,
    ctaLabel: "Request a Funeral Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "Often chosen by individuals or families who want practical financial support for funeral-related costs and immediate needs.",
  },
  disability: {
    title: "Disability & Income Protection",
    subtitle:
      "Disability and income protection products are generally meant to support situations where illness or injury affects the ability to work, depending on policy terms.",
    eyebrow: "Income-related protection",
    icon: <Sparkles size={18} />,
    ctaLabel: "Request a Disability Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "This is usually relevant where future income security matters and you want to understand possible protection if working ability is affected.",
  },
  retirement: {
    title: "Retirement & Annuities",
    subtitle:
      "Retirement-focused products are meant to support future financial security through long-term saving, planning, or income-oriented structures.",
    eyebrow: "Long-term financial planning",
    icon: <Landmark size={18} />,
    ctaLabel: "Request a Retirement Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "A good starting point if you are thinking ahead about retirement income, planning discipline, or future financial stability.",
  },
  business: {
    title: "Business & SME Cover",
    subtitle:
      "Business and SME cover can help protect business assets, liability exposures, continuity needs, fleet risks, and broader commercial operations.",
    eyebrow: "Protection for growing businesses",
    icon: <Briefcase size={18} />,
    ctaLabel: "Request a Business Quote",
    helperTitle: "Helpful for",
    helperCopy:
      "If you run a business and want help protecting property, operations, liability, vehicles, or broader commercial risk, start here.",
  },
};

const LOGO_PATH = "/logo.png";

const BRAND = {
  gold: [136, 115, 55] as [number, number, number],
  softGold: [214, 182, 120] as [number, number, number],
  cream: [255, 253, 249] as [number, number, number],
  paleCream: [248, 243, 232] as [number, number, number],
  text: [24, 24, 24] as [number, number, number],
  muted: [105, 105, 105] as [number, number, number],
};

const SPARKLE_CONTACT = {
  phone: "+267 72 971 852",
  email: "info@sparklelegacy.co.bw",
  nbfira: "[To be added]",
  cipa: "[To be added]",
};

function readProductCache(): ProductCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ProductCachePayload;

    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.categories || typeof parsed.categories !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function getCachedProducts(category: InsuranceCategory) {
  const cached = readProductCache();
  const products = cached?.categories?.[category];

  return {
    products: Array.isArray(products) ? products : [],
    savedAt: cached?.savedAt || "",
  };
}

function saveProductsToCache(
  category: InsuranceCategory,
  products: InsuranceProduct[]
) {
  if (typeof window === "undefined") return;

  try {
    const existing = readProductCache();

    const payload: ProductCachePayload = {
      savedAt: new Date().toISOString(),
      categories: {
        ...(existing?.categories || {}),
        [category]: products,
      },
    };

    localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not save products for offline use:", error);
  }
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

async function loadImageAsDataUrl(src: string) {
  try {
    const response = await fetch(src);
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Could not load PDF logo:", error);
    return "";
  }
}

function cleanPdfText(value: unknown) {
  const text =
    value && value.toString().trim().length > 0
      ? value.toString().trim()
      : "—";

  return text
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function pdfFileName(value: string) {
  const safeName = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  return `sparkle-legacy-${safeName || "insurance-guide"}.pdf`;
}

async function generateInsurancePdf({
  title,
  subtitle,
  helperTitle,
  helperCopy,
  products,
  singleProduct,
}: {
  title: string;
  subtitle: string;
  helperTitle: string;
  helperCopy: string;
  products: InsuranceProduct[];
  singleProduct?: InsuranceProduct;
}) {
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginX = 16;
  const maxWidth = pageWidth - marginX * 2;
  let y = 14;

  const logoDataUrl = await loadImageAsDataUrl(LOGO_PATH);

  const addPageIfNeeded = (needed = 18) => {
    if (y + needed > pageHeight - 24) {
      pdf.addPage();
      y = 18;
    }
  };

  const addFooter = () => {
    const pageCount = pdf.getNumberOfPages();

    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);

      pdf.setDrawColor(...BRAND.softGold);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, pageHeight - 18, pageWidth - marginX, pageHeight - 18);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...BRAND.muted);

      pdf.text(
        "Sparkle Legacy Insurance Brokers | NBFIRA License No: [To be added] | CIPA Registration No: [To be added]",
        marginX,
        pageHeight - 12
      );

      pdf.text(
        `WhatsApp / Call: ${SPARKLE_CONTACT.phone} | ${SPARKLE_CONTACT.email}`,
        marginX,
        pageHeight - 8
      );

      pdf.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - marginX - 22,
        pageHeight - 8
      );
    }
  };

  const addSectionTitle = (sectionTitle: string) => {
    addPageIfNeeded(18);

    y += 3;

    pdf.setFillColor(...BRAND.gold);
    pdf.roundedRect(marginX, y, maxWidth, 9, 2, 2, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(sectionTitle.toUpperCase(), marginX + 4, y + 6.2);

    y += 14;
  };

  const addField = (label: string, value: unknown) => {
    const cleanValue = cleanPdfText(value);
    const lines = pdf.splitTextToSize(cleanValue, maxWidth - 8);
    const neededHeight = 12 + lines.length * 5;

    addPageIfNeeded(neededHeight);

    pdf.setFillColor(...BRAND.cream);
    pdf.setDrawColor(232, 224, 202);
    pdf.roundedRect(marginX, y, maxWidth, neededHeight, 2, 2, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...BRAND.gold);
    pdf.text(label.toUpperCase(), marginX + 4, y + 5.5);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.text);
    pdf.text(lines, marginX + 4, y + 11);

    y += neededHeight + 3;
  };

  const addList = (listTitle: string, items?: string[]) => {
    if (!items?.length) return;

    addPageIfNeeded(16);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.gold);
    pdf.text(listTitle.toUpperCase(), marginX, y);

    y += 5;

    items.forEach((item) => {
      const cleanItem = `- ${cleanPdfText(item)}`;
      const lines = pdf.splitTextToSize(cleanItem, maxWidth);

      addPageIfNeeded(lines.length * 5 + 4);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...BRAND.text);
      pdf.text(lines, marginX, y);

      y += lines.length * 5 + 2;
    });

    y += 2;
  };

  pdf.setFillColor(...BRAND.cream);
  pdf.rect(0, 0, pageWidth, 62, "F");

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", 54, 8, 102, 34);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...BRAND.gold);
    pdf.text("SPARKLE LEGACY", pageWidth / 2, 22, { align: "center" });

    pdf.setFontSize(9);
    pdf.text("INSURANCE BROKERS", pageWidth / 2, 29, { align: "center" });
  }

  y = 48;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...BRAND.text);
  pdf.text(
    singleProduct ? "Product Information Sheet" : "Insurance Category Guide",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(
    "Professional insurance guidance generated from the Sparkle Legacy platform.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 7;

  pdf.setDrawColor(...BRAND.gold);
  pdf.setLineWidth(0.7);
  pdf.line(marginX, y, pageWidth - marginX, y);

  y += 8;

  pdf.setFillColor(...BRAND.paleCream);
  pdf.setDrawColor(232, 224, 202);
  pdf.roundedRect(marginX, y, maxWidth, 28, 3, 3, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...BRAND.text);
  pdf.text(cleanPdfText(singleProduct?.name || title), marginX + 5, y + 8);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...BRAND.muted);

  const subtitleLines = pdf.splitTextToSize(
    cleanPdfText(singleProduct?.summary || subtitle),
    maxWidth - 10
  );
  pdf.text(subtitleLines.slice(0, 3), marginX + 5, y + 15);

  y += 38;

  addSectionTitle("Compliance & Contact");
  addField("NBFIRA License No", SPARKLE_CONTACT.nbfira);
  addField("CIPA Registration No", SPARKLE_CONTACT.cipa);
  addField("WhatsApp / Call", SPARKLE_CONTACT.phone);
  addField("Email", SPARKLE_CONTACT.email);

  addSectionTitle(singleProduct ? "Product Overview" : "Category Overview");
  addField("Title", singleProduct?.name || title);
  addField("Summary", singleProduct?.summary || subtitle);
  addField(helperTitle, helperCopy);

  const productList = singleProduct ? [singleProduct] : products;

  addSectionTitle(singleProduct ? "Product Details" : "Available Products");

  if (productList.length === 0) {
    addField(
      "No Products Listed Yet",
      "This category has not been fully populated yet. You can still contact Sparkle Legacy for guidance or request a quote through WhatsApp."
    );
  }

  productList.forEach((product, index) => {
    addPageIfNeeded(30);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...BRAND.text);
    pdf.text(`${index + 1}. ${cleanPdfText(product.name)}`, marginX, y);

    y += 6;

    if (product.summary) {
      const summaryLines = pdf.splitTextToSize(
        cleanPdfText(product.summary),
        maxWidth
      );
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...BRAND.muted);
      pdf.text(summaryLines, marginX, y);
      y += summaryLines.length * 5 + 4;
    }

    addList("Key points", product.bullets);
    addList("What it covers", product.whatItCovers);
    addList("Who it is for", product.whoItsFor);
    addList("Important notes", product.keyNotes);

    y += 4;
  });

  addSectionTitle("Important Note");
  addField(
    "Disclaimer",
    "This document is for general insurance guidance only. Cover terms, premiums, benefits, acceptance, exclusions, claim outcomes, and settlement decisions remain subject to insurer underwriting, policy wording, and applicable conditions."
  );

  addFooter();

  pdf.save(pdfFileName(singleProduct?.name || title));
}

function DetailList({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-primary-strong)]">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {items.slice(0, 5).map((item, idx) => (
          <li
            key={`${title}-${idx}`}
            className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
          >
            <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const raw = (params?.category || "").toLowerCase();

  const category = (
    VALID_CATEGORIES.includes(raw as InsuranceCategory)
      ? (raw as InsuranceCategory)
      : "short-term"
  ) as InsuranceCategory;

  const meta = useMemo(() => CATEGORY_META[category], [category]);

  const [items, setItems] = useState<InsuranceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadProducts() {
      const cached = getCachedProducts(category);

      if (cached.products.length > 0) {
        setItems(cached.products);
        setUsingCachedData(true);
        setCacheSavedAt(cached.savedAt);
        setLoading(false);
      } else {
        setItems([]);
        setUsingCachedData(false);
        setCacheSavedAt("");
        setLoading(true);
      }

      try {
        const qRef = query(
          collection(firestore, "insurance_products"),
          where("category", "==", category)
        );

        const snap = await getDocs(qRef);

        if (!alive) return;

        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        })) as InsuranceProduct[];

        const cleaned = data
          .filter((p) => p.active !== false)
          .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

        setItems(cleaned);
        setUsingCachedData(false);
        setCacheSavedAt(new Date().toISOString());
        saveProductsToCache(category, cleaned);
      } catch (error) {
        console.error("Load category insurance products failed:", error);

        if (!alive) return;

        const fallback = getCachedProducts(category);

        if (fallback.products.length > 0) {
          setItems(fallback.products);
          setUsingCachedData(true);
          setCacheSavedAt(fallback.savedAt);
        } else {
          setItems([]);
          setUsingCachedData(false);
          setCacheSavedAt("");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      alive = false;
    };
  }, [category]);

  const defaultQuoteMsg = useMemo(() => {
    return [
      "Hi Sparkle Legacy 👋",
      `I’d like a quote for: ${meta.title}`,
      "",
      "My details:",
      "Name: ",
      "Phone: ",
      "City/Town: ",
      "",
      "Notes (optional): ",
    ].join("\n");
  }, [meta.title]);

  const handleDownloadCategoryPdf = async () => {
    setDownloadingPdf(true);

    try {
      await generateInsurancePdf({
        title: meta.title,
        subtitle: meta.subtitle,
        helperTitle: meta.helperTitle,
        helperCopy: meta.helperCopy,
        products: items,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadProductPdf = async (product: InsuranceProduct) => {
    setDownloadingPdf(true);

    try {
      await generateInsurancePdf({
        title: meta.title,
        subtitle: meta.subtitle,
        helperTitle: meta.helperTitle,
        helperCopy: meta.helperCopy,
        products: items,
        singleProduct: product,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <main id="main" className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell border-b border-[var(--border)]">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="eyebrow">
                {meta.icon}
                {meta.eyebrow}
              </div>

              {usingCachedData ? (
                <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                  <WifiOff
                    size={14}
                    className="shrink-0 text-[var(--brand-primary-strong)]"
                  />
                  <span>
                    Showing saved offline products
                    {cacheSavedAt ? ` • Updated ${formatCacheTime(cacheSavedAt)}` : ""}
                  </span>
                </div>
              ) : null}

              <h1 className="max-w-[13ch]">{meta.title}</h1>
              <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                {meta.subtitle}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href="/c/short-term"
                  prefetch={false}
                  className={`menu-link ${
                    category === "short-term" ? "active" : ""
                  }`}
                >
                  Short-Term
                </Link>
                <Link
                  href="/c/long-term"
                  prefetch={false}
                  className={`menu-link ${
                    category === "long-term" ? "active" : ""
                  }`}
                >
                  Long-Term
                </Link>
                <Link
                  href="/c/business"
                  prefetch={false}
                  className={`menu-link ${
                    category === "business" ? "active" : ""
                  }`}
                >
                  SME Cover
                </Link>
                <Link
                  href="/c/retirement"
                  prefetch={false}
                  className={`menu-link ${
                    category === "retirement" ? "active" : ""
                  }`}
                >
                  Retirement
                </Link>
                <Link href="/claims" prefetch={false} className="menu-link">
                  Claims
                </Link>
                <Link href="/contact" prefetch={false} className="menu-link">
                  Contact
                </Link>
              </div>
            </div>

            <div className="card-elevated p-5 md:p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-primary-strong)]">
                Need a faster next step?
              </p>

              <h2 className="mt-2 text-2xl">Request help directly.</h2>

              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Share the product, your city or town, and any useful notes. If
                you are unsure what to ask for, describe your situation and the
                team can guide you.
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link href="/contact" prefetch={false} className="btn btn-outline">
                  <FileText size={18} />
                  Contact
                </Link>

                <button
                  type="button"
                  onClick={handleDownloadCategoryPdf}
                  disabled={downloadingPdf}
                  className="btn btn-outline"
                >
                  <Download size={18} />
                  {downloadingPdf ? "Preparing..." : "Download Guide"}
                </button>

                <a
                  href={waLink(defaultQuoteMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <MessageCircle size={18} />
                  {meta.ctaLabel}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 frame-gold p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[var(--brand-primary-strong)]">
                <ShieldCheck size={18} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-[var(--text-primary)]">
                  {meta.helperTitle}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                  {meta.helperCopy}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="container">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="card overflow-hidden">
                  <div className="card-inner">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-[var(--surface-2)]" />
                    <div className="mt-5 h-10 w-full animate-pulse rounded-full bg-[var(--surface-2)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="frame-gold p-8 text-center">
              <h2 className="text-2xl">No products listed here yet</h2>
              <p className="mx-auto mt-3 max-w-[54ch] text-sm leading-7 text-[var(--text-secondary)]">
                You can still request a quote directly and explain what you need.
                Sparkle Legacy can guide you toward the right cover even if this
                category has not been fully populated yet.
              </p>

              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row sm:flex-wrap">
                <Link href="/contact" prefetch={false} className="btn btn-outline">
                  <FileText size={18} />
                  Contact
                </Link>

                <button
                  type="button"
                  onClick={handleDownloadCategoryPdf}
                  disabled={downloadingPdf}
                  className="btn btn-outline"
                >
                  <Download size={18} />
                  {downloadingPdf ? "Preparing..." : "Download Guide"}
                </button>

                <a
                  href={waLink(defaultQuoteMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <MessageCircle size={18} />
                  WhatsApp for Quote
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="eyebrow">Available guidance</div>
                <h2 className="section-title">Explore products in this category.</h2>
                <p className="section-copy mt-2">
                  Each product card can explain what it is, who it may suit,
                  what it may cover, and practical notes to help visitors move
                  forward with more confidence.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((product) => {
                  const msg = [
                    "Hi Sparkle Legacy 👋",
                    `I’d like a quote for: ${product.name}`,
                    `Category: ${meta.title}`,
                    "",
                    "My details:",
                    "Name: ",
                    "Phone: ",
                    "City/Town: ",
                    "",
                    "Notes (optional): ",
                  ].join("\n");

                  return (
                    <article key={product.id} className="card h-full overflow-hidden">
                      <div className="card-inner flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl">{product.name}</h3>
                            {product.summary ? (
                              <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                                {product.summary}
                              </p>
                            ) : null}
                          </div>

                          <span className="mt-1 shrink-0 text-[var(--brand-primary-strong)]">
                            <ChevronRight size={18} />
                          </span>
                        </div>

                        <DetailList title="Key points" items={product.bullets} />
                        <DetailList title="What it covers" items={product.whatItCovers} />
                        <DetailList title="Who it is for" items={product.whoItsFor} />
                        <DetailList title="Important notes" items={product.keyNotes} />

                        <div className="mt-auto pt-5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <a
                              href={waLink(msg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary flex-1 justify-center"
                            >
                              <MessageCircle size={18} />
                              Request Quote
                            </a>

                            <button
                              type="button"
                              onClick={() => handleDownloadProductPdf(product)}
                              disabled={downloadingPdf}
                              className="btn btn-outline"
                            >
                              <Download size={18} />
                              PDF
                            </button>

                            <Link
                              href="/contact"
                              prefetch={false}
                              className="btn btn-outline"
                            >
                              Contact
                            </Link>
                          </div>

                          <p className="mt-4 text-xs leading-6 text-[var(--text-muted)]">
                            Tip: include practical details like vehicle model,
                            property type, dependants, sum assured, or any other
                            context that will help the team respond faster.
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}