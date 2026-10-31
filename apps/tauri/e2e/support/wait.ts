/**
 * Polls `probe` until it returns a non-null value or the timeout elapses.
 * `timeoutMessage` may be a factory so callers can include state captured
 * during polling (e.g. the last observed status).
 */
export const pollUntil = async <T>(
  probe: () => T | null,
  timeoutMs: number,
  timeoutMessage: string | (() => string),
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = probe();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    typeof timeoutMessage === "string" ? timeoutMessage : timeoutMessage(),
  );
};
