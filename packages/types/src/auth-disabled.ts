const TRUTHY_VALUES = new Set(["true", "1", "yes"]);
const FALSY_VALUES = new Set(["false", "0", "no"]);

/**
 * Reads the `VITE_AUTH_DISABLED` lever, which has three states rather than two.
 * An explicit value always wins, in either direction. When nothing defines it,
 * `fallbackDisabled` decides: a repo checkout (dev server, unpackaged shell)
 * runs in local mode so a first launch does not need the auth server, while a
 * packaged build keeps login and the community feed pointed at a real auth
 * server instead of silently turning the bypass on.
 */
export const isAuthDisabledFlag = (
  raw: string | undefined,
  fallbackDisabled: boolean,
): boolean => {
  const value = (raw ?? "").trim().toLowerCase();
  if (TRUTHY_VALUES.has(value)) {
    return true;
  }
  if (FALSY_VALUES.has(value)) {
    return false;
  }
  return fallbackDisabled;
};
