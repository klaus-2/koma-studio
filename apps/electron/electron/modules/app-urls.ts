/**
 * Loopback URL + configured port helpers.
 */
const normalizeLoopbackUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.trim().toLowerCase() !== "localhost") {
      return rawUrl;
    }

    parsed.hostname = "127.0.0.1";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return rawUrl;
  }
};

const parseConfiguredPort = (rawUrl: string | null): number | null => {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return null;
    }
    return port;
  } catch {
    return null;
  }
};

export { normalizeLoopbackUrl, parseConfiguredPort };
