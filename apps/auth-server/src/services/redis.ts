import { createClient } from "redis";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let redisErrorLoggedAt = 0;
let redisErrorCount = 0;
const REDIS_ERROR_THROTTLE_MS = 30_000;

export const redisClient = createClient({
  url: env.redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (env.nodeEnv !== "production" && retries > 5) {
        return new Error("Redis reconnect limit reached in development - giving up");
      }
      return Math.min(retries * 200, 3_000);
    },
  },
  disableOfflineQueue: true,
});

redisClient.on("error", (error) => {
  const now = Date.now();
  redisErrorCount += 1;
  if (now - redisErrorLoggedAt < REDIS_ERROR_THROTTLE_MS && redisErrorCount % 10 !== 0) {
    return;
  }
  redisErrorLoggedAt = now;
  const level = env.nodeEnv === "production" ? "error" : "warn";
  const logFn = level === "error" ? logger.error.bind(logger) : logger.warn.bind(logger);
  logFn("Redis unavailable", { error: error.message, count: redisErrorCount });
});

redisClient.on("connect", () => {
  logger.info("Redis connected");
  redisErrorCount = 0;
});

redisClient.on("end", () => {
  if (env.nodeEnv !== "production") {
    logger.warn("Redis connection closed - using memory fallback");
  }
});

export const connectRedis = async (): Promise<void> => {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (error) {
      logger.warn("Redis connect failed, running without Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
};
