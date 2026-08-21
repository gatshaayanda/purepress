"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserLocalPersistence, setPersistence, signInWithCustomToken } from "firebase/auth";
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { auth } from "@/utils/firebaseConfig";

export default function FoundingBetaAccessPanel({ oauthAvailable = false }: { oauthAvailable?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !accessCode.trim()) {
      setError("Enter your Chess.com username and private access code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/beta-access/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ username: username.trim(), accessCode: accessCode.trim() }),
      });
      const body = await response.json() as { ok: boolean; customToken?: string; error?: string };
      if (!response.ok || !body.ok || !body.customToken) throw new Error(body.error ?? "Founding Access could not be completed.");
      await setPersistence(auth, browserLocalPersistence);
      await signInWithCustomToken(auth, body.customToken);
      setAccessCode("");
      router.replace("/boardsignal/player-room");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Founding Access could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="beta-access-form" onSubmit={signIn}>
      <div className="beta-access-heading">
        <KeyRound size={18} />
        <div><span>FOUNDING ACCESS</span><strong>{oauthAvailable ? "Use your privately issued access." : "Enter your private Player Room."}</strong></div>
      </div>
      <label htmlFor="beta-chess-username">Chess.com username</label>
      <input
        id="beta-chess-username"
        name="username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        spellCheck={false}
        maxLength={50}
        required
      />
      <label htmlFor="beta-access-code">Private access code</label>
      <input
        id="beta-access-code"
        name="accessCode"
        type="password"
        value={accessCode}
        onChange={(event) => setAccessCode(event.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="current-password"
        spellCheck={false}
        maxLength={80}
        required
      />
      <button className="button button-lime" type="submit" disabled={busy}>
        {busy ? <><LoaderCircle className="button-spinner" size={16} /> Opening Player Room</> : <>Enter My Player Room <ArrowRight size={16} /></>}
      </button>
      <p className="beta-access-safety"><ShieldCheck size={14} /> Your access code was issued privately by BoardSignal. It does not use or expose your Chess.com password.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
