/**
 * Normalizes a rejected Tauri command into an `Error`.
 *
 * A Tauri command's `Err` payload crosses the bridge as whatever it serializes
 * to, not as an `Error`: `Result<_, String>` arrives as a plain string and a
 * tagged enum such as `DesktopError` arrives as `{"code": "…"}`. Every caller
 * that reports a failure with `error instanceof Error ? error.message : …`
 * therefore loses the cause for the whole desktop path — sign-in, register and
 * password reset included.
 */
export const toBridgeRejectionError = (rejection: unknown): Error => {
  if (rejection instanceof Error) {
    return rejection;
  }
  if (typeof rejection === "string") {
    return new Error(rejection);
  }
  if (rejection === null || rejection === undefined) {
    return new Error("");
  }
  return new Error(JSON.stringify(rejection));
};
