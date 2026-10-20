/**
 * Desktop auth cookie helpers (domain match + clear/check).
 */
import { type Cookie, type Session } from "electron";
import { normalizeHost } from "./shared.ts";

const normalizeCookieDomain = (value: string): string => value.replace(/^\./, "").trim().toLowerCase();

const cookieMatchesHost = (cookieDomain: string, host: string): boolean => {
  const normalizedCookieDomain = normalizeCookieDomain(cookieDomain);
  if (!normalizedCookieDomain || !host) {
    return false;
  }

  return normalizedCookieDomain === host || host.endsWith(`.${normalizedCookieDomain}`);
};

const buildCookieRemovalUrl = (cookie: Cookie): string | null => {
  const cookieHost = normalizeCookieDomain(cookie.domain ?? "");
  if (!cookieHost) {
    return null;
  }

  const protocol = cookie.secure ? "https" : "http";
  const cookiePath = cookie.path && cookie.path.startsWith("/") ? cookie.path : "/";
  return `${protocol}://${cookieHost}${cookiePath}`;
};

const clearDesktopAuthCookies = async (
  authApiUrl: string,
  sessionClient: Session,
): Promise<void> => {
  let authHost = "";
  try {
    authHost = normalizeHost(new URL(authApiUrl).hostname);
  } catch {
    return;
  }

  if (!authHost) {
    return;
  }

  const cookies = await sessionClient.cookies.get({});
  const authCookies = cookies.filter((cookie) => cookieMatchesHost(cookie.domain ?? "", authHost));
  await Promise.all(
    authCookies.map(async (cookie) => {
      const removalUrl = buildCookieRemovalUrl(cookie);
      if (!removalUrl) {
        return;
      }

      try {
        await sessionClient.cookies.remove(removalUrl, cookie.name);
      } catch {
        console.warn("[desktop] Failed to remove auth cookie:", cookie.name);
      }
    }),
  );
};

const hasDesktopAuthCookie = async (
  authApiUrl: string,
  sessionClient: Session,
): Promise<boolean> => {
  let authHost = "";
  try {
    authHost = normalizeHost(new URL(authApiUrl).hostname);
  } catch {
    return false;
  }

  if (!authHost) {
    return false;
  }

  const cookies = await sessionClient.cookies.get({});
  return cookies.some((cookie) => cookieMatchesHost(cookie.domain ?? "", authHost));
};

export { clearDesktopAuthCookies, hasDesktopAuthCookie };
