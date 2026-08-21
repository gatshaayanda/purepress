const PUREPRESS_OFFLINE_DB_NAME = "purepress-private-v1";
const PUREPRESS_OFFLINE_DB_VERSION = 1;
const STORES = ["meta", "orders", "messages"] as const;
type StoreName = (typeof STORES)[number];

export interface PurePressOfflineRecord<T> {
  key: string;
  uid: string;
  value: T;
  savedAt: number;
}

function ensureBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("PurePress private offline storage is unavailable in this browser.");
  }
}

export function purePressOfflineKey(uid: string, kind: string, id = "current") {
  const normalizedUid = uid.trim();
  if (!normalizedUid) throw new Error("A Firebase UID is required for PurePress private offline storage.");
  return `${normalizedUid}:${kind}:${id}`;
}

async function openPurePressOfflineDb(): Promise<IDBDatabase> {
  ensureBrowser();
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(PUREPRESS_OFFLINE_DB_NAME, PUREPRESS_OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("PurePress private offline storage could not be opened."));
  });
}

async function transaction<T>(storeName: StoreName, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openPurePressOfflineDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = work(tx.objectStore(storeName));
      let result!: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error("PurePress offline operation failed."));
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error("PurePress offline transaction failed."));
      tx.onabort = () => reject(tx.error ?? new Error("PurePress offline transaction was cancelled."));
    });
  } finally {
    db.close();
  }
}

export async function putPurePressOfflineRecord<T>(store: StoreName, record: PurePressOfflineRecord<T>) {
  if (!record.uid.trim() || !record.key.startsWith(`${record.uid}:`)) throw new Error("PurePress offline records must be UID-scoped.");
  await transaction(store, "readwrite", (objectStore) => objectStore.put(record));
}

export async function getPurePressOfflineRecord<T>(store: StoreName, key: string, expectedUid: string) {
  const record = await transaction<PurePressOfflineRecord<T> | undefined>(store, "readonly", (objectStore) => objectStore.get(key));
  return record?.uid === expectedUid ? record : undefined;
}

async function deleteUidFromStore(storeName: StoreName, uid: string) {
  const db = await openPurePressOfflineDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const cursor = tx.objectStore(storeName).openCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        if ((current.value as { uid?: string }).uid === uid) current.delete();
        current.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("PurePress offline cleanup failed."));
    });
  } finally {
    db.close();
  }
}

export async function clearPurePressPrivateOfflineData(uid: string) {
  if (!uid.trim()) return;
  await Promise.all(STORES.map((store) => deleteUidFromStore(store, uid)));
}

export async function clearPurePressPrivateDataOnLogout(uid: string) {
  await clearPurePressPrivateOfflineData(uid);
}

export async function clearPurePressPrivateDataOnAccountDeletion(uid: string) {
  await clearPurePressPrivateOfflineData(uid);
}

export async function handlePurePressAccountChange(previousUid: string | null | undefined, nextUid: string | null | undefined) {
  if (previousUid?.trim() && previousUid !== nextUid) await clearPurePressPrivateOfflineData(previousUid);
}

export async function clearPurePressOfflineDataOnDevice() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(PUREPRESS_OFFLINE_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
