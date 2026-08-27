import type { Metadata } from "next";
import PurePressCustomerLogin from "@/components/purepress/PurePressCustomerLogin";

export const metadata: Metadata = { title: "My PurePress | PurePress Printers", robots: { index: false, follow: false } };
export default function MyPurePressLoginPage() { return <PurePressCustomerLogin />; }
