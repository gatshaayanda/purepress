"use client";

import { useEffect } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const PENDING_REVIEW_COPY = "Your week is ready. Position review is finishing.";
const PREVIOUS_GUIDANCE_SOURCE = "FROM YOUR LAST REVIEW";
const CURRENT_GUIDANCE_SOURCE = "Based on ";

const trackedSelectors = [
  [".current-episode-stats > div", "bs-motion-fact-change"],
  [".forming-pools > article", "bs-motion-fact-change"],
  [".current-episode-card .return-loop-amber", "bs-motion-observation-change"],
  [".current-episode-card .return-loop-blue", "bs-motion-guidance-change"],
  [".current-episode-heading > small", "bs-motion-fact-change"],
  [".unread-badge", "bs-motion-unread-change"],
  [".beta-preview-status", "bs-motion-preview-state"],
] as const;

function normalizedText(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

export default function BoardSignalSituationalMotion() {
  useEffect(() => {
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const previousText = new WeakMap<Element, string>();
    const removalTimers = new WeakMap<Element, Map<string, number>>();
    let frame = 0;
    let hadPendingReview = false;
    let reviewCompletionAcknowledged = false;

    const clearTransientMotion = () => {
      document.querySelectorAll<HTMLElement>("[class*='bs-motion-']").forEach((element) => {
        for (const className of [...element.classList]) {
          if (className.startsWith("bs-motion-") && className !== "bs-motion-engine-active") element.classList.remove(className);
        }
      });
    };

    const emphasize = (element: Element, className: string, duration = 620) => {
      if (reducedMotion.matches) return;
      const timers = removalTimers.get(element) ?? new Map<string, number>();
      removalTimers.set(element, timers);
      const existing = timers.get(className);
      if (existing) window.clearTimeout(existing);

      element.classList.remove(className);
      window.requestAnimationFrame(() => {
        if (!element.isConnected || reducedMotion.matches) return;
        element.classList.add(className);
        const timer = window.setTimeout(() => {
          element.classList.remove(className);
          timers.delete(className);
        }, duration);
        timers.set(className, timer);
      });
    };

    const scanTrackedState = (allowNewNodes: boolean) => {
      for (const [selector, className] of trackedSelectors) {
        document.querySelectorAll(selector).forEach((element) => {
          const next = normalizedText(element);
          const previous = previousText.get(element);
          if (previous === undefined) {
            previousText.set(element, next);
            if (allowNewNodes && selector === ".beta-preview-status") emphasize(element, className, 520);
            return;
          }
          if (previous === next) return;

          previousText.set(element, next);
          emphasize(element, className);

          if (
            selector === ".current-episode-card .return-loop-blue"
            && previous.includes(PREVIOUS_GUIDANCE_SOURCE)
            && next.includes(CURRENT_GUIDANCE_SOURCE)
          ) {
            emphasize(element, "bs-motion-guidance-current", 760);
          }
        });
      }
    };

    const scanEngineAndReviewState = () => {
      const banners = [...document.querySelectorAll<HTMLElement>(".last-active-banner")];
      const pendingBanner = banners.find((banner) => normalizedText(banner).includes(PENDING_REVIEW_COPY));

      for (const banner of banners) {
        if (banner !== pendingBanner) banner.classList.remove("bs-motion-engine-active");
      }

      if (pendingBanner) {
        hadPendingReview = true;
        reviewCompletionAcknowledged = false;
        const text = normalizedText(pendingBanner);
        const activelyProcessing = text.includes("retrying the position check") || text.includes("checking the selected positions");
        pendingBanner.classList.toggle("bs-motion-engine-active", activelyProcessing && !reducedMotion.matches);

        const previous = previousText.get(pendingBanner);
        if (previous !== undefined && previous !== text) emphasize(pendingBanner, "bs-motion-engine-state", 520);
        previousText.set(pendingBanner, text);
        return;
      }

      document.querySelectorAll(".last-active-banner.bs-motion-engine-active").forEach((banner) => banner.classList.remove("bs-motion-engine-active"));

      if (!hadPendingReview || reviewCompletionAcknowledged) return;
      const completedReview = document.querySelector<HTMLElement>(".universal-cover");
      if (!completedReview) return;

      reviewCompletionAcknowledged = true;
      hadPendingReview = false;
      emphasize(completedReview, "bs-motion-review-ready", 760);
      const focusNext = document.querySelector<HTMLElement>("#focus-next.universal-section");
      if (focusNext) emphasize(focusNext, "bs-motion-review-ready-focus", 820);
    };

    const scan = (allowNewNodes: boolean) => {
      scanTrackedState(allowNewNodes);
      scanEngineAndReviewState();
    };

    const scheduleScan = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scan(true);
      });
    };

    scan(false);

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });

    const onReducedMotionChange = () => {
      if (reducedMotion.matches) {
        clearTransientMotion();
        document.querySelectorAll(".bs-motion-engine-active").forEach((element) => element.classList.remove("bs-motion-engine-active"));
      } else {
        scheduleScan();
      }
    };
    reducedMotion.addEventListener("change", onReducedMotionChange);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
