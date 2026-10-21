/**
 * JSON-safe deep clone shared by the workspace serialization layer and the
 * colocated special-tool document codecs. Falls back from structuredClone to
 * a JSON round-trip (dropping functions and the window global) exactly like
 * the pre-extraction private helper.
 */
export const jsonSafeClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to the JSON-safe clone path below.
    }
  }

  return JSON.parse(
    JSON.stringify(value, (_key, entry) => {
      if (typeof entry === "function") {
        return undefined;
      }
      if (typeof window !== "undefined" && entry === window) {
        return undefined;
      }
      return entry;
    }),
  ) as T;
};
