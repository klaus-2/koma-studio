/**
 * Production runtime integrity guards.
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/** Block unpackaged asar, debugger switches, and remote debugging in prod. */
const enforcePackagedRuntimeIntegrity = (isDev: boolean): void => {
  if (isDev) {
    return;
  }

  const appPath = app.getAppPath();
  const expectedAsarPath = path.resolve(process.resourcesPath, "app.asar");
  const normalizedAppPath = appPath.toLowerCase();
  if (!normalizedAppPath.includes("app.asar") || !fs.existsSync(expectedAsarPath)) {
    console.error("[desktop-security] Packaged runtime integrity check failed (asar path mismatch).");
    app.exit(1);
    return;
  }

  const hasInspectArg = process.execArgv.some((arg) =>
    /^--inspect(?:-brk)?(?:=|$)/i.test(arg.trim()),
  );
  if (hasInspectArg) {
    console.error("[desktop-security] Debugger argument blocked in production runtime.");
    app.exit(1);
    return;
  }

  const remoteDebuggingPort = app.commandLine.getSwitchValue("remote-debugging-port");
  if (remoteDebuggingPort && remoteDebuggingPort !== "0") {
    console.error("[desktop-security] remote-debugging-port must remain disabled in production.");
    app.exit(1);
  }
};

export { enforcePackagedRuntimeIntegrity };
