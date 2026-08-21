"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname } from "next/navigation";
import { auth } from "@/utils/firebaseConfig";
import { isStandaloneBoardSignal } from "@/lib/boardsignal/offline/install";

export default function PwaLaunchRedirect() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/boardsignal" || new URLSearchParams(window.location.search).get("source") !== "pwa" || !isStandaloneBoardSignal()) return;
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        // A full navigation is intentional here: when offline the service
        // worker can safely substitute /offline/player-room. A client RSC
        // transition would otherwise fail before the navigation fallback runs.
        window.location.replace("/boardsignal/player-room");
      }
    });
  }, [pathname]);
  return null;
}
