"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import {
  PWA_DISMISSED_KEY,
  PWA_ENGAGED_EVENT,
  PWA_ENGAGED_KEY,
  PWA_INSTALL_REQUEST_EVENT,
  installDismissedRecently,
  isStandaloneBoardSignal,
} from "@/lib/boardsignal/offline/install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  const refreshEligibility = useCallback(() => {
    if (isStandaloneBoardSignal()) { setInstalled(true); setReady(false); return; }
    const engaged = Boolean(window.localStorage.getItem(PWA_ENGAGED_KEY));
    const eligiblePath = pathname.startsWith("/boardsignal/player-room");
    setReady(engaged && eligiblePath && !installDismissedRecently());
  }, [pathname]);

  useEffect(() => {
    setInstalled(isStandaloneBoardSignal());
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      refreshEligibility();
    };
    const onAppInstalled = () => { setInstalled(true); setDeferredPrompt(null); setReady(false); };
    const onEngaged = () => refreshEligibility();
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener(PWA_ENGAGED_EVENT, onEngaged);
    refreshEligibility();
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener(PWA_ENGAGED_EVENT, onEngaged);
    };
  }, [refreshEligibility]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") { setDeferredPrompt(null); setReady(false); }
    return choice.outcome === "accepted";
  }, [deferredPrompt]);

  useEffect(() => {
    const manual = () => { void handleInstall(); };
    window.addEventListener(PWA_INSTALL_REQUEST_EVENT, manual);
    return () => window.removeEventListener(PWA_INSTALL_REQUEST_EVENT, manual);
  }, [handleInstall]);

  function dismiss() {
    window.localStorage.setItem(PWA_DISMISSED_KEY, new Date().toISOString());
    setReady(false);
  }

  if (installed || !deferredPrompt || !ready) return null;
  return <div className="install-card bs-surface-paper" role="region" aria-label="Install BoardSignal">
    <div className="install-card-heading"><div><strong>Keep your Review close</strong><p>Install BoardSignal after your Player Room is ready for quicker access and offline continuity.</p></div><button type="button" onClick={dismiss} aria-label="Dismiss install prompt"><X size={16}/></button></div>
    <button type="button" onClick={() => void handleInstall()} className="button button-dark install-card-action"><Download size={18}/> Install BoardSignal</button>
  </div>;
}
