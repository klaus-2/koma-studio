export const SENSITIVE_RESPONSE_VARY_HEADERS = [
  "Origin",
  "Cookie",
  "Authorization",
  "X-Desktop-Client-Token",
  "X-Desktop-Session-Id",
  "X-Desktop-Device-Id",
] as const;

interface HeaderTarget {
  getHeader(name: string): unknown;
  setHeader(name: string, value: string): void;
}

const parseHeaderList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseHeaderList(entry));
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const applySensitiveResponseHeaders = (target: HeaderTarget): void => {
  target.setHeader("Cache-Control", "no-store, max-age=0");
  target.setHeader("Pragma", "no-cache");
  target.setHeader("Expires", "0");

  const varyEntries = new Map<string, string>();
  for (const value of parseHeaderList(target.getHeader("Vary"))) {
    varyEntries.set(value.toLowerCase(), value);
  }

  for (const headerName of SENSITIVE_RESPONSE_VARY_HEADERS) {
    varyEntries.set(headerName.toLowerCase(), headerName);
  }

  target.setHeader("Vary", Array.from(varyEntries.values()).join(", "));
};
