"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import {
  ArrowLeft,
  BadgeCheck,
  Edit3,
  ExternalLink,
  FileText,
  Mail,
  MessageSquareMore,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";
import ChatPanel from "@/components/ChatPanel";

type ClientCaseRecord = {
  id: string;
  admin_id?: string;

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

  title?: string;
};

function niceLabel(value?: string) {
  if (!value) return "—";
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getDisplayName(record: ClientCaseRecord) {
  return (
    record.client_name?.trim() ||
    record.business_name?.trim() ||
    record.business?.trim() ||
    record.client_email?.trim() ||
    "Unnamed Client"
  );
}

function getCaseLabel(record: ClientCaseRecord) {
  return (
    record.product_interest?.trim() ||
    record.business_name?.trim() ||
    record.business?.trim() ||
    record.title?.trim() ||
    niceLabel(record.request_type) ||
    "Client Case"
  );
}

function statusRank(status?: string) {
  const value = status || "";

  if (value === "new inquiry") return 1;
  if (value === "documents pending") return 2;
  if (value === "quote in progress") return 3;
  if (value === "submitted to insurer") return 4;
  if (value === "claim in progress") return 5;
  if (value === "policy active") return 6;
  if (value === "closed") return 99;

  return 20;
}

export default function AdminClientsPage() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ClientCaseRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadCases() {
      try {
        const snap = await getDocs(collection(firestore, "projects"));

        const rows = snap.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ClientCaseRecord, "id">),
          }))
          .filter((record) => !record.admin_id || record.admin_id === "admin")
          .sort((a, b) => {
            const statusDiff = statusRank(a.status) - statusRank(b.status);
            if (statusDiff !== 0) return statusDiff;

            return getDisplayName(a).localeCompare(getDisplayName(b));
          });

        if (!alive) return;

        setCases(rows);

        if (rows.length > 0) {
          setSelectedId((current) => current || rows[0].id);
        }
      } catch (error) {
        console.error("Failed to load client cases:", error);

        if (!alive) return;

        setCases([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadCases();

    return () => {
      alive = false;
    };
  }, []);

  const selectedCase = useMemo(
    () => cases.find((record) => record.id === selectedId) || null,
    [cases, selectedId]
  );

  const stats = useMemo(() => {
    const clientKeys = new Set(
      cases.map((record) => record.client_email?.trim() || record.id)
    );

    return {
      total: cases.length,
      clients: clientKeys.size,
      open: cases.filter((record) => record.status !== "closed").length,
      documentsPending: cases.filter(
        (record) => record.status === "documents pending"
      ).length,
    };
  }, [cases]);

  if (loading) return <AdminHubLoader />;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/admin/dashboard"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </Link>

              <Link
                href="/admin/project/create-project"
                prefetch={false}
                className="btn btn-primary"
              >
                <Plus size={16} />
                New Client Case
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <Users size={15} />
                    Sparkle Legacy • Client Cases
                  </div>

                  <h1 className="max-w-[13ch]">
                    Manage client support and servicing cases.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    This page gives Sparkle Legacy one place to review client
                    cases, check servicing status, open saved documents, and
                    continue conversations as <b>Sparkle Legacy Team</b>.
                  </p>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Overview
                  </div>

                  <h2 className="mt-2 text-2xl">Client support status</h2>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <StatCard label="Cases" value={String(stats.total)} />
                    <StatCard label="Clients" value={String(stats.clients)} />
                    <StatCard label="Open" value={String(stats.open)} />
                    <StatCard
                      label="Docs Pending"
                      value={String(stats.documentsPending)}
                    />
                  </div>

                  <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Speaking style
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      Messages should be warm, clear, professional, and helpful —
                      sent as <b>Sparkle Legacy Team</b>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {cases.length === 0 ? (
              <div className="mt-8 frame-gold p-8 text-center">
                <h2 className="text-2xl">No client cases found</h2>
                <p className="mx-auto mt-3 max-w-[54ch] text-sm leading-7 text-[var(--text-secondary)]">
                  Create a client case first. Once records exist in the{" "}
                  <b>projects</b> collection, they will appear here and the
                  message panel will use the existing{" "}
                  <b>/projects/{"{projectId}"}/messages</b> structure.
                </p>

                <div className="mt-5 flex justify-center">
                  <Link
                    href="/admin/project/create-project"
                    prefetch={false}
                    className="btn btn-primary"
                  >
                    <Plus size={16} />
                    Create Client Case
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <aside className="space-y-4">
                  <div className="card-outline-gold">
                    <div className="card-inner md:p-6">
                      <div className="eyebrow mb-0">
                        <UserRound size={15} />
                        Client case list
                      </div>

                      <h2 className="mt-2 text-xl">Select a case</h2>

                      <div className="mt-5 space-y-3">
                        {cases.map((record) => {
                          const active = selectedId === record.id;

                          return (
                            <button
                              key={record.id}
                              type="button"
                              onClick={() => setSelectedId(record.id)}
                              className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
                                active
                                  ? "border-[var(--brand-primary)] bg-[var(--brand-tint)]"
                                  : "border-[var(--border)] bg-white hover:bg-[var(--surface)]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-extrabold text-[var(--text-primary)]">
                                    {getDisplayName(record)}
                                  </div>
                                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                                    {getCaseLabel(record)}
                                  </div>
                                </div>

                                {active ? (
                                  <BadgeCheck
                                    size={18}
                                    className="shrink-0 text-[var(--brand-primary-strong)]"
                                  />
                                ) : null}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-[var(--border)] bg-white/80 px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                                  {niceLabel(record.status)}
                                </span>

                                {record.request_type ? (
                                  <span className="rounded-full border border-[var(--border)] bg-white/80 px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                                    {niceLabel(record.request_type)}
                                  </span>
                                ) : null}
                              </div>

                              {record.client_email ? (
                                <div className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                  <Mail size={13} />
                                  {record.client_email}
                                </div>
                              ) : null}

                              {record.progress_update ? (
                                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
                                  {record.progress_update}
                                </p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </aside>

                <section className="space-y-4">
                  {selectedCase ? (
                    <>
                      <div className="card-outline-gold">
                        <div className="card-inner md:p-6">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="eyebrow mb-0">
                                <MessageSquareMore size={15} />
                                Active client case
                              </div>

                              <h2 className="mt-2 text-2xl">
                                {getDisplayName(selectedCase)}
                              </h2>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/admin/project/${selectedCase.id}`}
                                prefetch={false}
                                className="btn btn-ghost"
                              >
                                <ExternalLink size={16} />
                                Open Full Case
                              </Link>

                              <Link
                                href={`/admin/project/${selectedCase.id}/edit`}
                                prefetch={false}
                                className="btn btn-outline"
                              >
                                <Edit3 size={16} />
                                Edit Case
                              </Link>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 md:grid-cols-3">
                            <InfoMini
                              label="Client"
                              value={getDisplayName(selectedCase)}
                            />
                            <InfoMini
                              label="Email"
                              value={selectedCase.client_email || "Not provided"}
                            />
                            <InfoMini
                              label="Phone"
                              value={selectedCase.client_phone || "Not provided"}
                            />
                            <InfoMini
                              label="Status"
                              value={niceLabel(selectedCase.status)}
                            />
                            <InfoMini
                              label="Request"
                              value={niceLabel(selectedCase.request_type)}
                            />
                            <InfoMini
                              label="Cover"
                              value={niceLabel(selectedCase.cover_type)}
                            />
                          </div>

                          {selectedCase.support_summary ? (
                            <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                              <p className="text-sm font-extrabold text-[var(--text-primary)]">
                                Support summary
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                                {selectedCase.support_summary}
                              </p>
                            </div>
                          ) : null}

                          {selectedCase.progress_update ? (
                            <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                              <p className="text-sm font-extrabold text-[var(--text-primary)]">
                                Progress update
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                                {selectedCase.progress_update}
                              </p>
                            </div>
                          ) : null}

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {selectedCase.documentUrl ? (
                              <a
                                href={selectedCase.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 transition hover:bg-[var(--surface)]"
                              >
                                <div>
                                  <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--text-primary)]">
                                    <FileText size={15} />
                                    Saved Case File
                                  </div>
                                  <div className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">
                                    {selectedCase.documentName ||
                                      "Open uploaded PDF/image"}
                                  </div>
                                </div>
                                <ExternalLink
                                  size={18}
                                  className="mt-1 shrink-0 text-[var(--brand-primary-strong)]"
                                />
                              </a>
                            ) : null}

                            {selectedCase.resource_link ? (
                              <a
                                href={selectedCase.resource_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 transition hover:bg-[var(--surface)]"
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

                      <ChatPanel
                        projectId={selectedCase.id}
                        senderName="Sparkle Legacy Team"
                        canDeleteAll={true}
                        brand={{
                          primary: "#887337",
                          accent: "#d6b678",
                        }}
                      />
                    </>
                  ) : null}
                </section>
              </div>
            )}

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> this page
              uses the existing project messaging structure, but the content is
              now framed as insurance client servicing and support.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4 text-center">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}