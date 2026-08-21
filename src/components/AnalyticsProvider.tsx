// src/components/AnalyticsProvider.tsx
"use client";

import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { logEvent, type Analytics } from "firebase/analytics";

import { getAnalyticsClient } from "@/utils/firebaseConfig";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const path = usePathname();

  useEffect(() => {
    let mounted = true;

    async function trackPageView() {
      try {
        if (typeof window === "undefined") return;

        const analytics = await getAnalyticsClient();

        if (!mounted || !analytics) return;

        logEvent(analytics as Analytics, "page_view", {
          page_path: path,
          page_location: window.location.href,
          page_title: document.title,
        });
      } catch (error) {
        console.warn("Analytics page view skipped:", error);
      }
    }

    trackPageView();

    return () => {
      mounted = false;
    };
  }, [path]);

  return <>{children}</>;
}