import { redisClient } from "../services/redis.js";

const TOKEN_BLOCKLIST_PREFIX = "bl:token:";

// Local cache for user-level revocation (30s TTL)
const _userRevokedCache = new Map<string, { revoked: boolean; expiresAt: number }>();
const USER_REVOKED_CACHE_TTL_MS = 30_000;

export const isTokenRevoked = async (sessionId: string): Promise<boolean> => {
  if (!redisClient.isOpen) {
    return true; // fail-closed: treat as revoked when Redis unavailable
  }
  try {
    const key = `${TOKEN_BLOCKLIST_PREFIX}${sessionId}`;
    const result = await redisClient.get(key);
    return result === "1";
  } catch {
    return true; // fail-closed on Redis error
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

  if (!redisClient.isOpen) {
    return true; // fail-closed: treat as revoked when Redis unavailable
  }

  try {
    const key = `${TOKEN_BLOCKLIST_PREFIX}user:${userId}`;
    const result = await redisClient.get(key);
    const revoked = result === "1";
    _userRevokedCache.set(userId, { revoked, expiresAt: Date.now() + USER_REVOKED_CACHE_TTL_MS });
    return revoked;
  } catch {
    return true; // fail-closed on Redis error
  }
};
