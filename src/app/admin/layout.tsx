import type { Metadata } from "next";
import FounderDeviceMarker from "@/components/FounderDeviceMarker";

export const metadata: Metadata = {
  title: "Founder Newsroom",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><FounderDeviceMarker />{children}</>;
}

