"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Wifi, WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { auth } from "@/utils/firebaseConfig";
import { clearBoardSignalPrivateOfflineData } from "@/lib/boardsignal/offline/db";
import {
  BOARDSIGNAL_RECONNECTED_EVENT,
  probeBoardSignalConnectivity,
  type BoardSignalConnectivityState,
} from "@/lib/boardsignal/offline/connectivity";
import {
  isPurePressInternalRoute,
  isPurePressPublicRoute,
} from "@/lib/purepress/publicRoutes";

type ConnectivityContextValue = {
  state: BoardSignalConnectivityState;
  online: boolean;
  lastHealthyAt?: string;
  check: () => Promise<boolean>;
};

const ConnectivityContext = createContext<ConnectivityContextValue>({
  state: "checking",
  online: true,
  check: async () => true,
});

export function useBoardSignalConnectivity() {
  return useContext(ConnectivityContext);
}

export default function ConnectivityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<BoardSignalConnectivityState>("checking");
  const [lastHealthyAt, setLastHealthyAt] = useState<string>();
  const [updated, setUpdated] = useState(false);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const lastStateRef = useRef<BoardSignalConnectivityState>("checking");
  const updatedTimerRef = useRef<number | undefined>(undefined);
  const previousUidRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    lastStateRef.current = state;
  }, [state]);

  // Private offline records remain UID-scoped. Identity changes purge only the
  // previous user's private records; safe public/static caches are untouched.
  useEffect(
    () =>
      onAuthStateChanged(auth, (activeUser) => {
        const previousUid = previousUidRef.current;
        const nextUid = activeUser?.uid;
        if (previousUid && previousUid !== nextUid) {
          void clearBoardSignalPrivateOfflineData(previousUid).catch(
            () => undefined,
          );
        }
        previousUidRef.current = nextUid;
      }),
    [],
  );

  const check = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const previous = lastStateRef.current;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("offline");
      return false;
    }

    if (previous === "offline") setState("reconnecting");
    else if (previous === "checking") setState("checking");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const task = probeBoardSignalConnectivity(controller.signal)
      .then((healthy) => {
        if (!healthy) {
          setState("offline");
          return false;
        }

        const wasOffline = previous === "offline" || previous === "reconnecting";
        setLastHealthyAt(new Date().toISOString());
        setState("online");
        if (wasOffline) {
          window.dispatchEvent(new CustomEvent(BOARDSIGNAL_RECONNECTED_EVENT));
        }
        return true;
      })
      .catch(() => {
        setState("offline");
        return false;
      })
      .finally(() => {
        window.clearTimeout(timeout);
        inFlightRef.current = null;
      });

    inFlightRef.current = task;
    return task;
  }, []);

  useEffect(() => {
    const offline = () => setState("offline");
    const online = () => {
      setState("reconnecting");
      void check();
    };
    const visible = () => {
      if (
        document.visibilityState === "visible" &&
        (lastStateRef.current === "offline" ||
          lastStateRef.current === "reconnecting")
      ) {
        void check();
      }
    };

    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    void check();

    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [check]);

  useEffect(() => {
    const refreshed = () => {
      setUpdated(true);
      if (updatedTimerRef.current) {
        window.clearTimeout(updatedTimerRef.current);
      }
      updatedTimerRef.current = window.setTimeout(() => setUpdated(false), 2200);
    };

    window.addEventListener("boardsignal:refresh-complete", refreshed);
    return () => {
      window.removeEventListener("boardsignal:refresh-complete", refreshed);
      if (updatedTimerRef.current) {
        window.clearTimeout(updatedTimerRef.current);
      }
    };
  }, []);

  const value = useMemo<ConnectivityContextValue>(
    () => ({ state, online: state === "online", lastHealthyAt, check }),
    [check, lastHealthyAt, state],
  );

  const purePressSurface =
    isPurePressPublicRoute(pathname) || isPurePressInternalRoute(pathname);
  const offlineLabel = purePressSurface ? "OFFLINE" : "SAVED";
  const offlineMessage = purePressSurface
    ? "You're offline. Some live PurePress features need a connection."
    : "You're offline. Showing saved BoardSignal.";
  const liveMessage = purePressSurface
    ? "PurePress is live again."
    : "BoardSignal is live again.";

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
      {state === "offline" ? (
        <div className="bs-connectivity-strip is-offline" role="status">
          <WifiOff size={15} />
          <strong>{offlineLabel}</strong>
          <span>{offlineMessage}</span>
        </div>
      ) : null}
      {state === "reconnecting" ? (
        <div className="bs-connectivity-strip is-checking" role="status">
          <Wifi size={15} />
          <strong>RECONNECTING</strong>
          <span>Reconnecting…</span>
        </div>
      ) : null}
      {updated && state === "online" ? (
        <div className="bs-connectivity-strip is-updated" role="status">
          <Wifi size={15} />
          <strong>LIVE</strong>
          <span>{liveMessage}</span>
        </div>
      ) : null}
    </ConnectivityContext.Provider>
  );
}
