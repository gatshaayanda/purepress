import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import "./boardsignal-foundation.css";
import "./boardsignal-accessibility.css";
import "./boardsignal-motion.css";
import "./boardsignal-player-room-g3.css";
import "./boardsignal-f2-readability.css";
import "./purepress-studio.css";

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

function resolveMetadataBase() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined);

  if (!configuredOrigin) return undefined;

  try {
    return new URL(configuredOrigin);
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "PurePress Printers — Your Vision, Fully Printed",
    template: "%s | PurePress Printers",
  },
  description:
    "Computerized embroidery and garment branding in Gaborone, Botswana for companies, schools, sports teams, clothing brands and organisations.",
  applicationName: "PurePress Printers",
  keywords: [
    "embroidery Botswana",
    "computerized embroidery Gaborone",
    "garment branding",
    "corporate uniform embroidery",
    "school badges",
    "sportswear embroidery",
  ],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/purepress/brand/purepress-mark.svg",
        type: "image/svg+xml",
      },
      {
        url: "/purepress/brand/purepress-app-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "PurePress Printers — Your Vision, Fully Printed",
    description:
      "Computerized embroidery and garment branding from Gaborone, Botswana.",
    siteName: "PurePress Printers",
    type: "website",
    images: [
      {
        url: "/purepress/brand/purepress-app-512.png",
        width: 512,
        height: 512,
        alt: "PurePress Printers mark",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "PurePress Printers",
    description: "Your Vision, Fully Printed",
    images: ["/purepress/brand/purepress-app-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#00AEEF",
};

const boardSignalThemeBootstrap = `(() => {
  const key = "boardsignal:theme";
  let choice = "system";
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "light" || stored === "dark" || stored === "system") {
      choice = stored;
    }
  } catch {}

  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.dataset.bsTheme = dark ? "dark" : "light";
  root.dataset.bsThemeChoice = choice;
  root.style.colorScheme = dark ? "dark" : "light";
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: boardSignalThemeBootstrap }}
        />
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
