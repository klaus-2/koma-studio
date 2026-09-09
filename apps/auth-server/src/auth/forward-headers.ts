import type { IncomingHttpHeaders } from "node:http";

const BLOCKED_FORWARD_HEADERS = new Set([
  "authorization",
  "x-desktop-client-token",
  "x-desktop-session-id",
  "x-desktop-device-id",
  "x-desktop-bootstrap-secret",
  "x-desktop-device-key",
  "x-desktop-travel-token",
]);

type ForwardHeaderValue = string | string[] | undefined;
type ForwardHeaderSource = Headers | IncomingHttpHeaders | Record<string, ForwardHeaderValue>;

export interface AuthForwardHeadersOptions {
  includeCookie?: boolean;
  includeOrigin?: boolean;
  includeUserAgent?: boolean;
  includeAcceptLanguage?: boolean;
  includeIpHeaders?: boolean;
  extraAllowedHeaders?: string[];
}

const normalizeHeaderValue = (value: ForwardHeaderValue | null): string | null => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(", ");
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
};

const readSourceHeader = (source: ForwardHeaderSource, name: string): string | null => {
  if (source instanceof Headers) {
    return normalizeHeaderValue(source.get(name));
  }

  const normalizedName = name.toLowerCase();
  const value =
    source[normalizedName] ??
    source[name] ??
    source[name.toUpperCase() as keyof typeof source];

  return normalizeHeaderValue(value ?? null);
};

const appendAllowedHeader = (target: Headers, source: ForwardHeaderSource, name: string): void => {
  if (BLOCKED_FORWARD_HEADERS.has(name)) {
    return;
  }

  const value = readSourceHeader(source, name);
  if (value) {
    target.set(name, value);
  }
};

export const buildAuthForwardHeaders = (
  source: ForwardHeaderSource,
  options: AuthForwardHeadersOptions = {},
): Headers => {
  const headers = new Headers();

  if (options.includeOrigin !== false) {
    appendAllowedHeader(headers, source, "origin");
  }

  if (options.includeUserAgent !== false) {
    appendAllowedHeader(headers, source, "user-agent");
  }

  if (options.includeAcceptLanguage !== false) {
    appendAllowedHeader(headers, source, "accept-language");
  }

  if (options.includeIpHeaders !== false) {
    appendAllowedHeader(headers, source, "cf-connecting-ip");
    appendAllowedHeader(headers, source, "x-real-ip");
    appendAllowedHeader(headers, source, "x-forwarded-for");
  }

  if (options.includeCookie === true) {
    appendAllowedHeader(headers, source, "cookie");
  }

  for (const headerName of options.extraAllowedHeaders ?? []) {
    appendAllowedHeader(headers, source, headerName.toLowerCase());
  }

  return headers;
};
