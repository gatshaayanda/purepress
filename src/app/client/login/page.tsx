"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Lock,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

const WHATSAPP_NUMBER = "+26772971852";

function waLink(message: string) {
  const digits = WHATSAPP_NUMBER.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function ClientLoginPage() {
  const router = useRouter();

  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!online) {
      setError(
        "Client login needs an internet connection. Public pages may still open offline, but your client dashboard must be verified online."
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });

      if (res.ok) {
        const { email } = await res.json();

        document.cookie = `role=${encodeURIComponent(
          email
        )}; path=/; max-age=${60 * 60 * 24}`;

        router.push("/client/dashboard");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Login failed");
      setPw("");
    } catch {
      setError(
        "Something went wrong. Please check your connection and try again."
      );
      setPw("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5">
              <Link
                href="/"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Home
              </Link>
            </div>

            {!online ? (
              <div className="mb-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                <div className="flex items-start gap-2">
                  <WifiOff size={17} className="mt-1 shrink-0" />
                  <p>
                    You are offline. Public PWA pages may still load from saved
                    content, but client login requires internet because your
                    password and dashboard access must be verified securely.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <ShieldCheck size={15} />
                    Sparkle Legacy • Client Access
                  </div>

                  <h1 className="max-w-[12ch]">
                    Secure client login for your dashboard.
                  </h1>

                  <p className="mt-4 max-w-[60ch] text-base leading-8 text-[var(--text-secondary)]">
                    Use your access password to enter your client dashboard.
                    This area is designed for secure follow-up, case visibility,
                    document access, and direct support communication.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Private access
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Your dashboard is separated from the public site for a
                        cleaner and more secure client experience.
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Online verification
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Login only works online so Sparkle Legacy can confirm
                        the correct client account before opening dashboard
                        records.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <a
                      href={waLink(
                        "Hi Sparkle Legacy 👋 I need help accessing my client dashboard."
                      )}
                      className="btn btn-outline"
                    >
                      <MessageCircle size={18} />
                      Get Login Help on WhatsApp
                    </a>

                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${
                        online
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {online ? <Wifi size={16} /> : <WifiOff size={16} />}
                      {online ? "Online" : "Offline"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--brand-tint)] text-[var(--brand-primary-strong)]">
                    <Lock size={24} />
                  </div>

                  <div className="mt-5 text-center">
                    <div className="eyebrow justify-center">
                      <Lock size={15} />
                      Secure Sign In
                    </div>

                    <h2 className="mt-2 text-2xl">Client Login</h2>

                    <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                      Enter your secure access password to continue to your
                      dashboard.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                      <label
                        htmlFor="password"
                        className="text-sm font-semibold text-[var(--text-primary)]"
                      >
                        Password
                      </label>

                      <input
                        id="password"
                        type="password"
                        placeholder="Enter password"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        className="input mt-2"
                        required
                        autoComplete="current-password"
                        disabled={loading || !online}
                      />

                      {!online ? (
                        <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                          Login is disabled while offline.
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !online}
                      className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <LogIn size={18} />
                      )}
                      {loading
                        ? "Logging In..."
                        : online
                          ? "Login"
                          : "Offline"}
                    </button>

                    {error ? (
                      <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    ) : null}
                  </form>

                  <div className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">
                      Access note
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      Keep your login details private. Public pages may support
                      offline viewing, but your personal dashboard should only
                      open after online verification.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Note:</b> Client access
              remains subject to the current Sparkle Legacy portal setup and
              security process.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}