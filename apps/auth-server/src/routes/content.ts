import type express from "express";
import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { getPublishedGuideCatalog, getPublishedResourceCatalog } from "../services/content-catalog.js";
import { testDatabaseConnection } from "../db/client.js";

/**
 * Cached DB reachability check — probed at most once every 30 s so the health
 * endpoint does not hammer the database on every request.
 */
let dbReachable: boolean | null = null;
let dbCheckedAt = 0;
const DB_PROBE_INTERVAL_MS = 30_000;

const getDbReachable = async (): Promise<boolean | null> => {
  const now = Date.now();
  if (dbReachable !== null && now - dbCheckedAt < DB_PROBE_INTERVAL_MS) {
    return dbReachable;
  }
  dbReachable = await testDatabaseConnection();
  dbCheckedAt = now;
  return dbReachable;
};

export function registerContentRoutes(app: express.Express): void {
  app.get("/api/content/guides", async (_req: Request, res: Response) => {
    const catalog = await getPublishedGuideCatalog();
    return res.status(200).json(catalog);
  });

  app.get("/api/content/resources", async (_req: Request, res: Response) => {
    const catalog = await getPublishedResourceCatalog();
    return res.status(200).json(catalog);
  });

}

export function registerHealthRoutes(app: express.Express): void {
  app.get("/health", async (_req, res) => {
    const dbOk = await getDbReachable();
    res.json({
      status: dbOk === false ? "degraded" : "ok",
      uptime: process.uptime(),
      environment: env.nodeEnv,
      dbReachable: dbOk,
      timestamp: new Date().toISOString(),
    });
  });

}
