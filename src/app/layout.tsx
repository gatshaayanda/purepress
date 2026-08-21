import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import "./boardsignal-foundation.css";
import "./boardsignal-accessibility.css";
import "./boardsignal-motion.css";
import "./boardsignal-player-room-g3.css";
import "./boardsignal-f2-readability.css";

import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ConnectivityProvider from "@/components/ConnectivityProvider";
import RouteAwarePublicChrome from "@/components/RouteAwarePublicChrome";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BoardSignal — Your weekly chess Review",
    template: "%s | BoardSignal",
  },
  description: "BoardSignal turns a fixed seven days of your Chess.com games into a factual Review, a clear signal and a plan you can use.",
  applicationName: "BoardSignal",
  keywords: ["chess improvement", "Chess.com analysis", "weekly chess report", "chess insights", "BoardSignal"],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "BoardSignal — Your games, covered like sport",
    description: "Personal sports coverage and private performance guidance for everyday chess players.",
    siteName: "BoardSignal",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

const boardSignalThemeBootstrap = `(() => {
  const key = "boardsignal:theme";
  let choice = "system";
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "light" || stored === "dark" || stored === "system") choice = stored;
  } catch {}
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.dataset.bsTheme = dark ? "dark" : "light";
  root.dataset.bsThemeChoice = choice;
  root.style.colorScheme = dark ? "dark" : "light";
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boardSignalThemeBootstrap }} />
      </head>
      <body suppressHydrationWarning>
        <AnalyticsProvider>
          <ConnectivityProvider>
            <RouteAwarePublicChrome>{children}</RouteAwarePublicChrome>
            <ServiceWorkerRegister />
            <Analytics />
            <SpeedInsights />
          </ConnectivityProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
