"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, HardDrive, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";
import { clearBoardSignalOfflineDataOnDevice } from "@/lib/boardsignal/offline/db";
import { getOfflineMeta, loadPlayerRoomOfflineSnapshot, requestPersistentStorageBestEffort } from "@/lib/boardsignal/offline/snapshots";
import { PWA_INSTALL_REQUEST_EVENT, isIosInstallCandidate, isStandaloneBoardSignal } from "@/lib/boardsignal/offline/install";

function formatTime(value?: string) {
  if (!value) return "Not saved yet";
  try { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
  catch { return value; }
}

export default function DeviceOfflineControl({ uid, onRefresh }: { uid: string; onRefresh: () => Promise<void> }) {
  const connectivity = useBoardSignalConnectivity();
  const [installed, setInstalled] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [savedAt, setSavedAt] = useState<string>();
  const [persisted, setPersisted] = useState<boolean | undefined>();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const inspect = useCallback(async () => {
    setInstalled(isStandaloneBoardSignal());
    setIosHelp(isIosInstallCandidate());
    const [snapshot, meta] = await Promise.all([loadPlayerRoomOfflineSnapshot(uid).catch(() => undefined), getOfflineMeta(uid).catch(() => ({ uid, lastSyncedAt: undefined }))]);
    setSavedAt(snapshot?.lastSyncedAt ?? meta.lastSyncedAt);
    if (navigator.storage?.persisted) setPersisted(await navigator.storage.persisted().catch(() => undefined));
  }, [uid]);

  useEffect(() => { void inspect(); const saved = () => void inspect(); window.addEventListener("boardsignal:offline-saved", saved); return () => window.removeEventListener("boardsignal:offline-saved", saved); }, [inspect]);

  async function refresh() {
    if (!connectivity.online) return;
    setBusy("refresh"); setMessage("");
    try { await onRefresh(); await inspect(); setMessage("Offline copy refreshed."); }
    catch { setMessage("BoardSignal could not refresh the offline copy right now."); }
    finally { setBusy(""); }
  }

  async function keepOffline() {
    setBusy("persist"); setMessage("");
    const granted = await requestPersistentStorageBestEffort(uid).catch(() => false);
    setPersisted(granted);
    setMessage(granted ? "BoardSignal offline storage is protected where this browser supports it." : "Offline access still works. This browser keeps control of storage cleanup.");
    setBusy("");
  }

  async function clear() {
    if (!window.confirm("Clear BoardSignal offline data saved on this device? This does not delete your online account or Reviews.")) return;
    setBusy("clear"); setMessage("");
    await clearBoardSignalOfflineDataOnDevice();
    setSavedAt(undefined); setPersisted(undefined); setMessage("BoardSignal offline data was cleared from this device."); setBusy("");
  }

  function install() { window.dispatchEvent(new CustomEvent(PWA_INSTALL_REQUEST_EVENT)); }

  return <div className="device-offline-control">
    <div className="device-offline-status"><div><span>Installed</span><strong>{installed ? "Yes" : "Not installed"}</strong></div><div><span>Offline access</span><strong>{savedAt ? "Ready" : "Not saved yet"}</strong></div><div><span>Last synchronized</span><strong>{formatTime(savedAt)}</strong></div><div><span>Storage</span><strong>{persisted === true ? "Kept offline" : "Browser managed"}</strong></div></div>
    {!installed && !iosHelp ? <button className="button button-outline" type="button" onClick={install}><Download size={15}/> Install BoardSignal</button> : null}
    {iosHelp ? <div className="ios-install-help"><strong>Install BoardSignal on this iPhone/iPad</strong><ol><li>Tap Share.</li><li>Choose Add to Home Screen.</li><li>Confirm BoardSignal.</li></ol></div> : null}
    <div className="device-offline-actions"><button className="button button-outline" type="button" disabled={!connectivity.online || busy === "refresh"} onClick={() => void refresh()}>{busy === "refresh" ? <LoaderCircle className="button-spinner" size={15}/> : <RefreshCw size={15}/>} Refresh offline copy</button>{savedAt && persisted !== true ? <button className="button button-outline" type="button" disabled={Boolean(busy)} onClick={() => void keepOffline()}>{busy === "persist" ? <LoaderCircle className="button-spinner" size={15}/> : <HardDrive size={15}/>} Keep BoardSignal available offline</button> : null}<button className="button button-quiet" type="button" disabled={Boolean(busy)} onClick={() => void clear()}>{busy === "clear" ? <LoaderCircle className="button-spinner" size={15}/> : <Trash2 size={15}/>} Clear offline data</button></div>
    {message ? <p className="profile-helper" role="status">{message}</p> : null}
  </div>;
}
