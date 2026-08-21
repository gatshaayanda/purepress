"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  BadgeCheck,
  FileText,
  FolderKanban,
  Mail,
  MapPin,
  MessageSquareMore,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  Eye,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import AdminHubLoader from "@/components/AdminHubLoader";

interface ClientCase {
  id: string;
  displayName: string;
  clientEmail?: string;
  clientPhone?: string;
  cityTown?: string;
  coverType?: string;
  requestType?: string;
  productInterest?: string;
  status?: string;
  progressUpdate?: string;
  hasClientMessages: boolean;
}

const ADMIN_SENDER = "Sparkle Legacy Team";

function niceLabel(value?: string) {
  if (!value) return "—";
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function ProjectListPage() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ClientCase[]>([]);

  useEffect(() => {
    const fetchCasesAndMessages = async () => {
      try {
        const snap = await getDocs(
          query(collection(firestore, "projects"), where("admin_id", "==", "admin"))
        );

        const rows: ClientCase[] = await Promise.all(
          snap.docs.map(async (docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const caseId = docSnap.id;

            const displayName =
              (typeof data.client_name === "string" && data.client_name.trim()) ||
              (typeof data.business_name === "string" && data.business_name.trim()) ||
              (typeof data.business === "string" && data.business.trim()) ||
              (typeof data.client_email === "string" && data.client_email.trim()) ||
              "Unnamed Client Case";

            const clientEmail =
              typeof data.client_email === "string" ? data.client_email : "";

            const clientPhone =
              typeof data.client_phone === "string" ? data.client_phone : "";

            const cityTown =
              typeof data.city_town === "string"
                ? data.city_town
                : typeof data.city === "string"
                ? data.city
                : "";

            const coverType =
              typeof data.cover_type === "string" ? data.cover_type : "";

            const requestType =
              typeof data.request_type === "string" ? data.request_type : "";

            const productInterest =
              typeof data.product_interest === "string"
                ? data.product_interest
                : "";

            const status =
              typeof data.status === "string" ? data.status : "";

            const progressUpdate =
              typeof data.progress_update === "string"
                ? data.progress_update
                : "";

            const messagesSnap = await getDocs(
              query(
                collection(firestore, "projects", caseId, "messages"),
                orderBy("timestamp", "desc"),
                limit(10)
              )
            );

            const hasClientMessages = messagesSnap.docs.some((msg) => {
              const sender = msg.data().sender;
              return typeof sender === "string" && sender !== ADMIN_SENDER;
            });

            return {
              id: caseId,
              displayName,
              clientEmail,
              clientPhone,
              cityTown,
              coverType,
              requestType,
              productInterest,
              status,
              progressUpdate,
              hasClientMessages,
            };
          })
        );

        rows.sort((a, b) => {
          if (a.hasClientMessages !== b.hasClientMessages) {
            return a.hasClientMessages ? -1 : 1;
          }
          return a.displayName.localeCompare(b.displayName);
        });

        setCases(rows);
      } catch (err) {
        console.error("Failed to load client cases", err);
        setCases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCasesAndMessages();
  }, []);

  const stats = useMemo(() => {
    const needsReply = cases.filter((item) => item.hasClientMessages).length;
    const quoteCases = cases.filter((item) => item.requestType === "quote").length;
    const claimCases = cases.filter((item) => item.requestType === "claim").length;

    return {
      total: cases.length,
      needsReply,
      quoteCases,
      claimCases,
    };
  }, [cases]);

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
                    Sparkle Legacy • Client Cases
                  </div>

                  <h1 className="max-w-[13ch]">
                    Manage insurance cases, inquiries, and follow-up.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    This page is the working list for Sparkle Legacy client
                    servicing. Use it to track quote requests, claims support,
                    policy servicing matters, renewals, and client replies.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      href="/admin/project/create-project"
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Plus size={18} />
                      New Client Case
                    </Link>

                    <Link
                      href="/admin/dashboard/clients"
                      prefetch={false}
                      className="btn btn-outline"
                    >
                      <MessageSquareMore size={18} />
                      Open Client Conversations
                    </Link>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Case overview
                  </div>

                  <h2 className="mt-2 text-2xl">Current status</h2>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <StatCard label="Total Cases" value={String(stats.total)} />
                    <StatCard label="Needs Reply" value={String(stats.needsReply)} />
                    <StatCard label="Quote Cases" value={String(stats.quoteCases)} />
                    <StatCard label="Claim Cases" value={String(stats.claimCases)} />
                  </div>

                  <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Message rule
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      A case is marked as having new client messages when a
                      recent sender is not <b>{ADMIN_SENDER}</b>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-8">
              <div className="mb-4">
                <div className="eyebrow">
                  <UserRound size={15} />
                  Client case list
                </div>
                <h2 className="mt-2 text-2xl">Active servicing records</h2>
              </div>

              {cases.length === 0 ? (
                <div className="frame-gold p-8 text-center">
                  <h3 className="text-2xl">No client cases yet</h3>
                  <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-7 text-[var(--text-secondary)]">
                    Create your first client case to begin tracking quotes,
                    claims, servicing work, and ongoing client support.
                  </p>

                  <div className="mt-5 flex justify-center">
                    <Link
                      href="/admin/project/create-project"
                      prefetch={false}
                      className="btn btn-primary"
                    >
                      <Plus size={18} />
                      Create Client Case
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {cases.map((item) => (
                    <article key={item.id} className="card-outline-gold">
                      <div className="card-inner md:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl">{item.displayName}</h3>

                              {item.hasClientMessages ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                                  <BadgeCheck size={14} />
                                  New Messages
                                </span>
                              ) : (
                                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                                  No New Messages
                                </span>
                              )}

                              {item.status ? (
                                <span className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)]">
                                  {niceLabel(item.status)}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
                              {item.clientEmail ? (
                                <span className="inline-flex items-center gap-2">
                                  <Mail size={14} />
                                  {item.clientEmail}
                                </span>
                              ) : null}

                              {item.clientPhone ? (
                                <span className="inline-flex items-center gap-2">
                                  <Phone size={14} />
                                  {item.clientPhone}
                                </span>
                              ) : null}

                              {item.cityTown ? (
                                <span className="inline-flex items-center gap-2">
                                  <MapPin size={14} />
                                  {item.cityTown}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.requestType ? (
                                <span className="badge">
                                  {niceLabel(item.requestType)}
                                </span>
                              ) : null}

                              {item.coverType ? (
                                <span className="badge">
                                  {niceLabel(item.coverType)}
                                </span>
                              ) : null}

                              {item.productInterest ? (
                                <span className="badge">
                                  {item.productInterest}
                                </span>
                              ) : null}
                            </div>

                            {item.progressUpdate ? (
                              <p className="mt-4 max-w-[70ch] text-sm leading-7 text-[var(--text-secondary)] line-clamp-2">
                                {item.progressUpdate}
                              </p>
                            ) : (
                              <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
                                No progress update added yet.
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Link
                              href={`/admin/project/${item.id}/edit`}
                              prefetch={false}
                              className="btn btn-outline"
                            >
                              <Pencil size={16} />
                              Edit
                            </Link>

                            <Link
                              href={`/admin/project/${item.id}`}
                              prefetch={false}
                              className="btn btn-ghost"
                            >
                              <Eye size={16} />
                              View
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> use this
              page as the insurance servicing triage view. Cases with new client
              messages or urgent claim activity should usually be handled first.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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