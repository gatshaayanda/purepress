"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share2, X } from "lucide-react";
import { isPurePressPublicRoute } from "@/lib/purepress/publicRoutes";
import styles from "./PurePressInstallPrompt.module.css";

const PUREPRESS_INSTALL_DISMISSED_KEY = "purepress:install:dismissed-at";
const PUREPRESS_INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isPurePressInstallSurface(pathname: string | null) {
  return Boolean(
    isPurePressPublicRoute(pathname) ||
    pathname === "/my-purepress" ||
    pathname?.startsWith("/my-purepress/"),
  );
}

function isInstalledOrStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const navigator = window.navigator;
  const ua = navigator.userAgent;
  const iosDevice = /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  return iosDevice && safari;
}

function dismissedRecently() {
  if (typeof window === "undefined") return false;
  try {
    const value = window.localStorage.getItem(PUREPRESS_INSTALL_DISMISSED_KEY);
    if (!value) return false;
    const at = Date.parse(value);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < PUREPRESS_INSTALL_DISMISS_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(PUREPRESS_INSTALL_DISMISSED_KEY, new Date().toISOString());
  } catch {
    // Installation remains optional even when storage is unavailable.
  }
}

export default function PurePressInstallPrompt() {
  const pathname = usePathname();
  const eligibleRoute = useMemo(() => isPurePressInstallSurface(pathname), [pathname]);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosManual, setIosManual] = useState(false);
  const [automaticVisible, setAutomaticVisible] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const refresh = useCallback(() => {
    if (!eligibleRoute || isInstalledOrStandalone()) {
      setInstalled(isInstalledOrStandalone());
      setAutomaticVisible(false);
      setManualOpen(false);
      return;
    }

    const ios = isIosSafari();
    setIosManual(ios);
    if ((deferredPrompt || ios) && !dismissedRecently()) setAutomaticVisible(true);
  }, [deferredPrompt, eligibleRoute]);

  useEffect(() => {
    setInstalled(isInstalledOrStandalone());
    setIosManual(isIosSafari());
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      if (!isPurePressInstallSurface(window.location.pathname) || isInstalledOrStandalone()) return;
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!dismissedRecently()) setAutomaticVisible(true);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setAutomaticVisible(false);
      setManualOpen(false);
      try { window.localStorage.removeItem(PUREPRESS_INSTALL_DISMISSED_KEY); } catch {}
    };

    const media = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => {
      if (isInstalledOrStandalone()) onAppInstalled();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    media.addEventListener?.("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      media.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setDeferredPrompt(null);
    setAutomaticVisible(false);
    setManualOpen(false);
    if (choice.outcome === "dismissed") rememberDismissal();
  }, [deferredPrompt]);

  function dismissAutomatic() {
    rememberDismissal();
    setAutomaticVisible(false);
    setManualOpen(false);
  }

  if (!eligibleRoute || installed) return null;

  const programmaticAvailable = Boolean(deferredPrompt);
  const manualAvailable = iosManual;
  if (!programmaticAvailable && !manualAvailable) return null;

  const showCard = automaticVisible || manualOpen;
  if (!showCard) {
    return (
      <div className={`${styles.shell} ${styles.compact}`}>
        <button
          className={styles.compactButton}
          type="button"
          onClick={() => setManualOpen(true)}
          aria-label={manualAvailable ? "Add PurePress to your Home Screen" : "Install PurePress"}
        >
          {manualAvailable ? <Share2 size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
          {manualAvailable ? "ADD PUREPRESS" : "INSTALL PUREPRESS"}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <section className={styles.card} role="region" aria-label={manualAvailable ? "Add PurePress to your Home Screen" : "Install PurePress"}>
        <div className={styles.brandRow}>
          <div>
            <p className={styles.kicker}>PUREPRESS ON YOUR DEVICE</p>
            <h2 className={styles.title}>
              {manualAvailable ? "ADD PUREPRESS TO YOUR HOME SCREEN" : "KEEP PUREPRESS WITHIN EASY REACH"}
            </h2>
            <p className={styles.copy}>
              {manualAvailable
                ? "Keep PurePress close for quick access whenever you need it."
                : "Keep PurePress and your orders within easy reach."}
            </p>
          </div>
          <button className={styles.closeButton} type="button" onClick={dismissAutomatic} aria-label="Not now">
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        {manualAvailable ? (
          <ol className={styles.instructions}>
            <li>Tap Share.</li>
            <li>Tap Add to Home Screen.</li>
          </ol>
        ) : null}

        <div className={styles.actions}>
          {programmaticAvailable ? (
            <button className={styles.primary} type="button" onClick={() => void install()}>
              <Download size={18} aria-hidden="true" />
              INSTALL PUREPRESS
            </button>
          ) : (
            <button className={styles.primary} type="button" onClick={dismissAutomatic}>
              GOT IT
            </button>
          )}
          {programmaticAvailable ? (
            <button className={styles.secondary} type="button" onClick={dismissAutomatic}>
              NOT NOW
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
