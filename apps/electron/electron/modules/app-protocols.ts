/**
 * Internal/external app protocol constants.
 */
const APP_PROTOCOL = "komastudio";
const INTERNAL_APP_PROTOCOL = "app";
const INTERNAL_APP_HOST = "local";
const INTERNAL_APP_ORIGIN = `${INTERNAL_APP_PROTOCOL}://${INTERNAL_APP_HOST}`;
const INTERNAL_APP_ENTRY_URL = `${INTERNAL_APP_ORIGIN}/index.html`;

const resolveRendererCorsOrigin = (currentUrl: string, fallbackOrigin: string): string => {
  try {
    const parsed = new URL(currentUrl);
    if (parsed.protocol === `${INTERNAL_APP_PROTOCOL}:` && parsed.hostname === INTERNAL_APP_HOST) {
      return fallbackOrigin;
    }

    if (parsed.origin && parsed.origin !== "null") {
      return parsed.origin;
    }
  } catch {
    // fall through to the fallback origin
  }

  return fallbackOrigin;
};

export {
  APP_PROTOCOL,
  INTERNAL_APP_ENTRY_URL,
  INTERNAL_APP_HOST,
  INTERNAL_APP_ORIGIN,
  INTERNAL_APP_PROTOCOL,
  resolveRendererCorsOrigin,
};
