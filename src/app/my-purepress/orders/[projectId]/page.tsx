import type { Metadata } from "next";
import { PurePressCustomerOrder } from "@/components/purepress/PurePressCustomerPortal";

export const metadata: Metadata = { title: "My PurePress | Order", robots: { index: false, follow: false } };
export default function MyPurePressOrderPage() { return <PurePressCustomerOrder />; }
