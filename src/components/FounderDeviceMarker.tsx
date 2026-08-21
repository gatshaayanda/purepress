"use client";

import { useEffect } from "react";
import { BOARDSIGNAL_FOUNDER_DEVICE_EVENT, BOARDSIGNAL_FOUNDER_DEVICE_KEY } from "@/lib/boardsignal/offline/founderDevice";

export default function FounderDeviceMarker() {
  useEffect(() => {
    // This marker is convenience only. It never authorizes /admin; Basic Auth middleware remains authoritative.
    try {
      window.localStorage.setItem(BOARDSIGNAL_FOUNDER_DEVICE_KEY, "true");
      window.dispatchEvent(new CustomEvent(BOARDSIGNAL_FOUNDER_DEVICE_EVENT));
    } catch { /* device hint is optional */ }
  }, []);
  return null;
}
