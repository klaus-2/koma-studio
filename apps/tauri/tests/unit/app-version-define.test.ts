// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";
import { describe, expect, it } from "vitest";

import { APP_VERSION_DEFINE_KEY } from "@koma/config/vite";

interface ShellManifest {
  version?: string;
}

const CONFIG_PATH = fileURLToPath(new URL("../../vite.config.ts", import.meta.url));

const readManifestVersion = (): string => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as ShellManifest;

  if (typeof manifest.version !== "string") {
    throw new Error("apps/tauri/package.json has no string version");
  }

  return manifest.version;
};

describe("apps/tauri vite config version injection", () => {
  const expected = { [APP_VERSION_DEFINE_KEY]: JSON.stringify(readManifestVersion()) };

  it("injects the shell's own package version into the production build", async () => {
    const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, CONFIG_PATH);

    expect(loaded, "vite could not load apps/tauri/vite.config.ts").not.toBeNull();
    expect(loaded?.config.define).toEqual(expected);
  });

  it("injects the same version in the e2e mode the Playwright suite runs", async () => {
    const loaded = await loadConfigFromFile({ command: "serve", mode: "e2e" }, CONFIG_PATH);

    expect(loaded?.config.define).toEqual(expected);
  });
});
