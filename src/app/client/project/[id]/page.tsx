"use client";

import Link from "next/link";
import jsPDF from "jspdf";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";
import ChatPanel from "@/components/ChatPanel";

type ClientCase = {
  id: string;

  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_type?: string;

  business?: string;
  business_name?: string;
  city_town?: string;

  request_type?: string;
  cover_type?: string;
  product_interest?: string;
  industry?: string;
  current_insurer?: string;
  policy_number?: string;

  risk_items?: string;
  support_summary?: string;
  required_documents?: string;

  portal_access?: boolean;
  admin_panel?: boolean;

  status?: string;
  admin_notes?: string;
  progress_update?: string;
  resource_link?: string;

  documentUrl?: string;
  documentName?: string;
  documentType?: string;
};

type CachedCase = {
  caseRecord: ClientCase;
  cachedAt: string;
};

type CachedDashboard = {
  cases: ClientCase[];
  messageCounts?: Record<string, number>;
  cachedAt: string;
};

const SPARKLE_WHATSAPP = "+267 72 971 852";
const SPARKLE_BRAND_GOLD: [number, number, number] = [136, 115, 55];
const SPARKLE_SOFT_GOLD: [number, number, number] = [248, 243, 232];
const SPARKLE_DARK: [number, number, number] = [28, 25, 20];

const CASE_CACHE_PREFIX = "sparkle_client_case_cache_v1";
const DASHBOARD_CACHE_PREFIX = "sparkle_client_dashboard_cache_v1";

function caseCacheKey(email: string, id: string) {
  return `${CASE_CACHE_PREFIX}_${email.toLowerCase().trim()}_${id}`;
}

