"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getCountFromServer,
} from "firebase/firestore";
import {
  BookOpen,
  Database,
  FileText,
  FolderKanban,
  HardDrive,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";

const LOCAL_APP_KEYS = [
  "sparkle_chat_history_v1",
  "sparkle_chat_lead_v1",
  "sparkle_blog_cache_v1",
  "sparkle_blog_post_cache_v1",
  "sparkle_home_cache_v1",
  "sparkle_claims_cache_v1",
  "sparkle_category_cache_v1",
  "sparkle_contact_cache_v1",
];

type DashboardStats = {
  insights: string;
  highlights: string;
  products: string;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [online, setOnline] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    insights: "—",
    highlights: "—",
    products: "—",
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState("");

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);

    updateStatus();

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadStats() {
      try {
        setStatsLoading(true);

        const [blogsSnap, highlightsSnap, productsSnap] = await Promise.all([
          getCountFromServer(collection(firestore, "blogs")),
          getCountFromServer(collection(firestore, "highlights")),
          getCountFromServer(collection(firestore, "insurance_products")),
        ]);

        if (!alive) return;

        setStats({
          insights: String(blogsSnap.data().count || 0),
          highlights: String(highlightsSnap.data().count || 0),
          products: String(productsSnap.data().count || 0),
        });
      } catch (error) {
        console.error("Failed to load admin dashboard stats:", error);

        if (!alive) return;

        setStats({
          insights: "—",
          highlights: "—",
          products: "—",
        });
      } finally {
        if (alive) setStatsLoading(false);
      }
    }

    loadStats();

    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
  };

  const handleClearAppStorage = async () => {
    const ok = window.confirm(
      "Clear local PWA cache and saved browser data for this app? This will not delete Firestore records."
    );

    if (!ok) return;

    setClearingCache(true);
    setCacheMessage("");

    try {
      if (typeof caches !== "undefined") {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      try {
        LOCAL_APP_KEYS.forEach((key) => localStorage.removeItem(key));
      } catch {}

      setCacheMessage(
        "Local app cache cleared. Refresh the app to rebuild the latest cached version."
      );
    } catch (error) {
      console.error("Failed to clear app storage:", error);
      setCacheMessage("Could not clear all local app cache. Please try again.");
    } finally {
      setClearingCache(false);
    }
  };

  const sections = [
    {
      title: "Projects",
      desc: "Manage client projects, update intake details, review progress, and handle project-linked communication.",
      icon: <FolderKanban size={22} />,
      href: "/admin/project",
    },
    {
      title: "Manage Insights",
      desc: "Create, edit, and publish blog articles and shareable insurance education content.",
      icon: <BookOpen size={22} />,
      href: "/admin/blog",
    },
    {
      title: "Manage Highlights",
      desc: "Update homepage highlights, featured messages, and visual homepage content.",
      icon: <ImageIcon size={22} />,
      href: "/admin/dashboard/highlights",
    },
    {
      title: "Manage Insurance Products",
      desc: "Organize short-term, long-term, SME, retirement, and related cover content.",
      icon: <FolderKanban size={22} />,
      href: "/admin/dashboard/products",
    },
    {
      title: "Manage Claims Content",
      desc: "Maintain claims guidance, required document info, and support content.",
      icon: <FileText size={22} />,
      href: "/admin/dashboard/claims",
    },
    {
      title: "Manage Client Access",
      desc: "Review client-facing access flows, secure portal visibility, and support paths.",
      icon: <Users size={22} />,
      href: "/admin/dashboard/clients",
    },
  ];

  const statCards = [
    ["Insights", stats.insights],
    ["Highlights", stats.highlights],
    ["Products", stats.products],
  ];

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          {!online ? (
            <div className="mb-6 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
              <div className="flex items-start gap-2">
                <WifiOff size={17} className="mt-1 shrink-0" />
                <p>
                  You are offline. Admin data may not refresh until the
                  connection returns. Public cached pages can still work through
                  the PWA cache.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm leading-7 text-green-700">
              <div className="flex items-start gap-2">
                <Wifi size={17} className="mt-1 shrink-0" />
                <p>Online. Admin content and dashboard data can refresh normally.</p>
              </div>
            </div>
          )}

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="eyebrow">
                <ShieldCheck size={15} />
                Sparkle Legacy • Admin
              </div>

              <h1 className="mt-3 flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--brand-tint)] text-[var(--brand-primary-strong)]">
                  <LayoutDashboard size={22} />
                </span>
                Admin Dashboard
              </h1>

              <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                Manage the public experience, insurance insights, content
                updates, and operational areas that support Sparkle Legacy’s
                digital platform.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-outline self-start"
              >
                <RefreshCw size={18} />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-outline self-start"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
              <button
                key={section.title}
                type="button"
                onClick={() => router.push(section.href)}
                className="card-outline-gold h-full text-left transition hover:-translate-y-[2px]"
              >
                <div className="card-inner md:p-6">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--brand-tint)] text-[var(--brand-primary-strong)]">
                      {section.icon}
                    </span>

                    <div>
                      <h2 className="text-xl">{section.title}</h2>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        {section.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <section className="mt-10">
            <div className="mb-4">
              <div className="eyebrow">
                <LayoutDashboard size={15} />
                Quick overview
              </div>
              <h2 className="mt-2 text-2xl">Dashboard summary</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {statCards.map(([label, value]) => (
                <div key={label} className="card">
                  <div className="card-inner text-center md:p-6">
                    <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {label}
                    </div>
                    <div className="mt-3 text-3xl font-extrabold text-[var(--text-primary)]">
                      {statsLoading ? "…" : value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="card-outline-gold">
              <div className="card-inner md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="eyebrow mb-0">
                      <HardDrive size={15} />
                      PWA storage control
                    </div>

                    <h2 className="mt-2 text-2xl">Clear local app cache</h2>

                    <p className="mt-3 max-w-[70ch] text-sm leading-7 text-[var(--text-secondary)]">
                      Use this when the installed app is showing old cached
                      content or after major design/content changes. This clears
                      browser-side PWA cache and saved local app helper data. It
                      does not delete Firestore records, blog posts, client
                      cases, products, or uploaded files.
                    </p>

                    {cacheMessage ? (
                      <div className="mt-4 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-7 text-[var(--text-secondary)]">
                        {cacheMessage}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={handleClearAppStorage}
                      disabled={clearingCache}
                      className="btn btn-outline"
                    >
                      {clearingCache ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                      {clearingCache ? "Clearing..." : "Clear App Cache"}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/")}
                      className="btn btn-ghost"
                    >
                      <Database size={18} />
                      View Public Site
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
            <b className="text-[var(--text-primary)]">Admin note:</b> this
            dashboard is intended for Sparkle Legacy internal management only.
            Use it to keep the site current, helpful, and aligned with the
            public-facing insurance experience.
          </div>
        </div>
      </section>
    </main>
  );
}