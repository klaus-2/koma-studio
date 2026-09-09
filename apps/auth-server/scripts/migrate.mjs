#!/usr/bin/env node
/**
 * Programmatic Drizzle migration runner.
 *
 * Usage:
 *   node scripts/migrate.mjs              # migrate (default)
 *   node scripts/migrate.mjs --check      # check if migrations are pending
 *
 * This is used by the auth-server at startup when AUTO_MIGRATE=true
 * is set, or can be called manually via `bun run db:migrate`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load env manually before anything else
import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV || "development";
const envFiles = [
    `.env.${nodeEnv}.local`,
    ".env.local",
    `.env.${nodeEnv}`,
    ".env",
];

for (const file of envFiles) {
    dotenv.config({ path: path.resolve(rootDir, file), override: false });
}

if (!process.env.DATABASE_URL) {
    console.error("✖ DATABASE_URL is required for migrations.");
    process.exit(1);
}

const mode = process.argv.includes("--check") ? "check" : "migrate";

console.log(`[migrate] mode=${mode} NODE_ENV=${nodeEnv}`);

if (mode === "check") {
    // Quick check: can we connect to the DB?
    import("postgres").then(async ({ default: postgres }) => {
        const sql = postgres(process.env.DATABASE_URL, {
            connect_timeout: 10,
            max: 1,
        });
        try {
            await sql`SELECT 1`;
            console.log("[migrate] Database reachable ✓");
            process.exit(0);
        } catch (error) {
            console.error(`[migrate] Database unreachable: ${error.message}`);
            process.exit(1);
        } finally {
            await sql.end();
        }
    });
} else {
    console.log("[migrate] Running pending migrations...");

    const { spawn } = await import("node:child_process");

    const child = spawn(
        process.platform === "win32" ? "npx.cmd" : "npx",
        ["drizzle-kit", "migrate"],
        {
            cwd: rootDir,
            stdio: "inherit",
            env: { ...process.env, NODE_ENV: nodeEnv },
        }
    );

    child.on("exit", (code) => {
        if (code === 0) {
            console.log("[migrate] Migrations applied successfully ✓");
        } else {
            console.error(`[migrate] Migrations failed with exit code ${code}`);
        }
        process.exit(code ?? 1);
    });
}