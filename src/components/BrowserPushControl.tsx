"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { firebaseApp } from "@/utils/firebaseConfig";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";

async function messagingClient() {
  const messaging = await import("firebase/messaging");
  if (!(await messaging.isSupported())) return null;
  return { ...messaging, instance: messaging.getMessaging(firebaseApp) };
}

export async function getBoardSignalBrowserPushToken() {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) throw new Error("Browser alerts are unavailable until BoardSignal push configuration is completed.");
  const client = await messagingClient();
  if (!client) throw new Error("Browser alerts are not supported by this browser.");
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  // Firebase Web 11 keeps the stable registration-token path used by this release.
  // Do not mix this with the newer FID registration APIs; migrate both Web/Admin together in a dedicated maintenance patch.
  const fcmToken = await client.getToken(client.instance, { vapidKey, serviceWorkerRegistration });
  if (!fcmToken) throw new Error("This browser did not return a push registration token.");
  return fcmToken;
}

export async function registerBoardSignalBrowserPush(idToken: string) {
  const fcmToken = await getBoardSignalBrowserPushToken();
  const response = await fetch("/api/boardsignal/inbox", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action: "registerPush", fcmToken, userAgent: navigator.userAgent }),
  });
  const body = await response.json() as { ok: boolean; error?: string };
  if (!response.ok || !body.ok) throw new Error(body.error ?? "Browser alerts could not be registered.");
  return fcmToken;
}

export async function removeBoardSignalBrowserPush(idToken: string) {
  if (typeof window === "undefined") return;
  try {
    const client = await messagingClient();
    if (client) await client.deleteToken(client.instance).catch(() => false);
  } finally {
    await fetch("/api/boardsignal/inbox", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "unregisterPush" }),
    }).catch(() => undefined);
  }
}

export default function BrowserPushControl({ idToken, onChanged }: { idToken: string; onChanged?: () => void | Promise<void> }) {
  const connectivity = useBoardSignalConnectivity();
  const configured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  const refreshExistingPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    if (configured && connectivity.online && Notification.permission === "granted") {
      try {
        await registerBoardSignalBrowserPush(idToken);
        setRegistered(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Browser alerts could not be refreshed.");
      }
    }
  }, [configured, connectivity.online, idToken]);

  useEffect(() => {
    // Reading an existing permission is safe. This never calls Notification.requestPermission().
    void refreshExistingPermission();
    const onVisible = () => { if (document.visibilityState === "visible" && Notification.permission === "granted") void refreshExistingPermission(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshExistingPermission]);

  async function enable() {
    if (!configured || !connectivity.online) { setError("Reconnect before changing browser alerts."); return; }
    setBusy(true);
    setError("");
    try {
      // Permission is requested only after this explicit user click.
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return;
      await registerBoardSignalBrowserPush(idToken);
      setRegistered(true);
      await onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Browser alerts could not be enabled.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!connectivity.online) { setError("Reconnect before changing browser alerts."); return; }
    setBusy(true);
    setError("");
    try {
      await removeBoardSignalBrowserPush(idToken);
      setRegistered(false);
      await onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Browser alerts could not be disabled.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <div className="browser-push-state"><BellOff size={17} /><div><strong>Browser alerts not configured yet</strong><p>In-app Inbox still works. Browser alerts become available once BoardSignal's Web Push configuration is enabled.</p></div></div>;
  }
  if (permission === "unsupported") {
    return <div className="browser-push-state"><BellOff size={17} /><div><strong>Browser alerts unsupported</strong><p>This browser does not expose the required notification/service-worker features.</p></div></div>;
  }
  if (permission === "denied") {
    return <div className="browser-push-state"><BellOff size={17} /><div><strong>Browser alerts blocked</strong><p>BoardSignal respects your browser denial and will not ask again here. You can change the permission later in your browser settings.</p></div></div>;
  }

  return <div className="browser-push-state"><Bell size={17} /><div><strong>{registered || permission === "granted" ? "Browser alerts enabled" : "Browser alerts are optional"}</strong><p>BoardSignal will never trigger the permission dialog without your click.</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button button-outline" type="button" disabled={busy || !connectivity.online} onClick={registered || permission === "granted" ? disable : enable}>{busy ? <><LoaderCircle className="button-spinner" size={14} /> Updating</> : registered || permission === "granted" ? "Disable browser alerts" : "Enable browser alerts"}</button></div></div>;
}
