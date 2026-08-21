"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  LogOut,
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
  status?: string;
  progress_update?: string;
  required_documents?: string;
  documentUrl?: string;
  documentName?: string;
  portal_access?: boolean;
  admin_panel?: boolean;
};

type CachedDashboard = {
  cases: ClientCase[];
  messageCounts: Record<string, number>;
  cachedAt: string;
};

const CACHE_PREFIX = "sparkle_client_dashboard_cache_v1";

function cacheKey(email: string) {
  return `${CACHE_PREFIX}_${email.toLowerCase().trim()}`;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readCachedDashboard(email: string): CachedDashboard | null {
  if (typeof window === "undefined") return null;

  try {
    return safeJsonParse<CachedDashboard>(localStorage.getItem(cacheKey(email)));
  } catch {
    return null;
  }
}

function saveCachedDashboard(email: string, data: Omit<CachedDashboard, "cachedAt">) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      cacheKey(email),
      JSON.stringify({
        ...data,
        cachedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Could not save client dashboard cache:", error);
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

function canShowInPortal(item: ClientCase) {
  return item.portal_access === true || item.admin_panel === true;
}

export default function ClientDashboard() {
  const router = useRouter();

  const [cases, setCases] = useState<ClientCase[]>([]);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});
  const [clientEmail, setClientEmail] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
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

  async function loadFromNetwork(email: string, hasCachedData: boolean) {
    setError("");

    if (hasCachedData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const q = query(
        collection(firestore, "projects"),
        where("client_email", "==", email)
      );

      const snap = await getDocs(q);

      const rows = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientCase, "id">),
        }))
        .filter(canShowInPortal);

      const counts: Record<string, number> = {};

      await Promise.all(
        rows.map(async (item) => {
          const messagesCol = collection(
            firestore,
            "projects",
            item.id,
            "messages"
          );

          const countSnap = await getCountFromServer(messagesCol);
          counts[item.id] = countSnap.data().count || 0;
        })
      );

      setCases(rows);
      setMessageCounts(counts);

      const savedAt = new Date().toISOString();
      setCachedAt(savedAt);

      saveCachedDashboard(email, {
        cases: rows,
        messageCounts: counts,
      });
    } catch (err) {
      console.error("Client dashboard load failed:", err);

      const cached = readCachedDashboard(email);

      if (cached) {
        setCases(cached.cases || []);
        setMessageCounts(cached.messageCounts || {});
        setCachedAt(cached.cachedAt || "");
        setError("");
      } else {
        setError("Could not load your client portal records.");
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

    const cached = readCachedDashboard(email);
    const hasCachedData = !!cached;

    if (cached) {
      setCases(cached.cases || []);
      setMessageCounts(cached.messageCounts || {});
      setCachedAt(cached.cachedAt || "");
      setLoading(false);
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    loadFromNetwork(email, hasCachedData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, online]);

  const stats = useMemo(() => {
    return {
      total: cases.length,
      open: cases.filter((item) => item.status !== "closed").length,
      withMessages: cases.filter((item) => (messageCounts[item.id] || 0) > 0)
        .length,
    };
  }, [cases, messageCounts]);

  const handleLogout = () => {
    document.cookie = "role=; path=/; max-age=0;";
    router.replace("/client/login");
  };

  const handleRefresh = () => {
    if (!clientEmail || !online) return;
    loadFromNetwork(clientEmail, cases.length > 0);
  };

  if (loading) return <AdminHubLoader />;

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <section className="section-shell">
          <div className="container">
            <div className="frame-gold mx-auto max-w-2xl p-8 text-center">
              <h1 className="text-2xl">Unable to load portal</h1>
              <p className="mt-3 text-sm leading-7 text-red-700">{error}</p>

              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-outline mt-5"
              >
                Return to Login
              </button>
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
          <div className="mx-auto max-w-6xl">
            {!online ? (
              <div className="mb-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                <div className="flex items-start gap-2">
                  <WifiOff size={17} className="mt-1 shrink-0" />
                  <p>
                    You are offline. This dashboard is showing saved portal data
                    from this device. Messages, new files, and case updates will
                    refresh when you are online again.
                  </p>
                </div>
              </div>
            ) : cachedAt ? (
              <div className="mb-5 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm leading-7 text-green-700">
                <div className="flex items-start gap-2">
                  <Wifi size={17} className="mt-1 shrink-0" />
                  <p>
                    Online. Portal data was last saved on{" "}
                    <b>{formatCachedAt(cachedAt)}</b>.
                    {refreshing ? " Refreshing latest updates…" : ""}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="eyebrow mb-2">
                  <ShieldCheck size={15} />
                  Sparkle Legacy • Client Portal
                </div>
                <h1 className="max-w-[14ch]">Your insurance support cases.</h1>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={!online || refreshing}
                  className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    size={18}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>

                <button
                  onClick={handleLogout}
                  className="btn btn-outline"
                  type="button"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <UserRound size={15} />
                    Logged in client
                  </div>

                  <h2 className="text-2xl">Welcome back.</h2>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    This portal lets you view your active Sparkle Legacy
                    insurance cases, track updates, open attached documents, and
                    continue secure communication with the team.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <InfoMini
                      label="Email"
                      value={clientEmail}
                      icon={<Mail size={15} />}
                    />
                    <InfoMini
                      label="Cases"
                      value={String(stats.total)}
                      icon={<FileText size={15} />}
                    />
                    <InfoMini
                      label="Messages"
                      value={String(stats.withMessages)}
                      icon={<MessageCircle size={15} />}
                    />
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <BadgeCheck size={15} />
                    Portal status
                  </div>

                  <h2 className="mt-2 text-2xl">At a glance</h2>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <StatCard label="Total" value={String(stats.total)} />
                    <StatCard label="Open" value={String(stats.open)} />
                    <StatCard label="Chats" value={String(stats.withMessages)} />
                  </div>

                  <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Need urgent help?
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      For urgent claim or quote support, use WhatsApp or call
                      Sparkle Legacy directly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {cases.length === 0 ? (
              <div className="mt-8 frame-gold p-8 text-center">
                <h2 className="text-2xl">
                  {online ? "No active portal cases yet" : "No saved cases available offline"}
                </h2>
                <p className="mx-auto mt-3 max-w-[56ch] text-sm leading-7 text-[var(--text-secondary)]">
                  {online
                    ? "Your account is active, but no client cases have been assigned to this email yet. Sparkle Legacy will notify you once a case is ready for portal access."
                    : "This device does not have saved portal case data yet. Go online once, open your dashboard, and the PWA will save your latest visible case records for offline viewing."}
                </p>
              </div>
            ) : (
              <section className="mt-8 grid gap-4">
                {cases.map((item) => {
                  const count = messageCounts[item.id] || 0;

                  return (
                    <article key={item.id} className="card-outline-gold">
                      <div className="card-inner md:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-xl">{getCaseTitle(item)}</h2>

                              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                                {niceLabel(item.status)}
                              </span>

                              {count > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                                  <MessageCircle size={13} />
                                  Conversation available
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                              <CaseMini
                                label="Request"
                                value={niceLabel(item.request_type)}
                              />
                              <CaseMini
                                label="Cover"
                                value={niceLabel(item.cover_type)}
                              />
                              <CaseMini
                                label="Product"
                                value={item.product_interest || "—"}
                              />
                            </div>

                            {item.progress_update ? (
                              <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                                <p className="text-sm font-extrabold text-[var(--text-primary)]">
                                  Latest update
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                                  {item.progress_update}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
                                No progress update has been added yet.
                              </p>
                            )}

                            {item.required_documents ? (
                              <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                                <p className="text-sm font-extrabold text-[var(--text-primary)]">
                                  Documents requested
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                                  {item.required_documents}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                            <Link
                              href={`/client/project/${item.id}`}
                              className="btn btn-primary"
                              prefetch={false}
                            >
                              Open Case
                              <ArrowRight size={18} />
                            </Link>

                            {item.documentUrl ? (
                              <a
                                href={item.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline"
                              >
                                <FileText size={18} />
                                Open File
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Note:</b> Portal access
              is limited to cases assigned to your email by Sparkle Legacy. If a
              case is missing, contact the team using your usual support channel.
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

function InfoMini({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
      <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function CaseMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-white/80 px-4 py-3">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}