"use client";

import type React from "react";
import { useId } from "react";

type Props = React.SVGProps<SVGSVGElement>;

export default function LogoMktMark(props: Props) {
  const id = useId().replace(/:/g, "");
  const gradId = `sparkle-mark-grad-${id}`;
  const glowId = `sparkle-mark-glow-${id}`;
  const sweepId = `sparkle-mark-sweep-${id}`;
  const sweepMaskId = `sparkle-mark-sweep-mask-${id}`;

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Sparkle Legacy Mark"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      className={`mark-pulse ${props.className || ""}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a4976a" />
          <stop offset="45%" stopColor="#887337" />
          <stop offset="100%" stopColor="#6f5d2b" />
        </linearGradient>

        <radialGradient id={glowId} cx="50%" cy="40%" r="72%">
          <stop offset="0%" stopColor="rgba(255,253,248,0.96)" />
          <stop offset="35%" stopColor="rgba(234,227,207,0.78)" />
          <stop offset="70%" stopColor="rgba(205,191,149,0.26)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        <linearGradient id={sweepId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.88)">
            <animate
              attributeName="offset"
              values="-1; 2"
              dur="8s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        <mask id={sweepMaskId}>
          <rect width="64" height="64" fill={`url(#${sweepId})`} />
        </mask>
      </defs>

      <path
        d="M32 9c9.1 0 16.5 7.5 16.5 16.7 0 12.2-13.7 24.9-16.5 27.4-2.8-2.5-16.5-15.2-16.5-27.4C15.5 16.5 22.9 9 32 9Z"
        fill="rgba(23,20,17,0.08)"
        transform="translate(0 1.6)"
      />

      <path
        d="M32 3c12.7 0 23 10.4 23 23.2 0 17.3-19.3 35.1-23 38.4-3.7-3.3-23-21.1-23-38.4C9 13.4 19.3 3 32 3Z"
        fill={`url(#${glowId})`}
        opacity="0.78"
      />

      <path
        d="M32 9c9.1 0 16.5 7.5 16.5 16.7 0 12.2-13.7 24.9-16.5 27.4-2.8-2.5-16.5-15.2-16.5-27.4C15.5 16.5 22.9 9 32 9Z"
        fill={`url(#${gradId})`}
      />

      <path
        d="M32 9c9.1 0 16.5 7.5 16.5 16.7 0 12.2-13.7 24.9-16.5 27.4-2.8-2.5-16.5-15.2-16.5-27.4C15.5 16.5 22.9 9 32 9Z"
        fill={`url(#${sweepId})`}
        mask={`url(#${sweepMaskId})`}
        opacity="0.26"
      />

      <path
        d="M32 9c9.1 0 16.5 7.5 16.5 16.7 0 12.2-13.7 24.9-16.5 27.4-2.8-2.5-16.5-15.2-16.5-27.4C15.5 16.5 22.9 9 32 9Z"
        fill="none"
        stroke="rgba(255,253,248,0.88)"
        strokeWidth="1.05"
      />

      <path
        d="M25.2 32.4l4.2 4.4L40 26.9"
        fill="none"
        stroke="rgba(23,20,17,0.82)"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <style jsx>{`
        @keyframes pulseSoft {
          0%,
          100% {
            transform: scale(1);
            filter: drop-shadow(0 6px 10px rgba(111, 93, 43, 0.12))
              drop-shadow(0 10px 16px rgba(136, 115, 55, 0.08));
          }
          50% {
            transform: scale(1.035);
            filter: drop-shadow(0 8px 14px rgba(111, 93, 43, 0.16))
              drop-shadow(0 12px 22px rgba(136, 115, 55, 0.12));
          }
        }

        .mark-pulse {
          animation: pulseSoft 5.2s cubic-bezier(0.45, 0, 0.25, 1) infinite;
          transform-origin: center;
          transition: filter 0.6s ease;
        }

        .mark-pulse:hover {
          filter: drop-shadow(0 8px 16px rgba(111, 93, 43, 0.18))
            drop-shadow(0 12px 24px rgba(136, 115, 55, 0.14));
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </svg>
  );
}