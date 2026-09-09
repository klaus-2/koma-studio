/**
 * Deep link handling module.
 * Extracted from electron/main.ts during God File decomposition.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_PROTOCOL = "komastudio";

// ---------------------------------------------------------------------------
// Deep link parsing
// ---------------------------------------------------------------------------

const extractDeepLinkFromArgv = (argv: string[]): string | null => {
  const safeDecode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const normalizeDeepLink = (value: string): string | null => {
    const trimmed = value.replace(/^"+|"+$/g, "");
    const lower = trimmed.toLowerCase();
    const schemeIndex = lower.indexOf(`${APP_PROTOCOL}:`);
    if (schemeIndex < 0) {
      return null;
    }

    let candidate = trimmed.slice(schemeIndex);
    candidate = safeDecode(candidate);
    candidate = safeDecode(candidate);

    if (/^komastudio:(?!\/\/)/i.test(candidate)) {
      candidate = candidate.replace(/^komastudio:/i, "komastudio://");
    }

    return candidate;
  };

  for (const rawArg of argv) {
    if (typeof rawArg !== "string") {
      continue;
    }

    const normalized = normalizeDeepLink(rawArg);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const deepLinkToHashRoute = (urlValue: string): string | null => {
  try {
    const parsed = new URL(urlValue);
    const route = (parsed.pathname.replace(/^\/+/, "") || parsed.hostname || "").trim();
    if (!route) {
      return null;
    }
    const query = parsed.searchParams.toString();
    return `/${route}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
};

const formatDeepLinkForLog = (urlValue: string): string => {
  try {
    const parsed = new URL(urlValue);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "<invalid-deep-link>";
  }
};

// ---------------------------------------------------------------------------
// Deep link navigation
// ---------------------------------------------------------------------------

interface DeepLinkDeps {
  getMainWindow: () => import("electron").BrowserWindow | null;
}

const navigateFromDeepLink = (urlValue: string, deps: DeepLinkDeps): void => {
  const hashRoute = deepLinkToHashRoute(urlValue);
  const mainWindow = deps.getMainWindow();
  if (!hashRoute || !mainWindow) {
    return;
  }

  const currentUrl = mainWindow.webContents.getURL();
  if (!currentUrl) {
    return;
  }

  try {
    const nextUrl = new URL(currentUrl);
    nextUrl.hash = hashRoute;
    void mainWindow.loadURL(nextUrl.toString());
  } catch {
    console.warn(`[deep-link] Failed to navigate from deep link: ${urlValue}`);
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  APP_PROTOCOL,
  type DeepLinkDeps,
  extractDeepLinkFromArgv,
  deepLinkToHashRoute,
  formatDeepLinkForLog,
  navigateFromDeepLink,
};
