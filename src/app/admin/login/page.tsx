"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./PurePressOwnerLogin.module.css";

export default function PurePressOwnerLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!online) {
      setError("Owner sign in needs an internet connection so PurePress can verify access securely.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Sign in failed" }));
        throw new Error(body.error || "Sign in failed");
      }
      router.replace("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PurePress could not complete owner sign in.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="purepress-owner-signin-heading">
        <div className={styles.brandBar}>
          <div className={styles.mark} aria-hidden="true"><i /><i /><i /></div>
          <div><strong>PUREPRESS STUDIO</strong><span>Your Vision, Fully Printed</span></div>
        </div>

        <div className={styles.layout}>
          <section className={styles.intro}>
            <p className={styles.kicker}>OWNER SIGN IN</p>
            <h1 id="purepress-owner-signin-heading">Secure access to the PurePress production desk.</h1>
            <p>Open the Studio to manage customer jobs, quotations, artwork readiness and the next operational action.</p>
            <div className={styles.signalGrid} aria-hidden="true"><span>QUOTE</span><span>ARTWORK</span><span>PRODUCTION</span></div>
            <Link href="/" className={styles.homeLink}>← Back to PurePress</Link>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeading}><span>PUREPRESS STUDIO</span><h2>Owner sign in</h2><p>Use the existing protected owner password to continue.</p></div>
            {!online && <p className={styles.offline} role="status">You are offline. Owner sign in is available again when the server can verify access.</p>}
            <form onSubmit={handleSubmit} className={styles.form}>
              <label htmlFor="purepress-owner-password">Owner password</label>
              <input
                id="purepress-owner-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={loading || !online}
              />
              <button type="submit" disabled={loading || !online}>{loading ? "SIGNING IN…" : "OPEN PUREPRESS STUDIO"}</button>
              {error && <p className={styles.error} role="alert">{error}</p>}
            </form>
            <p className={styles.securityNote}>Access is verified by the existing protected PurePress admin session. Studio actions remain server-authorized.</p>
          </section>
        </div>
      </section>
    </main>
  );
}
