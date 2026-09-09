import type { TypographySession } from "./types";

const DB_NAME = "koma-typography-db";
const DB_VERSION = 1;
const STORE_NAME = "sessions";
const FALLBACK_STORAGE_KEY = "koma-typography-sessions-fallback-v1";

const openDatabase = async (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "imageFingerprint" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
};

const cloneSession = (session: TypographySession): TypographySession =>
  typeof structuredClone === "function"
    ? structuredClone(session)
    : JSON.parse(JSON.stringify(session)) as TypographySession;

const readFallbackStore = (): Record<string, TypographySession> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, TypographySession> : {};
  } catch {
    return {};
  }
};

const writeFallbackStore = (data: Record<string, TypographySession>): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(data));
};

export const buildTypographyImageFingerprint = (
  payload: {
    name: string;
    size: number;
    lastModified: number;
    width: number;
    height: number;
  },
): string => `${payload.name}::${payload.size}::${payload.lastModified}::${payload.width}x${payload.height}`;

export const loadTypographySession = async (imageFingerprint: string): Promise<TypographySession | null> => {
  const db = await openDatabase();
  if (!db) {
    const fallback = readFallbackStore();
    return fallback[imageFingerprint] ? cloneSession(fallback[imageFingerprint]!) : null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(imageFingerprint);
    request.onsuccess = () => resolve(request.result ? cloneSession(request.result as TypographySession) : null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
};

export const saveTypographySession = async (session: TypographySession): Promise<void> => {
  const db = await openDatabase();
  if (!db) {
    const fallback = readFallbackStore();
    fallback[session.imageFingerprint] = cloneSession(session);
    writeFallbackStore(fallback);
    return;
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(cloneSession(session));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
};
