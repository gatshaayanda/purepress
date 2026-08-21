import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCompletionClient from "@/components/AuthCompletionClient";

export const metadata: Metadata = { title: "Opening Player Room", robots: { index: false, follow: false } };

export default function AuthCompletePage() {
  return <Suspense fallback={null}><AuthCompletionClient /></Suspense>;
}
