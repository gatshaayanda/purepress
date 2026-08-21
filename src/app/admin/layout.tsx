import type { Metadata } from "next";
import FounderDeviceMarker from "@/components/FounderDeviceMarker";
import PurePressAdminFirebaseGate from "@/components/PurePressAdminFirebaseGate";

export const metadata: Metadata = {
  title: "Founder Newsroom",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FounderDeviceMarker />
      <PurePressAdminFirebaseGate>{children}</PurePressAdminFirebaseGate>
    </>
  );
}
