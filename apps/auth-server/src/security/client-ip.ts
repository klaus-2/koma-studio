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

  return isIP(normalized) !== 0 ? normalized : "";
};

const isPrivateOrLoopbackIpv4 = (address: string): boolean => {
  const [first = -1, second = -1] = address.split(".").map((part) => Number(part));
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

/**
 * Loopback or RFC1918/link-local peer. Used as the default "is this hop a
 * reverse proxy we control" test: a directly exposed client can never pass
 * it, so forwarded headers are ignored until a local proxy adds them.
 */
export const isPrivateOrLoopbackAddress = (address: string): boolean => {
  const normalized = trimIpCandidate(address).toLowerCase();
  if (!normalized) {
    return false;
  }

  const family = isIP(normalized);
  if (family === 4) {
    return isPrivateOrLoopbackIpv4(normalized);
  }
  if (family === 6) {
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }
  return false;
};

export type TrustProxySetting = boolean | number | ((address: string) => boolean);

/**
 * `TRUST_PROXY`:
 * - unset/`auto` (default): trust a single hop only when the socket peer is
 *   loopback/private, i.e. the documented nginx/Caddy deployment. A client
 *   connecting straight to the server has a public peer, so its
 *   `X-Forwarded-For` is ignored.
 * - `false`/`0`: never trust forwarding headers.
 * - `true`: trust every hop (only for deployments where the origin is
 *   unreachable except through the proxy chain).
 * - a positive integer (including `1`): trust that many hops, exactly like
 *   Express.
 */
export const resolveTrustProxy = (rawValue: string | undefined): TrustProxySetting => {
  const value = (rawValue ?? "").trim().toLowerCase();
  if (!value || value === "auto") {
    return isPrivateOrLoopbackAddress;
  }
  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }
  if (["true", "yes", "on"].includes(value)) {
    return true;
  }
  const hops = Number(value);
  if (Number.isSafeInteger(hops) && hops > 0) {
    return hops;
  }
  return isPrivateOrLoopbackAddress;
};

/**
 * Client address derived from Express's `req.ip`, which applies the
 * `trust proxy` policy above. Forwarded headers are never parsed here: with a
 * direct connection the socket address wins, and behind a trusted proxy the
 * rightmost hop that proxy appended wins (the client-supplied prefix cannot).
 */
export const getClientIp = (request: Request): string => {
  const resolved = trimIpCandidate(request.ip ?? "");
  if (resolved) {
    return resolved;
  }

  const socketIp = trimIpCandidate(request.socket?.remoteAddress ?? "");
  return socketIp || "unknown";
};
