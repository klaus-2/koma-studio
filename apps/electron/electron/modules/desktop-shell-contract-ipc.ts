/**
 * v2 desktop shell contract: handlers that the Rust app exposes and the
 * Electron shell did not previously register. They mirror the behaviour of
 * the corresponding src-tauri commands.
 */
import fs from "node:fs";
import path from "node:path";

import { resolveDesktopDeviceId } from "./desktop-device-id.ts";
import { getCertificatePinsByHost } from "./certificate-pinning.ts";
import {
  extractDeepLinkFromArgv,
  deepLinkToHashRoute,
  formatDeepLinkForLog,
} from "./deep-link.ts";
import { registerSecureIpcHandler } from "./shared.ts";

interface DesktopShellContractIpcDeps {
  authApiUrl: string;
  navigateMainWindowFromDeepLink: (url: string) => void;
}

const setupDesktopShellContractIpcHandlers = (deps: DesktopShellContractIpcDeps): void => {
  const { authApiUrl, navigateMainWindowFromDeepLink } = deps;

  // identity: stable per-install id + HMAC fingerprint (the same data the
  // auth-server's desktop routes already consume).
  registerSecureIpcHandler("desktop-api:identity:hardware-id", async () => {
    return { hardwareId: resolveDesktopDeviceId() };
  });
  registerSecureIpcHandler("desktop-api:identity:machine-fingerprint", async () => {
    const deviceId = resolveDesktopDeviceId();
    // v1 does no hardware fingerprinting — the stable per-install id IS the fingerprint.
    return { fingerprint: deviceId };
  });

  // security: snapshot of the SHA-256 pins configured per host.
  registerSecureIpcHandler("desktop-api:security:cert-pinning:snapshot", async () => {
    const hosts: Record<string, string[]> = {};
    getCertificatePinsByHost(authApiUrl).forEach((pins, host) => {
      hosts[host] = Array.from(pins);
    });
    return { configured: Object.keys(hosts).length > 0, hosts };
  });

  // integrations: deep link (komastudio://) — same functions as the main
  // process's protocol flow.
  registerSecureIpcHandler("desktop-api:integrations:deep-link:extract", async (value) => {
    const payload = (value ?? {}) as { argv?: unknown };
    const argv = Array.isArray(payload.argv) ? payload.argv.map(String) : [];
    return { url: extractDeepLinkFromArgv(argv) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:route", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { hashRoute: deepLinkToHashRoute(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:format", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    return { formatted: formatDeepLinkForLog(url) };
  });
  registerSecureIpcHandler("desktop-api:integrations:deep-link:navigate", async (value) => {
    const payload = (value ?? {}) as { url?: unknown };
    const url = typeof payload.url === "string" ? payload.url : "";
    navigateMainWindowFromDeepLink(url);
    return { navigated: true };
  });

  // images: folder listing (the v2 contract uses it in the model manager).
  registerSecureIpcHandler("desktop-api:images:list-folder", async (value) => {
    const payload = (value ?? {}) as { folderPath?: unknown };
    const folderPath = typeof payload.folderPath === "string" ? payload.folderPath : "";
    if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { files: [] };
    }
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const full = path.join(folderPath, entry.name);
        return {
          name: entry.name,
          sizeBytes: fs.statSync(full).size,
          modifiedAt: fs.statSync(full).mtimeMs,
        };
      });
    return { folderPath, files };
  });

  // fonts: install/uninstall are not yet implemented in the electron shell —
  // return a typed error so the UI can degrade gracefully (parity with the
  // contract).
  registerSecureIpcHandler("desktop-api:fonts:install", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font install is not supported by this shell yet." },
    };
  });
  registerSecureIpcHandler("desktop-api:fonts:uninstall", async () => {
    return {
      ok: false,
      status: 501,
      payload: { error: "Font uninstall is not supported by this shell yet." },
    };
  });
};

export { setupDesktopShellContractIpcHandlers };
export type { DesktopShellContractIpcDeps };
