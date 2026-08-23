"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/utils/firebaseConfig";

export default function PurePressAdminFirebaseGate({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    const authorize = async () => {
      try {
        const current = auth.currentUser;
        if (current) {
          const claims = await current.getIdTokenResult();
          if (
            claims.claims.purepress_admin === true ||
            claims.claims.admin === true
          ) {
            if (active) setState("ready");
            return;
          }
        }

        const response = await fetch("/api/admin/purepress/firebase-session", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Admin Firebase authorization failed.");
        }

        const body = (await response.json()) as { token?: string };
        if (!body.token) {
          throw new Error("Admin Firebase token was not returned.");
        }

        await signInWithCustomToken(auth, body.token);
        if (active) setState("ready");
      } catch (error) {
        console.error("PurePress admin Firebase gate failed", error);
        if (active) setState("error");
      }
    };

    void authorize();
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-slate-500">
        Opening PurePress Studio…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-[40vh] grid place-items-center p-6 text-center text-sm text-red-700">
        We couldn&apos;t verify access to PurePress Studio. Sign in again before
        continuing.
      </div>
    );
  }

  return <>{children}</>;
}
