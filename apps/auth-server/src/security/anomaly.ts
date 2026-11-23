import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "../db/client.js";
import { securityLog, user } from "../db/schema.js";
import { redisClient } from "../services/redis.js";
import { logger } from "../utils/logger.js";

export interface AnomalyCheck {
  isAnomalous: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  severity: "low" | "medium" | "high" | "critical";
}

const normalizeIpAddress = (ipAddress: string): string => {
  const value = ipAddress.trim().toLowerCase();

  if (
    value === "::1" ||
    value === "127.0.0.1" ||
    value === "::ffff:127.0.0.1" ||
    value === "localhost"
  ) {
    return "loopback";
  }

  if (value.startsWith("::ffff:")) {
    return value.slice("::ffff:".length);
  }

  return value;
};

export const recordSecurityLog = async (
  userId: string,
  action: string,
  severity: "info" | "warning" | "critical",
  ipAddress: string,
  userAgent: string,
  metadata: Record<string, unknown> = {},
): Promise<void> => {
  await db.insert(securityLog).values({
    id: randomUUID(),
    userId,
    action,
    severity,
    ipAddress,
    userAgent,
    metadata,
  });
};

export const detectLoginAnomaly = async (
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<AnomalyCheck> => {
  const normalizedIp = normalizeIpAddress(ipAddress);
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const recentIpsKey = `user:${userId}:recent-ips`;
  const lastLoginKey = `user:${userId}:last-login`;

  let uniqueIps: string[] = [];
  let lastLogin: {
    ip?: string;
    userAgent?: string;
    timestamp?: string;
  } = {};

  if (redisUsable()) {
    try {
      await redisClient.zAdd(recentIpsKey, {
        score: now,
        value: normalizedIp,
      });

      await redisClient.zRemRangeByScore(recentIpsKey, 0, oneHourAgo);

      uniqueIps = await redisClient.zRange(recentIpsKey, 0, -1);
      lastLogin = await redisClient.hGetAll(lastLoginKey);
    } catch {
      uniqueIps = [];
      lastLogin = {};
    }
  } else {
    const ips = memoryRecentIps.get(userId) ?? new Map<string, number>();
    ips.set(normalizedIp, now);
    for (const [ip, score] of ips) {
      if (score <= oneHourAgo) {
        ips.delete(ip);
      }
    }
    memoryRecentIps.set(userId, ips);
    uniqueIps = [...ips.keys()];

    const stored = memoryLastLogin.get(userId);
    lastLogin = stored
      ? { ip: stored.ip, userAgent: stored.userAgent, timestamp: stored.timestamp }
      : {};
  }

  if (uniqueIps.length > 5) {
    await recordSecurityLog(userId, "anomaly_multiple_ips", "warning", ipAddress, userAgent, {
      uniqueIps: uniqueIps.length,
    });

    return {
      isAnomalous: true,
      reason: "Muitos IPs em um periodo curto",
      severity: "high",
    };
  }

  if (lastLogin.ip && lastLogin.ip !== normalizedIp && lastLogin.timestamp) {
    const previousTimestamp = Number(lastLogin.timestamp);
    if (Number.isFinite(previousTimestamp)) {
      const delta = now - previousTimestamp;
      if (delta < 10 * 60 * 1000) {
        const retryAfterSeconds = Math.max(1, Math.ceil((10 * 60 * 1000 - delta) / 1000));
        await recordSecurityLog(userId, "anomaly_impossible_travel", "critical", ipAddress, userAgent, {
          previousIp: lastLogin.ip,
          currentIp: normalizedIp,
          deltaSeconds: Math.floor(delta / 1000),
        });

        return {
          isAnomalous: true,
          reason: "Troca de IP em intervalo impossivel",
          retryAfterSeconds,
          severity: "critical",
        };
      }
    }
  }

  if (lastLogin.userAgent && lastLogin.userAgent !== userAgent) {
    await recordSecurityLog(userId, "anomaly_user_agent_change", "warning", ipAddress, userAgent, {
      previousUserAgent: lastLogin.userAgent,
    });

    return {
      isAnomalous: true,
      reason: "Mudanca de dispositivo detectada",
      severity: "medium",
    };
  }

  if (redisUsable()) {
    try {
      await redisClient.hSet(lastLoginKey, {
        ip: normalizedIp,
        userAgent,
        timestamp: String(now),
      });
    } catch {
    }
  } else {
    memoryLastLogin.set(userId, {
      ip: normalizedIp,
      userAgent,
      timestamp: String(now),
    });
  }

  return {
    isAnomalous: false,
    severity: "low",
  };
};

export interface FailedLoginCounts {
  account: number;
  client: number;
}

const failedAccountKey = (email: string): string => `login:failed:account:${email}`;
const failedClientKey = (email: string, ipAddress: string): string =>
  `login:failed:client:${email}:${ipAddress}`;

const FAILED_LOGIN_TTL_MS = 15 * 60 * 1000;

interface MemoryCounter {
  count: number;
  expiresAt: number;
}

const memoryCounters = new Map<string, MemoryCounter>();
const memoryRecentIps = new Map<string, Map<string, number>>();
const memoryLastLogin = new Map<
  string,
  { ip: string; userAgent: string; timestamp: string }
>();

const bumpMemoryCounter = (key: string): number => {
  const now = Date.now();
  const entry = memoryCounters.get(key);
  const count = entry && entry.expiresAt > now ? entry.count + 1 : 1;
  memoryCounters.set(key, {
    count,
    expiresAt: now + FAILED_LOGIN_TTL_MS,
  });
  return count;
};

const readMemoryCounter = (key: string): number => {
  const entry = memoryCounters.get(key);
  if (!entry) return 0;
  if (entry.expiresAt <= Date.now()) {
    memoryCounters.delete(key);
    return 0;
  }
  return entry.count;
};

const clearMemoryCounter = (key: string): void => {
  memoryCounters.delete(key);
};

const redisUsable = (): boolean => redisClient.isReady;

/**
 * Counts a failure twice: per account (so rotating the source address cannot
 * reset the brute-force threshold) and per (account, client) (so the 423 gate
 * can be scoped to the client that actually failed).
 */
export const increaseFailedLoginAttempts = async (
  email: string,
  ipAddress: string,
): Promise<FailedLoginCounts> => {
  const accountKey = failedAccountKey(email);
  const clientKey = failedClientKey(email, ipAddress);

  if (redisUsable()) {
    try {
      const [account, client] = await Promise.all([
        redisClient.incr(accountKey),
        redisClient.incr(clientKey),
      ]);
      await Promise.all([
        redisClient.expire(accountKey, 15 * 60),
        redisClient.expire(clientKey, 15 * 60),
      ]);
      return { account, client };
    } catch {
    }
  }

  return {
    account: bumpMemoryCounter(accountKey),
    client: bumpMemoryCounter(clientKey),
  };
};

export const clearFailedLoginAttempts = async (email: string, ipAddress: string): Promise<void> => {
  const keys = [failedAccountKey(email), failedClientKey(email, ipAddress)];

  if (redisUsable()) {
    try {
      await Promise.all(
        keys.map((key) => redisClient.del(key)),
      );
    } catch {
    }
  }

  for (const key of keys) {
    clearMemoryCounter(key);
  }
};

export const getFailedLoginAttempts = async (email: string, ipAddress: string): Promise<number> => {
  const key = failedClientKey(email, ipAddress);

  if (redisUsable()) {
    try {
      const raw = await redisClient.get(key);
      if (raw !== null) {
        return Number(raw);
      }
    } catch {
    }
  }

  return readMemoryCounter(key);
};

export const updateUserLoginMeta = async (
  userId: string,
  ipAddress: string,
  successful: boolean,
): Promise<void> => {
  if (!successful) {
    await db
      .update(user)
      .set({
        failedLoginAttempts: sql`${user.failedLoginAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return;
  }

  await db
    .update(user)
    .set({
      failedLoginAttempts: 0,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  logger.info("User login metadata updated", { userId, ipAddress });
};

export const findUserByEmail = async (email: string) => {
  const [existingUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  return existingUser ?? null;
};

export const isUserLocked = (lockedUntil: Date | null | undefined): boolean => {
  if (!lockedUntil) {
    return false;
  }

  return lockedUntil.getTime() > Date.now();
};

export const lockUserForBruteForce = async (userId: string, lockMinutes: number): Promise<void> => {
  const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
  await db
    .update(user)
    .set({
      accountLockedUntil: lockUntil,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  await recordSecurityLog(
    userId,
    "account_locked_bruteforce",
    "critical",
    "unknown",
    "unknown",
    { lockMinutes },
  );
};

export const clearUserLock = async (userId: string): Promise<void> => {
  await db
    .update(user)
    .set({
      accountLockedUntil: null,
      failedLoginAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
};
