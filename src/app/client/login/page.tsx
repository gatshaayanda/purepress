"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  completePurePressCustomerSignIn,
  isPurePressCustomerSignInLink,
  pendingPurePressSignInEmail,
  sendPurePressCustomerSignInLink,
} from "@/lib/purepress/auth/client";

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isPurePressCustomerSignInLink(window.location.href)
    ) {
      return;
    }

    const stored = pendingPurePressSignInEmail();
    if (stored) setEmail(stored);
    setCompleting(true);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (completing) {
        await completePurePressCustomerSignIn(email, window.location.href);
        window.location.assign("/client/dashboard");
        return;
      }

      await sendPurePressCustomerSignInLink(
        email,
        `${window.location.origin}/client/login`,
      );
      setMessage("Check your email for your secure My PurePress sign-in link.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not start secure sign-in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-site">
      <section className="pp-section">
        <div className="pp-container pp-service-discovery">
          <div className="pp-material-panel">
            <p className="pp-kicker pp-kicker-on-dark">My PurePress</p>
            <h1 className="pp-client-title">Your work, with the next step clear.</h1>
            <p>
              My PurePress keeps your order, artwork approvals, updates and next
              steps together.
            </p>
            <div className="pp-thread-swatches" aria-hidden="true">
              <span className="pp-thread-chip cyan" />
              <span className="pp-thread-chip magenta" />
              <span className="pp-thread-chip yellow" />
            </div>
          </div>

          <div className="pp-studio-desk">
            <Image
              src="/purepress/brand/purepress-mark.svg"
              alt="PurePress Printers"
              width={90}
              height={75}
            />
            <p className="pp-kicker">Secure customer access</p>
            <span className="pp-stitch-line" aria-hidden="true" />
            <h2 className="pp-login-title">
              {completing ? "Finish signing in" : "Open My PurePress"}
            </h2>
            <p className="pp-login-copy">
              Enter your email and we&apos;ll send you a secure sign-in link.
            </p>

            <form onSubmit={submit} className="pp-login-form">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button
                className="pp-button pp-button-primary"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Working…"
                  : completing
                    ? "Continue to My PurePress"
                    : "Send secure sign-in link"}
              </button>
            </form>

            {message ? (
              <p role="status" className="pp-login-status">
                {message}
              </p>
            ) : null}

            <p className="pp-login-help">
              Need to start a new job instead?{" "}
              <Link href="/request-a-quote">Request a quote</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
