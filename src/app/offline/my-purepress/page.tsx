import type { Metadata } from "next";
import PurePressCustomerOffline from "@/components/purepress/PurePressCustomerOffline";

export const metadata: Metadata = { title: "Saved My PurePress", robots: { index: false, follow: false } };
export default function OfflineMyPurePressPage() { return <PurePressCustomerOffline />; }
