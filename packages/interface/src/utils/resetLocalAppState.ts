const STORAGE_PREFIXES = ["koma", "auth:", "updater-", "discord-rpc-"] as const;

const shouldRemoveKey = (key: string): boolean =>
  STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));

const clearStorageBucket = (storage: Storage): number => {
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !shouldRemoveKey(key)) {
      continue;
    }
    keysToRemove.push(key);
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
  return keysToRemove.length;
};

export interface ClearedRendererAppState {
  localStorageKeys: number;
  sessionStorageKeys: number;
}

export const clearRendererStoredAppState = (): ClearedRendererAppState => {
  if (typeof window === "undefined") {
    return { localStorageKeys: 0, sessionStorageKeys: 0 };
  }

  let clearedLocalStorageKeys = 0;
  let clearedSessionStorageKeys = 0;

  try {
    clearedLocalStorageKeys = clearStorageBucket(window.localStorage);
  } catch {
    clearedLocalStorageKeys = 0;
  }

  try {
    clearedSessionStorageKeys = clearStorageBucket(window.sessionStorage);
  } catch {
    clearedSessionStorageKeys = 0;
  }

  return {
    localStorageKeys: clearedLocalStorageKeys,
    sessionStorageKeys: clearedSessionStorageKeys,
  };
};
