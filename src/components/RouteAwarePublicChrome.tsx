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
import PurePressHeader from "@/components/purepress/PurePressHeader";
import PurePressFooter from "@/components/purepress/PurePressFooter";
import { isStandalonePublicRoute } from "@/lib/standalonePublicRoutes";
import {
  isPurePressInternalRoute,
  isPurePressPublicRoute,
} from "@/lib/purepress/publicRoutes";

export default function RouteAwarePublicChrome({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (isStandalonePublicRoute(pathname) || isPurePressInternalRoute(pathname)) {
    return <>{children}</>;
  }

  if (isPurePressPublicRoute(pathname)) {
    return (
      <div className="pp-site">
        <PurePressHeader />
        <main id="main">{children}</main>
        <PurePressFooter />
      </div>
    );
  }

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
