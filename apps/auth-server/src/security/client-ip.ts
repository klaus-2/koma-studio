import { isIP } from "node:net";

import type { Request } from "express";

const trimIpCandidate = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1).trim();
  }

  if (normalized.startsWith("::ffff:")) {
    const maybeIpv4 = normalized.slice("::ffff:".length);
    if (isIP(maybeIpv4) === 4) {
      return maybeIpv4;
    }
  }

  if (isIP(normalized) !== 0) {
    return normalized;
  }

  // Handle IPv4 addresses that may include port (e.g. 203.0.113.4:54321).
  const lastColonIndex = normalized.lastIndexOf(":");
  if (lastColonIndex > 0) {
    const maybeIpv4 = normalized.slice(0, lastColonIndex);
    if (isIP(maybeIpv4) === 4) {
      return maybeIpv4;
    }
  }

  return normalized;
};

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized !== "string") {
    return null;
  }

  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractForwardedIp = (headerValue: string | null): string | null => {
  if (!headerValue) {
    return null;
  }

  const candidates = headerValue
    .split(",")
    .map((entry) => trimIpCandidate(entry))
    .filter((entry) => entry.length > 0);

  for (const candidate of candidates) {
    if (isIP(candidate) !== 0) {
      return candidate;
    }
  }

  return null;
};

export const getClientIp = (request: Request): string => {
  const headers = request.headers ?? {};
  const cfConnectingIp = trimIpCandidate(
    readHeaderValue(headers["cf-connecting-ip"] as string | string[] | undefined) ?? "",
  );
  if (isIP(cfConnectingIp) !== 0) {
    return cfConnectingIp;
  }

  const xRealIp = trimIpCandidate(
    readHeaderValue(headers["x-real-ip"] as string | string[] | undefined) ?? "",
  );
  if (isIP(xRealIp) !== 0) {
    return xRealIp;
  }

  const xForwardedFor = extractForwardedIp(
    readHeaderValue(headers["x-forwarded-for"] as string | string[] | undefined),
  );
  if (xForwardedFor) {
    return xForwardedFor;
  }

  const requestIp = trimIpCandidate(request.ip ?? "");
  if (isIP(requestIp) !== 0) {
    return requestIp;
  }

  const socketIp = trimIpCandidate(request.socket?.remoteAddress ?? "");
  if (isIP(socketIp) !== 0) {
    return socketIp;
  }

  return "unknown";
};
