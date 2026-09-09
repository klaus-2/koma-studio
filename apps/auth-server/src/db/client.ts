import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

const isPlaceholderDb = env.databaseUrl.includes("user:password@localhost") || env.databaseUrl.trim().length === 0;

/**
 * PostgreSQL connection pool.
 *
 * The connection is lazy — no socket is opened until the first query. If the
 * remote database is temporarily unreachable (e.g. network hiccup, migration
 * not yet applied), queries will fail with a SQL error rather than crashing
 * the entire server. Callers should handle such errors gracefully.
 *
 * Notable settings:
 * - `connect_timeout`: seconds before giving up on a new connection. Raised
 *   from the default 3 to 15 because the production DB is on a remote managed
 *   host where TLS negotiation and network latency easily exceed
 *   the old threshold, producing Cloudflare 522 errors.
 * - `idle_timeout`: seconds after which an idle pooled connection is closed.
 * - `max`: pool size — small in dev (2), larger in production (20).
 * - `prepare`: disabled for placeholder/localhost DB URLs to avoid errors
 *   when the schema doesn't exist yet.
 */
const sql = postgres(env.databaseUrl, {
  max: env.nodeEnv === "production" ? 20 : 4,
  idle_timeout: 15,
  connect_timeout: 15,
  prepare: !isPlaceholderDb,
  onnotice: () => { },
  transform: {
    undefined: null,
  },
});

/**
 * Graceful connection test — runs on startup to verify the DB is reachable.
 * Swallows the error so the server can still boot and serve health checks &
 * static content even when the database is offline (e.g. during migrations).
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await sql`SELECT 1`;
    logger.info("Database connection established");
    return true;
  } catch (error) {
    logger.warn("Database not reachable at startup — serving degraded", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const db = drizzle(sql, { schema });
export { sql };
