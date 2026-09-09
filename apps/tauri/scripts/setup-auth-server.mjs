#!/usr/bin/env node
/**
 * Auth-server one-time setup helper.
 *
 * Usage:
 *   node scripts/setup-auth-server.mjs
 *
 * Creates auth-server/.env.development from the example file if it does
 * not already exist, then installs dependencies.
 */

import { existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// apps/tauri — auth-server is a sibling workspace at apps/auth-server
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authServerDir = path.join(rootDir, "..", "auth-server");
const exampleFile = path.join(authServerDir, ".env.development.example");
const targetFile = path.join(authServerDir, ".env.development");

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  KŌMA Studio — Auth Server Setup                ║");
console.log("╚══════════════════════════════════════════════════╝");

// Step 1: Create .env.development from example
if (!existsSync(targetFile)) {
    if (existsSync(exampleFile)) {
        copyFileSync(exampleFile, targetFile);
        console.log("✓ Created auth-server/.env.development from example");
        console.log("  → Edit it with your real database URL and secrets");
    } else {
        console.log("✖ Example file not found. Run from the repo root:");
        console.log("  node scripts/setup-auth-server.mjs");
        process.exit(1);
    }
} else {
    console.log("• auth-server/.env.development already exists (skipping)");
}

// Step 2: Install dependencies (workspaces: installing at the root covers everything)
console.log("\n▸ Installing dependencies (workspace root)...");
const installResult = spawnSync("bun", ["install"], {
    cwd: path.join(rootDir, "..", ".."),
    stdio: "inherit",
});

if (installResult.error || installResult.status !== 0) {
    console.error("✖ Dependencies installation failed");
    console.error("  Try: bun install (from the monorepo root)");
    process.exit(1);
}

console.log("✓ Dependencies installed");

// Step 3: Reminder to run migrations
console.log("\n╔══════════════════════════════════════════════════╗");
console.log("║  Next steps:                                    ║");
console.log("║  1. Edit auth-server/.env.development with your  ║");
console.log("║     database URL and secrets                     ║");
console.log("║  2. Run migrations:                              ║");
console.log("║     bun run auth-server:migrate                  ║");
console.log("║  3. Start the dev server:                        ║");
console.log("║     bun run auth-server:dev                      ║");
console.log("╚══════════════════════════════════════════════════╝");