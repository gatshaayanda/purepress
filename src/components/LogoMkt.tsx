"use client";

import type React from "react";
import { useId } from "react";

type Props = React.SVGProps<SVGSVGElement>;

export default function LogoMkt(props: Props) {
  const id = useId().replace(/:/g, "");
  const gradId = `sparkle-grad-${id}`;
  const glowId = `sparkle-glow-${id}`;
  const shineId = `sparkle-shine-${id}`;
  const shineMaskId = `sparkle-shine-mask-${id}`;

  return (
    <svg
      viewBox="0 0 360 64"
      role="img"
      aria-label="Sparkle Legacy Insurance Brokers Logo"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      className={`logo-fade ${props.className || ""}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a4976a" />
          <stop offset="45%" stopColor="#887337" />
          <stop offset="100%" stopColor="#6f5d2b" />
        </linearGradient>

        <radialGradient id={glowId} cx="50%" cy="38%" r="72%">
          <stop offset="0%" stopColor="rgba(255,253,248,0.96)" />
          <stop offset="35%" stopColor="rgba(234,227,207,0.78)" />
          <stop offset="70%" stopColor="rgba(205,191,149,0.26)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        <linearGradient id={shineId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.9)">
            <animate
              attributeName="offset"
              values="-1; 2"
              dur="8s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        <mask id={shineMaskId}>
          <rect width="360" height="64" fill={`url(#${shineId})`} />
        </mask>
      </defs>

      <g transform="translate(36,32)" className="float drop-glow">
        <path
          d="M0 -18c8.6 0 15.6 7 15.6 15.7 0 11.4-13 23.4-15.6 25.8-2.6-2.4-15.6-14.4-15.6-25.8C-15.6 -11-8.6 -18 0 -18Z"
          fill={`url(#${gradId})`}
          stroke="rgba(255,253,248,0.95)"
          strokeWidth="1.5"
        />

        <path
          d="M0 -25c12.1 0 22 9.9 22 22.1 0 16.1-18.4 32.9-22 36.1-3.6-3.2-22-20-22-36.1C-22 -15.1 -12.1 -25 0 -25Z"
          fill={`url(#${glowId})`}
          opacity="0.75"
        />

        <path
          d="M0 -18c8.6 0 15.6 7 15.6 15.7 0 11.4-13 23.4-15.6 25.8-2.6-2.4-15.6-14.4-15.6-25.8C-15.6 -11-8.6 -18 0 -18Z"
          fill={`url(#${shineId})`}
          mask={`url(#${shineMaskId})`}
          opacity="0.26"
        />

        <path
          d="M-7.8 2.2l3.5 3.6L8.2 -7.2"
          fill="none"
          stroke="rgba(23,20,17,0.82)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <text
        x="74"
        y="34"
        fill="var(--text-primary)"
        fontFamily="var(--font-sans)"
        fontWeight="900"
        fontSize="22"
        letterSpacing="0.2"
        className="tracking-text"
      >
        Sparkle Legacy
      </text>

      <text
        x="74"
        y="52"
        fill="var(--brand-primary-strong)"
        fontFamily="var(--font-sans)"
        fontWeight="800"
        fontSize="10.5"
        letterSpacing="1.9"
        className="subtle"
      >
        INSURANCE BROKERS • BOTSWANA
      </text>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        .float {
          animation: float 5.4s cubic-bezier(0.45, 0, 0.25, 1) infinite;
          transform-origin: center;
        }

        .drop-glow {
          filter: drop-shadow(0 6px 12px rgba(111, 93, 43, 0.12))
            drop-shadow(0 10px 20px rgba(136, 115, 55, 0.08));
          transition: filter 0.6s ease;
        }

        .drop-glow:hover {
          filter: drop-shadow(0 8px 16px rgba(111, 93, 43, 0.16))
            drop-shadow(0 12px 24px rgba(136, 115, 55, 0.1));
        }

        @keyframes textReveal {
          0% {
            opacity: 0;
            letter-spacing: 0.08em;
            transform: translateY(5px);
          }
          100% {
            opacity: 1;
            letter-spacing: 0.01em;
            transform: translateY(0);
          }
        }

        .tracking-text {
          animation: textReveal 0.95s cubic-bezier(0.45, 0, 0.25, 1) forwards;
        }

        @keyframes fadeInLogo {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .logo-fade {
          animation: fadeInLogo 0.55s ease-in forwards;
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