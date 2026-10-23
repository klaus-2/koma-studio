#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isAuthDisabledFlag } from "@koma/types/auth-disabled";

import { AUTH_DISABLED_KEY, readEnvFileValue } from "./lib/mini-dev-env.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Whether the dev stack owes the user a running auth server.
 *
 * This has to be the renderer's own predicate, not a copy of it: `dev:desktop`
 * starting without the auth server while the app still demands a login is a
 * sign-in screen with nothing behind it. Unset means local-only because
 * `vite --mode development` disables auth in dev by default.
 */
export const shouldStartAuthServer = ({ processValue = "", fileValue = "" }) =>
    !isAuthDisabledFlag(processValue.trim() !== "" ? processValue : fileValue, true);

export const buildTaskList = (declared) =>
    shouldStartAuthServer(declared)
        ? ["mini:ensure", "auth-server:dev", "dev"]
        : ["mini:ensure", "dev"];

/**
 * A Windows child needs the whole tree killed: `bun run --parallel` leaves the
 * vite, auth-server and mini-backend processes holding their ports when only
 * the wrapper dies, and the next launch then reuses processes no terminal
 * controls. Null means the caller can signal the child directly.
 */
export const buildKillInvocation = (platform, pid) =>
    platform === "win32"
        ? { command: "taskkill", args: ["/pid", String(pid), "/t", "/f"] }
        : null;

const killChild = (child) => {
    if (!child || child.killed) {
        return;
    }

    const kill = buildKillInvocation(process.platform, child.pid);
    if (kill === null) {
        child.kill("SIGTERM");
        return;
    }

    spawnSync(kill.command, kill.args, { stdio: "ignore", timeout: 15_000 });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const declared = {
        processValue: process.env[AUTH_DISABLED_KEY] ?? "",
        fileValue: readEnvFileValue(rootDir, AUTH_DISABLED_KEY),
    };

    if (!shouldStartAuthServer(declared)) {
        console.log(
            `[dev] ${AUTH_DISABLED_KEY} is not enabling login — local-only mode, the auth server is not started.`,
        );
    }

    const child = spawn(
        "bun",
        ["run", "--parallel", "--no-exit-on-error", "--elide-lines=0", ...buildTaskList(declared)],
        {
            cwd: rootDir,
            shell: false,
            stdio: "inherit",
            env: process.env,
        },
    );

    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.on(signal, () => {
            killChild(child);
        });
    }

    child.on("error", (error) => {
        console.error(`[dev] Failed to start the dev stack: ${error.message}`);
        process.exit(1);
    });

    child.on("exit", (code, signal) => {
        process.exit(signal ? 0 : (code ?? 1));
    });
}
