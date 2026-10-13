import { redisClient } from "../services/redis.js";
import { logger } from "../utils/logger.js";

const TOKEN_BLOCKLIST_PREFIX = "bl:token:";

// Local cache for user-level revocation (30s TTL)
const _userRevokedCache = new Map<string, { revoked: boolean; expiresAt: number }>();
const USER_REVOKED_CACHE_TTL_MS = 30_000;

const FAIL_OPEN_LOG_INTERVAL_MS = 2_000;
const lastFailOpenLoggedAt = new Map<string, number>();

const logFailOpen = (reason: string, detail?: string): void => {
  const now = Date.now();
  const last = lastFailOpenLoggedAt.get(reason);
  if (last !== undefined && now >= last && now - last < FAIL_OPEN_LOG_INTERVAL_MS) {
    return;
  }
  lastFailOpenLoggedAt.set(reason, now);
  logger.warn("Token blocklist unavailable - failing open, revocation check skipped", {
    reason,
    detail,
  });
};

export const isTokenRevoked = async (sessionId: string): Promise<boolean> => {
  if (!redisClient.isReady) {
    logFailOpen("token-check-unavailable");
    return false;
  }
  try {
    const key = `${TOKEN_BLOCKLIST_PREFIX}${sessionId}`;
    const result = await redisClient.get(key);
    return result === "1";
  } catch (error) {
    logFailOpen("token-check-failed", error instanceof Error ? error.message : String(error));
    return false;
  }
};

export const revokeToken = async (sessionId: string, ttlSeconds: number): Promise<void> => {
  if (!redisClient.isOpen) {
    return;
  }
  const key = `${TOKEN_BLOCKLIST_PREFIX}${sessionId}`;
  await redisClient.set(key, "1", { EX: ttlSeconds });
};

export const revokeAllUserTokens = async (userId: string, ttlSeconds: number): Promise<void> => {
  if (!redisClient.isOpen) {
    return;
  }
  const key = `${TOKEN_BLOCKLIST_PREFIX}user:${userId}`;
  await redisClient.set(key, "1", { EX: ttlSeconds });
  _userRevokedCache.delete(userId);
};

export const isUserTokenRevoked = async (userId: string): Promise<boolean> => {
  const cached = _userRevokedCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.revoked;
  }

  if (!redisClient.isReady) {
    logFailOpen("user-token-check-unavailable");
    return false;
  }

  try {
    const key = `${TOKEN_BLOCKLIST_PREFIX}user:${userId}`;
    const result = await redisClient.get(key);
    const revoked = result === "1";
    _userRevokedCache.set(userId, { revoked, expiresAt: Date.now() + USER_REVOKED_CACHE_TTL_MS });
    return revoked;
  } catch (error) {
    logFailOpen("user-token-check-failed", error instanceof Error ? error.message : String(error));
    return false;
  }
};
