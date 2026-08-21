"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { AlertTriangle, LoaderCircle, ShieldCheck } from "lucide-react";
import { auth } from "@/utils/firebaseConfig";

export default function AuthCompletionClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const ticket = params.get("ticket");
    if (!ticket || params.get("error")) {
      setError("Chess.com account sign-in could not be completed. No BoardSignal account was opened.");
      return;
    }
    let active = true;
    fetch("/api/auth/chesscom/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    })
      .then(async (response) => {
        const body = await response.json() as { ok: boolean; customToken?: string; error?: string };
        if (!response.ok || !body.ok || !body.customToken) throw new Error(body.error ?? "Sign-in could not be completed.");
        return signInWithCustomToken(auth, body.customToken);
      })
      .then(() => {
        if (active) router.replace("/boardsignal/player-room");
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Sign-in could not be completed.");
      });
    return () => { active = false; };
  }, [params, router]);

  return (
    <div id="main" className="desk-processing-page">
      <section className={`container desk-processing-card ${error ? "error-card" : ""}`}>
        {error ? <AlertTriangle /> : <div className="processing-orb"><LoaderCircle /></div>}
        <p className="kicker">Verified Player Room</p>
        <h1>{error ? "Sign-in stopped safely" : "Opening your Player Room"}</h1>
        <p>{error || "Your verified Chess.com identity is being connected to your private BoardSignal account."}</p>
        {error ? <a href="/boardsignal/player-room" className="button button-outline">Return to Player Room</a> : <p className="username-privacy"><ShieldCheck size={14} /> The completion ticket works once and expires quickly.</p>}
      </section>
    </div>
  );
}
