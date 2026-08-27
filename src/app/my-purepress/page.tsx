import type { Metadata } from "next";
import { PurePressCustomerOrders } from "@/components/purepress/PurePressCustomerPortal";

export const metadata: Metadata = { title: "My PurePress | Your Orders", robots: { index: false, follow: false } };
export default function MyPurePressPage() { return <PurePressCustomerOrders />; }
