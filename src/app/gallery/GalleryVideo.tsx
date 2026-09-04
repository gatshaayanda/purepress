"use client";

import { useEffect, useRef } from "react";

type GalleryVideoProps = {
  src: string;
  poster?: string;
  label: string;
  className?: string;
  loopPreview?: boolean;
};

export default function GalleryVideo({
  src,
  poster,
  label,
  className,
  loopPreview = false,
}: GalleryVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!loopPreview) return;

    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (reducedMotion.matches) {
        video.pause();
        if (video.currentTime !== 0) video.currentTime = 0;
        return;
      }

      void video.play().catch(() => {
        // Autoplay can still be denied by browser policy; the first frame remains useful.
      });
    };

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    return () => reducedMotion.removeEventListener("change", syncPlayback);
  }, [loopPreview]);

  return (
    <video
      ref={videoRef}
      className={className}
      src={src}
      poster={poster}
      aria-label={label}
      muted={loopPreview}
      loop={loopPreview}
      playsInline
      preload="metadata"
      controls={!loopPreview}
    >
      Your browser does not support embedded video.
    </video>
  );
}
