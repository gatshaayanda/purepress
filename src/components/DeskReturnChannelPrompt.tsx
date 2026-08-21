"use client";

import { useEffect, useState } from "react";
import { Bell, LoaderCircle } from "lucide-react";
import { registerBoardSignalBrowserPush } from "@/components/BrowserPushControl";

const DISMISS_PREFIX = "boardsignal-desk-alert-prompt-v1:";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export default function DeskReturnChannelPrompt({ uid, idToken, browserPushEnabled, emailActive, onEnabled }: { uid: string; idToken: string; browserPushEnabled: boolean; emailActive: boolean; onEnabled?: () => void | Promise<void> }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim());
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured || browserPushEnabled || !("Notification" in window) || Notification.permission !== "default") { setVisible(false); return; }
    const stored = Number(window.localStorage.getItem(`${DISMISS_PREFIX}${uid}`) ?? "0");
    setVisible(!stored || Date.now() - stored > DISMISS_MS);
  }, [browserPushEnabled, configured, uid]);

  async function enable() {
    setBusy(true); setError("");
    try {
      // Browser permission is requested only after this explicit TURN ON ALERTS click.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setVisible(false); return; }
      await registerBoardSignalBrowserPush(idToken);
      setVisible(false);
      await onEnabled?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Browser alerts could not be enabled."); }
    finally { setBusy(false); }
  }

  function dismiss() {
    window.localStorage.setItem(`${DISMISS_PREFIX}${uid}`, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;
  return <section className="desk-return-channel-prompt bs-surface-dark"><Bell size={21}/><div><p className="kicker">NEVER MISS YOUR NEXT REVIEW</p><h2>Your next seven-day Review will land here automatically.</h2><p>{emailActive ? "Email updates are on. You can also get a browser alert when your next Review is ready." : "Want BoardSignal to tell you when your next Review is ready?"}</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<div><button className="button button-lime" type="button" disabled={busy} onClick={enable}>{busy ? <><LoaderCircle className="button-spinner" size={15}/> Turning on</> : "Turn on alerts"}</button><button className="button button-quiet" type="button" disabled={busy} onClick={dismiss}>Not now</button></div></div></section>;
}
