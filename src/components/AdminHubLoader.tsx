"use client";

import { useEffect, useState } from "react";
import SignalMark from "@/components/SignalMark";

export default function AdminHubLoader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setFading(true), 500);
    const hide = window.setTimeout(() => setVisible(false), 850);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`signal-loader ${fading ? "is-fading" : ""}`} role="status" aria-label="Loading BoardSignal">
      <SignalMark className="signal-loader-mark" />
      <p>BoardSignal</p>
      <span>Preparing the desk</span>
    </div>
  );
}

