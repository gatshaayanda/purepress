"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { ArrowRight, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import FoundingBetaAccessPanel from "@/components/FoundingBetaAccessPanel";
import { auth } from "@/utils/firebaseConfig";

type ProviderStatus = {
  enabled: boolean;
  message: string;
  devIdentityEnabled: boolean;
};

export default function ChessComLoginPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/chesscom/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: ProviderStatus) => setStatus(value))
      .catch(() => setStatus({ enabled: false, devIdentityEnabled: false, message: "Chess.com sign-in status is temporarily unavailable." }));
  }, []);

  async function developmentSignIn() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/chesscom/dev", { method: "POST" });
      const body = await response.json() as { ok: boolean; customToken?: string; error?: string };
      if (!response.ok || !body.ok || !body.customToken) throw new Error(body.error ?? "Development identity could not sign in.");
      await signInWithCustomToken(auth, body.customToken);
      router.push("/boardsignal/player-room");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Development identity could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`chesscom-login-panel ${compact ? "is-compact" : ""}`}>
      <div className="chesscom-login-icon"><LockKeyhole size={20} /></div>
      <div className="chesscom-login-copy">
        <span>{status?.enabled ? "CHESS.COM ACCOUNT ACCESS" : "FOUNDING ACCESS"}</span>
        <h2>Keep your latest four reviews together.</h2>
        <p>{status?.enabled ? status.message : "Official Chess.com sign-in is awaiting approval. Founding Access players can open My BoardSignal securely now."}</p>
        <small><ShieldCheck size={14} /> BoardSignal never asks for or stores your Chess.com password.</small>
      </div>
      <div className="chesscom-login-actions">
        {status?.enabled ? (
          <a className="button button-outline" href="/api/auth/chesscom/start">Continue with Chess.com <ArrowRight size={16} /></a>
        ) : null}
        <FoundingBetaAccessPanel oauthAvailable={status?.enabled === true} />
        {status?.devIdentityEnabled ? (
          <button className="button button-quiet" type="button" onClick={developmentSignIn} disabled={busy}>
            {busy ? <><LoaderCircle className="button-spinner" size={15} /> Signing in</> : "Use controlled development identity"}
          </button>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}
