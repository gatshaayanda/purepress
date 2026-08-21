"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { browserLocalPersistence, setPersistence, signInWithCustomToken, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { auth } from "@/utils/firebaseConfig";
import { credentialMatchesExpectedUid } from "@/lib/boardsignal/playerEntryRecovery.mjs";

function stripMagicFragment() {
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  const currentState = window.history.state;
  try {
    History.prototype.replaceState.call(window.history, currentState, "", cleanUrl);
  } catch {
    window.history.replaceState(currentState, "", cleanUrl);
  }
}

export default function MagicBetaAccess() {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Opening your private BoardSignal…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const ticket = params.get("ticket") ?? "";
    if (ticket) stripMagicFragment();
    if (!ticket) {
      setState("error");
      setMessage("This private access link is missing its one-time ticket.");
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/auth/beta-access/magic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ ticket }),
        });
        const body = await response.json() as { ok?: boolean; customToken?: string; uid?: string; playerId?: number; error?: string };
        if (!response.ok || !body.ok || !body.customToken || !body.uid) throw new Error(body.error ?? "This private access link could not be used.");
        await setPersistence(auth, browserLocalPersistence);
        const credential = await signInWithCustomToken(auth, body.customToken);
        if (!credentialMatchesExpectedUid(body.uid, credential.user.uid)) {
          await signOut(auth).catch(() => undefined);
          throw new Error("BoardSignal stopped an identity mismatch while opening this private account.");
        }
        router.replace("/boardsignal/player-room?source=beta_magic&tab=desk");
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "This private access link could not be used.");
      }
    })();
  }, [router]);

  if (state === "loading") return <main id="main" className="container beta-preview-room"><section className="beta-preview-loading bs-surface-paper"><LoaderCircle className="button-spinner"/><p className="kicker">PRIVATE ACCESS</p><h1>Opening My BoardSignal</h1><p>{message}</p></section></main>;

  return <main id="main" className="container beta-preview-room"><section className="beta-preview-loading bs-surface-paper"><ShieldCheck/><p className="kicker">PRIVATE ACCESS</p><h1>This link could not be opened</h1><p>{message}</p><div className="resolved-player-actions"><Link href="/boardsignal/player-room" className="button button-dark">Use private access / recovery</Link><Link href="/" className="button button-quiet">Return to BoardSignal</Link></div></section></main>;
}
