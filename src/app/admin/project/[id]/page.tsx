"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FolderKanban,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";
import ChatPanel from "@/components/ChatPanel";

type ClientCaseRecord = {
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

function niceLabel(value?: string) {
  if (!value) return "—";
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
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

  return `sparkle-legacy-case-${safeName || id}.pdf`;
}

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

async function generateCaseSummaryPdf({
  id,
  record,
  displayName,
  portalAccess,
}: {
  id: string;
  record: ClientCaseRecord;
  displayName: string;
  portalAccess: boolean;
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

  const addBrandLine = () => {
    pdf.setDrawColor(...BRAND.gold);
    pdf.setLineWidth(0.7);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  };

  const addSectionTitle = (title: string) => {
    addPageIfNeeded(18);

    y += 3;

    pdf.setFillColor(...BRAND.gold);
    pdf.roundedRect(marginX, y, maxWidth, 9, 2, 2, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title.toUpperCase(), marginX + 4, y + 6.2);

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

  // Header background
  pdf.setFillColor(...BRAND.cream);
  pdf.rect(0, 0, pageWidth, 62, "F");

  // Logo
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
  pdf.text("Client Case Summary", pageWidth / 2, y, { align: "center" });

  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(
    "Professional insurance servicing record generated from the Sparkle Legacy admin system.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 7;

  addBrandLine();

  // Case summary strip
  pdf.setFillColor(...BRAND.paleCream);
  pdf.setDrawColor(232, 224, 202);
  pdf.roundedRect(marginX, y, maxWidth, 24, 3, 3, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...BRAND.text);
  pdf.text(cleanPdfText(displayName), marginX + 5, y + 8);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(`Generated: ${new Date().toLocaleString("en-BW")}`, marginX + 5, y + 15);
  pdf.text(`Case ID: ${id}`, marginX + 5, y + 20);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.gold);
  pdf.text(
    `Status: ${cleanPdfText(niceLabel(record.status))}`,
    pageWidth - marginX - 5,
    y + 8,
    { align: "right" }
  );
  pdf.text(
    `Request: ${cleanPdfText(niceLabel(record.request_type))}`,
    pageWidth - marginX - 5,
    y + 15,
    { align: "right" }
  );

  y += 34;

  addSectionTitle("Compliance & Contact");
  addField("NBFIRA License No", SPARKLE_CONTACT.nbfira);
  addField("CIPA Registration No", SPARKLE_CONTACT.cipa);
  addField("WhatsApp / Call", SPARKLE_CONTACT.phone);
  addField("Email", SPARKLE_CONTACT.email);

  addSectionTitle("Client Overview");
  addField("Client Name", record.client_name || displayName);
  addField("Client Email", record.client_email);
  addField("Client Phone", record.client_phone);
  addField("Client Type", niceLabel(record.client_type));
  addField("Business Name", record.business_name || record.business);
  addField("City / Town", record.city_town);

  addSectionTitle("Insurance Case Details");
  addField("Request Type", niceLabel(record.request_type));
  addField("Cover Type", niceLabel(record.cover_type));
  addField("Product / Policy Interest", record.product_interest);
  addField("Industry", record.industry);
  addField("Current Insurer", record.current_insurer);
  addField("Policy Number", record.policy_number);
  addField("Status", niceLabel(record.status));
  addField("Portal Access", portalAccess ? "Yes" : "No");

  addSectionTitle("Servicing Notes");
  addField("Risk Items / What Needs Cover", record.risk_items);
  addField("Support Summary", record.support_summary);
  addField("Required Documents", record.required_documents);
  addField("Client-facing Progress Update", record.progress_update);
  addField("Admin Notes", record.admin_notes);

  addSectionTitle("Saved Links & Files");
  addField("Saved Case File", record.documentName || record.documentUrl);
  addField("Document Type", record.documentType);
  addField("Document URL", record.documentUrl);
  addField("Shared Resource Link", record.resource_link);

  addSectionTitle("Important Note");
  addField(
    "Disclaimer",
    "This case summary is an administrative support document. Cover terms, premiums, claim outcomes, benefits, acceptance, and settlement decisions remain subject to insurer underwriting, policy wording, and applicable conditions."
  );

  addFooter();

  pdf.save(pdfFileName(displayName, id));
}

export default function ViewProjectPage() {
  const { id } = useParams() as { id: string };

  const [record, setRecord] = useState<ClientCaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCase = async () => {
      try {
        const snap = await getDoc(doc(firestore, "projects", id));
        if (!snap.exists()) throw new Error("Client case not found.");

        setRecord(snap.data() as ClientCaseRecord);
      } catch (e: any) {
        setError(e?.message || "Failed to load client case.");
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [id]);

  const displayName = useMemo(() => {
    if (!record) return "Client Case";

    return (
      record.client_name?.trim() ||
      record.business_name?.trim() ||
      record.business?.trim() ||
      record.client_email?.trim() ||
      "Unnamed Client Case"
    );
  }, [record]);

  const portalAccess = useMemo(() => {
    if (!record) return false;
    return !!record.portal_access || !!record.admin_panel;
  }, [record]);

  const handleDownloadPdf = async () => {
    if (!record) return;

    await generateCaseSummaryPdf({
      id,
      record,
      displayName,
      portalAccess,
    });
  };

  if (loading) return <AdminHubLoader />;

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="mb-5">
                <Link
                  href="/admin/project"
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
                >
                  <ArrowLeft size={16} />
                  Back to Client Cases
                </Link>
              </div>

              <div className="frame-gold p-8 text-center">
                <h1 className="text-2xl">Unable to open client case</h1>
                <p className="mt-3 text-sm leading-7 text-red-700">{error}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!record) return null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/admin/project"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Client Cases
              </Link>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="btn btn-primary"
                >
                  <Download size={16} />
                  Download Case PDF
                </button>

                <Link
                  href={`/admin/project/${id}/edit`}
                  prefetch={false}
                  className="btn btn-outline"
                >
                  <Edit3 size={16} />
                  Edit Case
                </Link>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <FolderKanban size={15} />
                    Sparkle Legacy • Client Case Overview
                  </div>

                  <h1 className="max-w-[16ch]">{displayName}</h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Review the insurance servicing details for this client case,
                    check the status, view intake information, open saved files,
                    and continue communication as <b>Sparkle Legacy Team</b>.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MiniStat
                      icon={<UserRound size={16} />}
                      label="Client"
                      value={record.client_name?.trim() || "Not provided"}
                    />
                    <MiniStat
                      icon={<Mail size={16} />}
                      label="Email"
                      value={record.client_email?.trim() || "Not provided"}
                    />
                    <MiniStat
                      icon={<Phone size={16} />}
                      label="Phone"
                      value={record.client_phone?.trim() || "Not provided"}
                    />
                    <MiniStat
                      icon={<BadgeCheck size={16} />}
                      label="Status"
                      value={niceLabel(record.status)}
                    />
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Case snapshot
                  </div>

                  <h2 className="mt-2 text-2xl">Insurance details</h2>

                  <div className="mt-5 grid gap-3">
                    <SnapshotRow
                      label="Request Type"
                      value={niceLabel(record.request_type)}
                    />
                    <SnapshotRow
                      label="Cover Type"
                      value={niceLabel(record.cover_type)}
                    />
                    <SnapshotRow
                      label="Product / Policy Interest"
                      value={record.product_interest}
                    />
                    <SnapshotRow
                      label="Client Type"
                      value={niceLabel(record.client_type)}
                    />
                    <SnapshotRow label="City / Town" value={record.city_town} />
                    <SnapshotRow
                      label="Portal Access"
                      value={portalAccess ? "Yes" : "No"}
                    />
                  </div>

                  {record.documentUrl ? (
                    <a
                      href={record.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex items-start justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 transition hover:bg-[var(--surface)]"
                    >
                      <div>
                        <div className="text-sm font-extrabold text-[var(--text-primary)]">
                          Saved Case File
                        </div>
                        <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                          {record.documentName || "Open uploaded PDF/image"}
                        </div>
                        {record.documentType ? (
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {record.documentType}
                          </div>
                        ) : null}
                      </div>
                      <ExternalLink
                        size={18}
                        className="mt-1 shrink-0 text-[var(--brand-primary-strong)]"
                      />
                    </a>
                  ) : null}

                  {record.resource_link ? (
                    <a
                      href={record.resource_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex items-start justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 transition hover:bg-[var(--surface)]"
                    >
                      <div>
                        <div className="text-sm font-extrabold text-[var(--text-primary)]">
                          Shared Resource Link
                        </div>
                        <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                          Open the linked Google Doc, Sheet, or shared file.
                        </div>
                      </div>
                      <ExternalLink
                        size={18}
                        className="mt-1 shrink-0 text-[var(--brand-primary-strong)]"
                      />
                    </a>
                  ) : null}

                  {record.progress_update ? (
                    <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Client-facing Progress Update
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        {record.progress_update}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <section className="mt-8 space-y-6">
              <ChatPanel
                projectId={id}
                senderName="Sparkle Legacy Team"
                canDeleteAll={true}
                brand={{
                  primary: "#887337",
                  accent: "#d6b678",
                }}
              />
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
              <InfoCard title="Client & Case Intake">
                <Read label="Client Name" value={record.client_name} />
                <Read label="Client Email" value={record.client_email} />
                <Read label="Client Phone" value={record.client_phone} />
                <Read label="Client Type" value={niceLabel(record.client_type)} />
                <Read
                  label="Business Name"
                  value={record.business_name || record.business}
                />
                <Read label="Industry" value={record.industry} />
                <Read label="City / Town" value={record.city_town} />
                <Read
                  label="Request Type"
                  value={niceLabel(record.request_type)}
                />
                <Read label="Cover Type" value={niceLabel(record.cover_type)} />
                <Read
                  label="Product / Policy Interest"
                  value={record.product_interest}
                />
              </InfoCard>

              <InfoCard title="Servicing & Internal Notes">
                <Read label="Current Insurer" value={record.current_insurer} />
                <Read label="Policy Number" value={record.policy_number} />
                <Read
                  label="Risk Items / What Needs Cover"
                  value={record.risk_items}
                />
                <Read label="Support Summary" value={record.support_summary} />
                <Read
                  label="Required Documents"
                  value={record.required_documents}
                />
                <Read label="Status" value={niceLabel(record.status)} />
                <Read label="Admin Notes" value={record.admin_notes} />
                <Read
                  label="Portal Access"
                  value={portalAccess ? "Yes" : "No"}
                />
                <Read
                  label="Saved Case File"
                  value={record.documentName || record.documentUrl}
                />
              </InfoCard>
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> this
              page serves as an insurance servicing record, not a generic web
              project page. Keep updates clear, operational, and client-safe.
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
  children: React.ReactNode;
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

function Read({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
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
  icon: React.ReactNode;
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

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
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