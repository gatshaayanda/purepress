"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { firebaseApp } from "@/utils/firebaseConfig";

const LOCAL_KEY = "boardsignal-founder-beta-alerts-v1";

async function messagingClient() {
  const messaging = await import("firebase/messaging");
  if (!(await messaging.isSupported())) return null;
  return { ...messaging, instance: messaging.getMessaging(firebaseApp) };
}

export default function FounderBetaRequestAlerts() {
  const configured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { setPermission("unsupported"); return; }
    setPermission(Notification.permission);
    setEnabled(window.localStorage.getItem(LOCAL_KEY) === "enabled" && Notification.permission === "granted");
  }, []);

  async function enable() {
    if (!configured) { setError("Add BoardSignal's public Web Push key before enabling Founder request alerts."); return; }
    setBusy(true); setError("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return;
      const client = await messagingClient();
      if (!client) throw new Error("This browser does not support BoardSignal browser alerts.");
      const registration = await navigator.serviceWorker.ready;
      const fcmToken = await client.getToken(client.instance, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!, serviceWorkerRegistration: registration });
      if (!fcmToken) throw new Error("This browser did not return a push registration token.");
      const response = await fetch("/api/admin/boardsignal/beta-access", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ action: "registerFounderPush", fcmToken, userAgent: navigator.userAgent }) });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Founder request alerts could not be enabled.");
      window.localStorage.setItem(LOCAL_KEY, "enabled");
      setEnabled(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Founder request alerts could not be enabled."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError("");
    try {
      const client = await messagingClient();
      let fcmToken = "";
      if (client) fcmToken = await client.getToken(client.instance).catch(() => "");
      await fetch("/api/admin/boardsignal/beta-access", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ action: "unregisterFounderPush", fcmToken }) }).catch(() => undefined);
      if (client) await client.deleteToken(client.instance).catch(() => false);
      window.localStorage.removeItem(LOCAL_KEY);
      setEnabled(false);
    } finally { setBusy(false); }
  }

  return <section className="founder-beta-alerts bs-surface-paper">
    {enabled ? <Bell size={18}/> : <BellOff size={18}/>}<div><span>FOUNDER REQUEST ALERTS</span><strong>{enabled ? "Enabled on this browser" : configured ? "Available" : "Configuration required"}</strong><p>New requests can alert this founder device and deep-link straight to the exact request. This never changes /admin authentication.</p>{error ? <p className="form-error" role="alert">{error}</p> : null}</div>
    {permission === "denied" ? <span className="state-pill">BLOCKED BY BROWSER</span> : permission === "unsupported" ? <span className="state-pill">UNSUPPORTED</span> : enabled ? <button className="button button-quiet" type="button" disabled={busy} onClick={disable}>{busy ? <LoaderCircle className="button-spinner" size={14}/> : null} Disable alerts</button> : <button className="button button-outline" type="button" disabled={busy || !configured} onClick={enable}>{busy ? <LoaderCircle className="button-spinner" size={14}/> : <Bell size={14}/>} Enable founder request alerts</button>}
  </section>;
}
