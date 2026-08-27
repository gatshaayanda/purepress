"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import {
  completePurePressCustomerSignIn,
  isPurePressCustomerSignInLink,
  pendingPurePressSignInEmail,
  sendPurePressCustomerSignInLink,
} from "@/lib/purepress/auth/client";
import styles from "./PurePressCustomerPortal.module.css";

type LoginMode = "email" | "sent" | "cross-device" | "opening";

export default function PurePressCustomerLogin() {
  const router = useRouter();
  const startedCompletion = useRef(false);
  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || startedCompletion.current) return;
    const href = window.location.href;
    if (!isPurePressCustomerSignInLink(href)) {
      if (auth.currentUser) router.replace("/my-purepress");
      return;
    }
    startedCompletion.current = true;
    const pending = pendingPurePressSignInEmail();
    if (!pending) {
      setMode("cross-device");
      return;
    }
    setMode("opening");
    void completePurePressCustomerSignIn(pending, href)
      .then(() => router.replace("/my-purepress"))
      .catch(() => {
        setError("This sign-in link could not be completed. Enter the email you used with PurePress.");
        setEmail(pending);
        setMode("cross-device");
      });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "cross-device") {
        await completePurePressCustomerSignIn(email, window.location.href);
        router.replace("/my-purepress");
        return;
      }
      await sendPurePressCustomerSignInLink(email, `${window.location.origin}/my-purepress/login`);
      setSentEmail(email.trim());
      setMode("sent");
    } catch {
      setError(mode === "cross-device"
        ? "We couldn’t finish sign-in with that email. Check the address and try again."
        : "We couldn’t send your secure sign-in link. Check the email address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.portalPage}>
      <section className={styles.loginCard} aria-labelledby="my-purepress-title">
        <Image src="/purepress/brand/purepress-mark.svg" alt="PurePress Printers" width={96} height={80} priority />
        <p className={styles.kicker}>PUREPRESS PRINTERS</p>
        <h1 id="my-purepress-title">MY PUREPRESS</h1>

        {mode === "opening" ? (
          <div className={styles.focusMessage} role="status">
            <h2>OPENING MY PUREPRESS…</h2>
            <p>We’re securely opening your orders.</p>
          </div>
        ) : mode === "sent" ? (
          <div className={styles.focusMessage} role="status">
            <h2>CHECK YOUR EMAIL</h2>
            <p>We sent a secure My PurePress link to <strong>{sentEmail}</strong>.</p>
            <p className={styles.primaryGuidance}>Open that email and tap the link.</p>
            <button className={styles.secondaryButton} type="button" onClick={() => { setMode("email"); setError(""); }}>
              USE A DIFFERENT EMAIL
            </button>
          </div>
        ) : (
          <>
            <p className={styles.introCopy}>
              {mode === "cross-device" ? "Enter the email you used with PurePress." : "Enter the email address for your PurePress order."}
            </p>
            <form className={styles.loginForm} onSubmit={submit}>
              <label htmlFor="purepress-customer-email">Email address</label>
              <input
                id="purepress-customer-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button className={styles.primaryButton} disabled={busy} type="submit">
                {busy ? "WORKING…" : mode === "cross-device" ? "OPEN MY PUREPRESS" : "EMAIL ME A SECURE SIGN-IN LINK"}
              </button>
            </form>
          </>
        )}

        {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
        <p className={styles.loginFootnote}>Need a new order? <Link href="/request-a-quote">REQUEST A QUOTE</Link></p>
      </section>
    </main>
  );
}
