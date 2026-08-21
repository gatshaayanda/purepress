import {
  BOARDSIGNAL_OFFLINE_DB_NAME,
  BOARDSIGNAL_OFFLINE_DB_VERSION,
  type OfflineStoredRecord,
} from "./types";

const STORES = ["meta", "snapshots", "drafts"] as const;
type StoreName = (typeof STORES)[number];

function ensureBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) throw new Error("Offline storage is unavailable in this browser.");
}

export function offlineKey(uid: string, kind: string, id = "current") {
  if (!uid.trim()) throw new Error("A Firebase UID is required for private offline storage.");
  return `${uid}:${kind}:${id}`;
}

export async function openBoardSignalOfflineDb(): Promise<IDBDatabase> {
  ensureBrowser();
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(BOARDSIGNAL_OFFLINE_DB_NAME, BOARDSIGNAL_OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("BoardSignal offline storage could not be opened."));
  });
}

async function transaction<T>(storeName: StoreName, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openBoardSignalOfflineDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = work(tx.objectStore(storeName));
      let result!: T;
      let settled = false;
      const fail = (reason: unknown) => {
        if (settled) return;
        settled = true;
        reject(reason instanceof Error ? reason : new Error("BoardSignal offline storage transaction failed."));
      };
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => fail(request.error ?? new Error("BoardSignal offline storage operation failed."));
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      tx.onerror = () => fail(tx.error ?? new Error("BoardSignal offline storage transaction failed."));
      tx.onabort = () => fail(tx.error ?? new Error("BoardSignal offline storage transaction was cancelled."));
    });
  } finally {
    db.close();
  }
}

export async function putOfflineRecord<T>(store: StoreName, record: OfflineStoredRecord<T>) {
  await transaction(store, "readwrite", (objectStore) => objectStore.put(record));
}

export async function getOfflineRecord<T>(store: StoreName, key: string, expectedUid: string): Promise<OfflineStoredRecord<T> | undefined> {
  const record = await transaction<OfflineStoredRecord<T> | undefined>(store, "readonly", (objectStore) => objectStore.get(key));
  if (!record || record.uid !== expectedUid) return undefined;
  return record;
}

export async function deleteOfflineRecord(store: StoreName, key: string) {
  await transaction(store, "readwrite", (objectStore) => objectStore.delete(key));
}

async function deleteUidFromStore(storeName: StoreName, uid: string) {
  const db = await openBoardSignalOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        const value = item.value as { uid?: string };
        if (value.uid === uid) item.delete();
        item.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("BoardSignal offline cleanup failed."));
    });
  } finally { db.close(); }
}

export async function clearBoardSignalPrivateOfflineData(uid: string) {
  if (!uid.trim()) return;
  await Promise.all(STORES.map((store) => deleteUidFromStore(store, uid)));
}

export async function clearBoardSignalOfflineDataOnDevice() {
  if (typeof window === "undefined") return;
  if ("indexedDB" in window) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(BOARDSIGNAL_OFFLINE_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("boardsignal-")).map((key) => caches.delete(key)));
  }
}
