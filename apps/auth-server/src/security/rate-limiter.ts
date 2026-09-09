import type { Request, Response } from "express";
import rateLimit, { MemoryStore } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import { env } from "../config/env.js";
import { redisClient } from "../services/redis.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";

const createStore = (prefix: string) => {
  if (env.nodeEnv !== "production") {
    return new MemoryStore();
  }
  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return redisClient.sendCommand(args);
    },
  });
};

const createLocalizedRateLimitHandler =
  (translationKey: string) =>
  (req: Request, res: Response): void => {
    const locale = resolveLocaleFromHeaders(req.headers);
    res.status(429).json({ error: tServer(locale, translationKey) });
  };

export const generalLimiter = rateLimit({
  store: createStore("rl:general:"),
  windowMs: env.rateLimitWindow,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.general"),
});

export const loginLimiter = rateLimit({
  store: createStore("rl:login:"),
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === "production" ? 5 : 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.login"),
});

export const registerLimiter = rateLimit({
  store: createStore("rl:register:"),
  windowMs: 60 * 60 * 1000,
  max: env.nodeEnv === "production" ? 3 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.register"),
});

export const desktopBootstrapLimiter = rateLimit({
  store: createStore("rl:desktop-bootstrap:"),
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 6 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.desktopBootstrap"),
});

export const dashboardLaunchLimiter = rateLimit({
  store: createStore("rl:dashboard-launch:"),
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 8 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.dashboardLaunch"),
});

export const modelReviewMutationLimiter = rateLimit({
  store: createStore("rl:model-review-mutation:"),
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 12 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.modelReviewMutation"),
});

export const imageLimiter = rateLimit({
  store: createStore("rl:image:"),
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 60 : 240,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.image"),
});

export const forgotPasswordLimiter = rateLimit({
  store: createStore("rl:forgot-password:"),
  windowMs: 60 * 60 * 1000,
  max: env.nodeEnv === "production" ? 3 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.forgotPassword"),
});

export const resetPasswordLimiter = rateLimit({
  store: createStore("rl:reset-password:"),
  windowMs: 60 * 60 * 1000,
  max: env.nodeEnv === "production" ? 3 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLocalizedRateLimitHandler("auth.rateLimit.resetPassword"),
});
