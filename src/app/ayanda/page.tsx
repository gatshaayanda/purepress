import type { Metadata, Viewport } from "next";
import AyandaPortfolioClient from "@/components/ayanda/AyandaPortfolioClient";
import { ayandaPortfolio } from "@/data/ayandaPortfolio";

const title = "Ayanda Kopano Gatsha — Technical Support, SaaS Customer Success & Product Operations";
const description =
  "Technical Support, SaaS Customer Success and Product Operations professional with 10+ years of international remote experience. Technical troubleshooting, customer support, documentation, product operations and evidence-backed work.";
const canonical = "https://www.adminhub-global.com/ayanda";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  applicationName: "Ayanda Kopano Gatsha",
  manifest: null,
  alternates: { canonical },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description: "Technical Support · SaaS Customer Success · Product Operations. Evidence-backed international remote work.",
    url: canonical,
    siteName: "Ayanda Kopano Gatsha",
    type: "profile",
    images: [{ url: "/ayanda/opengraph-image", width: 1200, height: 630, alt: "Ayanda Kopano Gatsha — Technical Support and SaaS Customer Success" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: "Technical Support · SaaS Customer Success · Product Operations.",
    images: ["/ayanda/opengraph-image"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f2ea",
  colorScheme: "light",
};

const profilePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  url: canonical,
  name: title,
  description,
  mainEntity: {
    "@type": "Person",
    name: ayandaPortfolio.profile.name,
    jobTitle: "Technical Support Specialist",
    description: "SaaS customer support, customer success, product operations and technical operations professional.",
    homeLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Gaborone",
        addressCountry: "BW",
      },
    },
    sameAs: [ayandaPortfolio.contact.linkedin, ayandaPortfolio.contact.github],
  },
};

export default function AyandaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageJsonLd).replace(/</g, "\\u003c") }}
      />
      <AyandaPortfolioClient />
    </>
  );
}