function dashboardCacheKey(email: string) {
  return `${DASHBOARD_CACHE_PREFIX}_${email.toLowerCase().trim()}`;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readCachedCase(email: string, id: string): CachedCase | null {
  if (typeof window === "undefined") return null;

  try {
    const direct = safeJsonParse<CachedCase>(
      localStorage.getItem(caseCacheKey(email, id))
    );

    if (direct?.caseRecord) return direct;

    const dashboard = safeJsonParse<CachedDashboard>(
      localStorage.getItem(dashboardCacheKey(email))
    );

    const fromDashboard = dashboard?.cases?.find((item) => item.id === id);

    if (fromDashboard) {
      return {
        caseRecord: fromDashboard,
        cachedAt: dashboard?.cachedAt || new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function saveCachedCase(email: string, id: string, caseRecord: ClientCase) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      caseCacheKey(email, id),
      JSON.stringify({
        caseRecord,
        cachedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Could not save client case cache:", error);
  }
}

function formatCachedAt(value: string) {
  try {
    return new Date(value).toLocaleString("en-BW", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "recently";
  }
}

function niceLabel(value?: string) {
  if (!value) return "—";

  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getCaseTitle(item: ClientCase) {
  return (
    item.product_interest?.trim() ||
    item.business_name?.trim() ||
    item.business?.trim() ||
    item.client_name?.trim() ||
    "Insurance Case"
  );
}

function portalEnabled(item: ClientCase) {
  return item.portal_access === true || item.admin_panel === true;
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

function pdfFileName(name: string, id: string) {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);

  return `sparkle-legacy-client-case-${safeName || id}.pdf`;
}

async function imageToDataUrl(path: string) {
  try {
    const response = await fetch(path);

    if (!response.ok) return "";

    const blob = await response.blob();

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        resolve(typeof reader.result === "string" ? reader.result : "");
      };

      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

async function generateClientCasePdf({
  id,
  record,
  title,
}: {
  id: string;
  record: ClientCase;
  title: string;
}) {
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginX = 16;
  const maxWidth = pageWidth - marginX * 2;

  let y = 18;

  const logoDataUrl = await imageToDataUrl("/logo.png");

  const addSmallHeader = () => {
    pdf.setFillColor(...SPARKLE_SOFT_GOLD);
    pdf.rect(0, 0, pageWidth, 13, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...SPARKLE_BRAND_GOLD);
    pdf.text("SPARKLE LEGACY INSURANCE BROKERS", marginX, 8.5);

    pdf.setDrawColor(...SPARKLE_BRAND_GOLD);
    pdf.line(marginX, 13, pageWidth - marginX, 13);

    y = 22;
  };

  const addPageIfNeeded = (needed = 18) => {
    if (y + needed > pageHeight - 22) {
      pdf.addPage();
      y = 18;
      addSmallHeader();
    }
  };

  const addSectionTitle = (sectionTitle: string) => {
    addPageIfNeeded(18);

    y += 4;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...SPARKLE_DARK);
    pdf.text(sectionTitle, marginX, y);

    y += 3;

    pdf.setDrawColor(...SPARKLE_BRAND_GOLD);
    pdf.line(marginX, y, pageWidth - marginX, y);

    y += 7;
  };

  const addField = (label: string, value: unknown) => {
    addPageIfNeeded(18);

    const cleanValue = cleanPdfText(value);
    const lines = pdf.splitTextToSize(cleanValue, maxWidth);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 91, 70);
    pdf.text(label.toUpperCase(), marginX, y);

    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(30, 30, 30);
    pdf.text(lines, marginX, y);

    y += lines.length * 5 + 4;
  };

  const addFooter = () => {
    const pageCount = pdf.getNumberOfPages();

    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);

      pdf.setDrawColor(220, 210, 185);
      pdf.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(115, 115, 115);

      pdf.text(
        "Sparkle Legacy Insurance Brokers | WhatsApp: +267 72 971 852 | NBFIRA License No: [To be added] | CIPA Registration No: [To be added]",
        marginX,
        pageHeight - 10
      );

      pdf.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - marginX - 22,
        pageHeight - 10
      );
    }
  };

  pdf.setFillColor(...SPARKLE_SOFT_GOLD);
  pdf.rect(0, 0, pageWidth, 54, "F");

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", marginX, 12, 26, 26);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(...SPARKLE_DARK);
  pdf.text("Sparkle Legacy", logoDataUrl ? marginX + 33 : marginX, 22);

  pdf.setFontSize(10);
  pdf.setTextColor(...SPARKLE_BRAND_GOLD);
  pdf.text("INSURANCE BROKERS", logoDataUrl ? marginX + 33 : marginX, 29);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(85, 85, 85);
  pdf.text("Client Case Summary", logoDataUrl ? marginX + 33 : marginX, 36);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...SPARKLE_DARK);
  pdf.text(cleanPdfText(title), marginX, 66);

  y = 74;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90, 90, 90);
  pdf.text(`Generated: ${new Date().toLocaleString("en-BW")}`, marginX, y);

  y += 6;
  pdf.text(`Case ID: ${id}`, marginX, y);

  y += 8;

  pdf.setFillColor(...SPARKLE_BRAND_GOLD);
  pdf.rect(marginX, y, pageWidth - marginX * 2, 9, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  pdf.text("CLIENT-SAFE CASE COPY", marginX + 4, y + 6);

  y += 18;

  addSectionTitle("Client Overview");
  addField("Client Name", record.client_name);
  addField("Client Email", record.client_email);
  addField("Client Phone", record.client_phone);
  addField("Client Type", niceLabel(record.client_type));
  addField("Business Name", record.business_name || record.business);
  addField("City / Town", record.city_town);

  addSectionTitle("Case Details");
  addField("Case Title", title);
  addField("Status", niceLabel(record.status));
  addField("Request Type", niceLabel(record.request_type));
  addField("Cover Type", niceLabel(record.cover_type));
  addField("Product / Policy Interest", record.product_interest);
  addField("Industry", record.industry);
  addField("Current Insurer", record.current_insurer);
  addField("Policy Number", record.policy_number);

  addSectionTitle("Latest Update");
  addField("Progress Update", record.progress_update);
  addField("Required Documents", record.required_documents);
  addField("Support Summary", record.support_summary);
  addField("Risk Items / What Needs Cover", record.risk_items);

  addSectionTitle("Files & Links");
  addField("Saved Case File", record.documentName || record.documentUrl);
  addField("Document Type", record.documentType);
  addField("Document URL", record.documentUrl);
  addField("Shared Resource Link", record.resource_link);

  addSectionTitle("Sparkle Legacy Contact Details");
  addField("WhatsApp / Phone", SPARKLE_WHATSAPP);
  addField("NBFIRA License No", "[To be added]");
  addField("CIPA Registration No", "[To be added]");

  addSectionTitle("Important Note");
  addField(
    "Disclaimer",
    "This document is a client-facing case summary for reference and communication support. Final cover terms, premiums, claim outcomes, benefits, acceptance, exclusions, and settlement decisions remain subject to insurer underwriting, policy wording, and applicable conditions."
  );

  addFooter();

  pdf.save(pdfFileName(title, id));
}

export default function ClientProjectDetails() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [clientEmail, setClientEmail] = useState("");
  const [caseRecord, setCaseRecord] = useState<ClientCase | null>(null);
  const [cachedAt, setCachedAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const updateOnlineStatus = () => {
      setOnline(navigator.onLine);
    };

    updateOnlineStatus();

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  async function loadCaseFromNetwork(email: string, hasCachedCase: boolean) {
    setError("");

    if (hasCachedCase) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const ref = doc(firestore, "projects", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        throw new Error("Client case not found.");
      }

      const data = {
        id: snap.id,
        ...(snap.data() as Omit<ClientCase, "id">),
      };

      if (data.client_email !== email) {
        throw new Error("You are not authorized to view this case.");
      }

      if (!portalEnabled(data)) {
        throw new Error("This case is not enabled for client portal access yet.");
      }

      setCaseRecord(data);

      const savedAt = new Date().toISOString();
      setCachedAt(savedAt);

      saveCachedCase(email, id, data);
    } catch (err: any) {
      console.error("Failed to load client case:", err);

      const cached = readCachedCase(email, id);

      if (cached?.caseRecord) {
        setCaseRecord(cached.caseRecord);
        setCachedAt(cached.cachedAt || "");
        setError("");
      } else {
        setError(err?.message || "Failed to load client case.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("role="));

    const email = cookie ? decodeURIComponent(cookie.split("=")[1]) : "";

    if (!email || !email.includes("@")) {
      router.replace("/client/login");
      return;
    }

    setClientEmail(email);

    const cached = readCachedCase(email, id);
    const hasCachedCase = !!cached?.caseRecord;

    if (cached?.caseRecord) {
      setCaseRecord(cached.caseRecord);
      setCachedAt(cached.cachedAt || "");
      setLoading(false);
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    loadCaseFromNetwork(email, hasCachedCase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router, online]);

  const title = useMemo(() => {
    if (!caseRecord) return "Insurance Case";
    return getCaseTitle(caseRecord);
  }, [caseRecord]);

  const handleRefresh = () => {
    if (!clientEmail || !online) return;
    loadCaseFromNetwork(clientEmail, !!caseRecord);
  };

  const handleDownloadPdf = async () => {
    if (!caseRecord) return;

    setPdfBusy(true);

    try {
      await generateClientCasePdf({
        id,
        record: caseRecord,
        title,
      });
    } catch (err) {
      console.error("Failed to generate client case PDF:", err);
      window.alert("Failed to generate PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) return <AdminHubLoader />;

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="mb-5">
                <Link
                  href="/client/dashboard"
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
                >
                  <ArrowLeft size={16} />
                  Back to Dashboard
                </Link>
              </div>

              <div className="frame-gold p-8 text-center">
                <h1 className="text-2xl">Unable to open case</h1>
                <p className="mt-3 text-sm leading-7 text-red-700">{error}</p>

                <button
                  type="button"
                  onClick={() => router.push("/client/dashboard")}
                  className="btn btn-outline mt-5"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!caseRecord) return null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            {!online ? (
              <div className="mb-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                <div className="flex items-start gap-2">
                  <WifiOff size={17} className="mt-1 shrink-0" />
                  <p>
                    You are offline. This case page is showing saved case data
                    from this device. Messages and new updates will refresh when
                    you are online again.
                  </p>
                </div>
              </div>
            ) : cachedAt ? (
              <div className="mb-5 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm leading-7 text-green-700">
                <div className="flex items-start gap-2">
                  <Wifi size={17} className="mt-1 shrink-0" />
                  <p>
                    Online. This case was last saved on{" "}
                    <b>{formatCachedAt(cachedAt)}</b>.
                    {refreshing ? " Refreshing latest case updates…" : ""}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/client/dashboard"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </Link>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={!online || refreshing}
                  className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={pdfBusy}
                  className="btn btn-primary"
                >
                  <Download size={16} />
                  {pdfBusy ? "Preparing PDF..." : "Download Case PDF"}
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <ShieldCheck size={15} />
                    Sparkle Legacy • Client Case
                  </div>

                  <h1 className="max-w-[15ch]">{title}</h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    View your case status, progress update, required documents,
                    saved files, and messages from the Sparkle Legacy team.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MiniStat
                      icon={<UserRound size={16} />}
                      label="Client"
                      value={caseRecord.client_name || "Not provided"}
                    />
                    <MiniStat
                      icon={<Mail size={16} />}
                      label="Email"
                      value={clientEmail}
                    />
                    <MiniStat
                      icon={<Phone size={16} />}
                      label="Phone"
                      value={caseRecord.client_phone || "Not provided"}
                    />
                    <MiniStat
                      icon={<BadgeCheck size={16} />}
                      label="Status"
                      value={niceLabel(caseRecord.status)}
                    />
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <FileText size={15} />
                    Case Summary
                  </div>

                  <h2 className="mt-2 text-2xl">Your case details</h2>

                  <div className="mt-5 grid gap-3">
                    <SnapshotRow
                      label="Request Type"
                      value={niceLabel(caseRecord.request_type)}
                    />
                    <SnapshotRow
                      label="Cover Type"
                      value={niceLabel(caseRecord.cover_type)}
                    />
                    <SnapshotRow
                      label="Product / Policy"
                      value={caseRecord.product_interest}
                    />
                    <SnapshotRow
                      label="City / Town"
                      value={caseRecord.city_town}
                    />
                  </div>

                  {caseRecord.documentUrl ? (
                    <a
                      href={caseRecord.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex items-start justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 transition hover:bg-[var(--surface)]"
                    >
                      <div>
                        <div className="text-sm font-extrabold text-[var(--text-primary)]">
                          Saved Case File
                        </div>
                        <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                          {caseRecord.documentName || "Open uploaded PDF/image"}
                        </div>
                      </div>
                      <ExternalLink
                        size={18}
                        className="mt-1 shrink-0 text-[var(--brand-primary-strong)]"
                      />
                    </a>
                  ) : null}

                  {caseRecord.resource_link ? (
                    <a
                      href={caseRecord.resource_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex items-start justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 transition hover:bg-[var(--surface)]"
                    >
                      <div>
                        <div className="text-sm font-extrabold text-[var(--text-primary)]">
                          Shared Resource Link
                        </div>
                        <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                          Open linked document or shared file.
                        </div>
                      </div>
                      <ExternalLink
                        size={18}
                        className="mt-1 shrink-0 text-[var(--brand-primary-strong)]"
                      />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
              <InfoCard title="Latest Update">
                <Read
                  label="Progress Update"
                  value={
                    caseRecord.progress_update ||
                    "No update has been added yet."
                  }
                />

                <Read
                  label="Required Documents"
                  value={
                    caseRecord.required_documents ||
                    "No document request has been added yet."
                  }
                />

                <Read
                  label="Support Summary"
                  value={caseRecord.support_summary}
                />
              </InfoCard>

              <InfoCard title="Case Information">
                <Read
                  label="Client Type"
                  value={niceLabel(caseRecord.client_type)}
                />
                <Read
                  label="Business Name"
                  value={caseRecord.business_name || caseRecord.business}
                />
                <Read label="Industry" value={caseRecord.industry} />
                <Read
                  label="Current Insurer"
                  value={caseRecord.current_insurer}
                />
                <Read label="Policy Number" value={caseRecord.policy_number} />
                <Read
                  label="Risk Items / What Needs Cover"
                  value={caseRecord.risk_items}
                />
              </InfoCard>
            </section>

            <section className="mt-8">
              <div className="mb-4">
                <div className="eyebrow">
                  <MessageCircle size={15} />
                  Messages
                </div>
                <h2 className="mt-2 text-2xl">Continue the conversation</h2>
                <p className="mt-2 max-w-[65ch] text-sm leading-7 text-[var(--text-secondary)]">
                  Send updates, questions, documents, or links directly to the
                  Sparkle Legacy team.
                </p>
              </div>

              {online ? (
                <ChatPanel
                  projectId={id}
                  senderName={caseRecord.client_name || "Client"}
                  canDeleteAll={false}
                  brand={{
                    primary: "#887337",
                    accent: "#d6b678",
                  }}
                />
              ) : (
                <div className="frame-gold p-6 text-sm leading-7 text-[var(--text-secondary)]">
                  <b className="text-[var(--text-primary)]">
                    Messages are paused offline.
                  </b>{" "}
                  You can still read this saved case summary and download the
                  case PDF. Reconnect to the internet to send messages or view
                  the latest conversation.
                </div>
              )}
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Note:</b> This portal
              helps you track updates and communicate with Sparkle Legacy. Final
              cover terms, claims decisions, benefits, and acceptance remain
              subject to insurer underwriting and policy wording.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card-outline-gold h-full">
      <div className="card-inner md:p-8">
        <div className="eyebrow mb-0">
          <FileText size={15} />
          {title}
        </div>

        <div className="mt-5 space-y-4">{children}</div>
      </div>
    </section>
  );
}

function Read({ label, value }: { label: string; value: unknown }) {
  const text =
    value && value.toString().trim().length > 0 ? value.toString().trim() : "—";

  return (
    <div>
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-primary)]">
        {text}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
      <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold leading-7 text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value?: string }) {
  const text = value && value.trim().length > 0 ? value.trim() : "—";

  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-white/80 px-4 py-3">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
        {text}
      </div>
    </div>
  );
}