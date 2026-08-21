"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Loader from "@/components/AdminHubLoader";
import AskBoardSignal from "@/components/AskBoardSignal";
import InstallPrompt from "@/components/InstallPrompt";
import PwaLaunchRedirect from "@/components/PwaLaunchRedirect";
import BoardSignalSituationalMotion from "@/components/BoardSignalSituationalMotion";
import { isStandalonePublicRoute } from "@/lib/standalonePublicRoutes";

export default function RouteAwarePublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const standalone = isStandalonePublicRoute(pathname);

  if (standalone) return <>{children}</>;

  return (
    <>
      <Loader />
      <BoardSignalSituationalMotion />
      <div className="site-frame">
        <Header />
        <main className="site-main">{children}</main>
        <Footer />
      </div>
      <InstallPrompt />
      <PwaLaunchRedirect />
      <AskBoardSignal />
    </>
  );
}
