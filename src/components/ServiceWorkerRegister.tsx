"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCcw, X } from "lucide-react";
import { shouldCheckServiceWorkerUpdate } from "@/lib/boardsignal/serviceWorkerUpdate.mjs";
import {
  isPurePressInternalRoute,
  isPurePressPublicRoute,
} from "@/lib/purepress/publicRoutes";

export default function ServiceWorkerRegister() {
  const pathname = usePathname();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const reloadForUpdateRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastUpdateCheckRef = useRef(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let cleanupUpdateListener: (() => void) | undefined;

    const inspectWaiting = (registration: ServiceWorkerRegistration) => {
      if (
        !cancelled &&
        registration.waiting &&
        navigator.serviceWorker.controller
      ) {
        setWaiting(registration.waiting);
        setDismissed(false);
      }
    };

    const checkForUpdate = async (force = false) => {
      const registration = registrationRef.current;
      if (
        !registration ||
        (!force &&
          !shouldCheckServiceWorkerUpdate(lastUpdateCheckRef.current))
      ) {
        return;
      }

      lastUpdateCheckRef.current = Date.now();
      try {
        await registration.update();
      } catch {
        // Update checks are best effort; the current controlled app remains usable.
      }
      inspectWaiting(registration);
    };

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (cancelled) return;

        registrationRef.current = registration;
        inspectWaiting(registration);

        const onUpdateFound = () => {
          const worker = registration.installing;
          if (!worker) return;

          const onState = () => {
            if (worker.state === "installed") inspectWaiting(registration);
          };
          worker.addEventListener("statechange", onState);
        };

        registration.addEventListener("updatefound", onUpdateFound);
        cleanupUpdateListener = () =>
          registration.removeEventListener("updatefound", onUpdateFound);
        void checkForUpdate(true);
      })
      .catch(() => undefined);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate(false);
      }
    };
    const onFocus = () => {
      void checkForUpdate(false);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    const onControllerChange = () => {
      if (reloadForUpdateRef.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      cancelled = true;
      cleanupUpdateListener?.();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      registrationRef.current = null;
    };
  }, []);

  if (!waiting || dismissed) return null;

  const applyUpdate = () => {
    reloadForUpdateRef.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const purePressSurface =
    isPurePressPublicRoute(pathname) || isPurePressInternalRoute(pathname);
  const product = purePressSurface ? "PurePress" : "BoardSignal";

  return (
    <div className="boardsignal-update-ready" role="status" aria-live="polite">
      <div>
        <strong>{product} update ready</strong>
        <span>
          Refresh when you&apos;re ready. Your current screen will not reload on
          its own.
        </span>
      </div>
      <button
        type="button"
        className="button button-lime"
        onClick={applyUpdate}
      >
        <RefreshCcw size={15} /> Refresh
      </button>
      <button
        type="button"
        className="update-ready-dismiss"
        aria-label="Dismiss update notice"
        onClick={() => setDismissed(true)}
      >
        <X size={16} />
      </button>
    </div>
  );
}
