import cors, { type CorsOptions } from "cors";
import type { NextFunction, Request, Response } from "express";
import express from "express";

import { env, validateEnv } from "../config/env.js";
import { connectRedis } from "../services/redis.js";
import { ensureContentCatalogSeeded } from "../services/content-catalog.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";
import { applySensitiveResponseHeaders } from "../security/response-headers.js";
import { logger } from "../utils/logger.js";
import { testDatabaseConnection } from "../db/client.js";

import { registerDesktopRoutes } from "./desktop.js";
import { registerAuthRoutes, registerAuthFallbackRoutes } from "./auth.js";
import { registerAdminRoutes } from "./admin.js";
import { registerFeedRoutes } from "./feed.js";
import { registerModelReviewsRoutes } from "./models.js";
import { registerContentRoutes, registerHealthRoutes } from "./content.js";
import { shouldApplySensitiveResponseHeaders } from "./_shared.js";

export { registerDesktopRoutes } from "./desktop.js";
export { registerAuthRoutes, registerAuthFallbackRoutes } from "./auth.js";
export { registerAdminRoutes } from "./admin.js";
export { registerFeedRoutes } from "./feed.js";
export { registerModelReviewsRoutes } from "./models.js";
export { registerContentRoutes, registerHealthRoutes } from "./content.js";

const corsOptions: CorsOptions = {
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin: (origin, callback) => {
    if (!origin || env.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
};

export async function createServer(): Promise<express.Express> {
  validateEnv();

  // ── Prerequisites (non-fatal — server starts even when they fail) ──

  // 1. Redis
  try {
    await connectRedis();
  } catch (error) {
    logger.warn("Redis unavailable, continuing without cache", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. Database connection test — quick health check so downstream
  //    services know whether they can expect queries to work.
  const dbReachable = await testDatabaseConnection();

  // 3. Auto-migration (opt-in with AUTO_MIGRATE=true env var)
  //    When enabled, pending Drizzle migrations are applied at startup.
  //    Disabled by default — run `bun run auth-server:migrate` manually.
  const autoMigrate = process.env.AUTO_MIGRATE === "true" || process.env.AUTO_MIGRATE === "1";
  if (autoMigrate && dbReachable) {
    try {
      logger.info("Auto-migration enabled — applying pending migrations");
      const { execSync } = await import("node:child_process");
      execSync("npx drizzle-kit migrate", {
        cwd: process.cwd(),
        stdio: "pipe",
        env: { ...process.env },
      });
      logger.info("Auto-migration completed");
    } catch (error) {
      logger.warn("Auto-migration failed (continuing anyway)", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 4. Content-catalog seeding (only when DB is reachable)
  if (dbReachable) {
    try {
      await ensureContentCatalogSeeded();
    } catch (error) {
      logger.warn("Content catalog seeding skipped (DB not ready or migrations pending)", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.warn("Content catalog seeding skipped (database not reachable)");
  }

  logger.info("auth_server_runtime_flags", {
    nodeEnv: env.nodeEnv,
    enforceDesktopClient: env.enforceDesktopClient,
    enforceDesktopRegistration: env.enforceDesktopRegistration,
    dbReachable,
  });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors(corsOptions));

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (shouldApplySensitiveResponseHeaders(req.path)) {
      applySensitiveResponseHeaders(res);
    }

    next();
  });

  registerDesktopRoutes(app);
  registerHealthRoutes(app);
  registerContentRoutes(app);
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerModelReviewsRoutes(app);
  registerFeedRoutes(app);
  registerAuthFallbackRoutes(app);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = tServer(resolveLocaleFromHeaders(_req.headers), "auth.error.serverInternal");
    logger.error("Unhandled auth-server error", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: tServer(resolveLocaleFromHeaders(_req.headers), "auth.error.serverInternal"),
    });
  });

  return app;
}
