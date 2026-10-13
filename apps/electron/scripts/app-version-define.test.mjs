import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { test } from "node:test";

import { APP_VERSION_DEFINE_KEY, appVersionDefine, readShellVersion } from "@koma/config/vite";
import { loadConfigFromFile } from "vite";
import shellPackageJson from "../package.json" with { type: "json" };

test("the shipped vite config injects this shell's own package version", async () => {
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    fileURLToPath(new URL("../vite.config.mts", import.meta.url)),
  );

  assert.ok(loaded, "vite could not load apps/electron/vite.config.mts");
  assert.deepEqual(loaded.config.define, {
    [APP_VERSION_DEFINE_KEY]: JSON.stringify(shellPackageJson.version),
  });
});

test("the define value is a quoted literal, not the bare version", () => {
  const injected = appVersionDefine(new URL("../", import.meta.url).href)[APP_VERSION_DEFINE_KEY];

  assert.equal(JSON.parse(injected), shellPackageJson.version);
});

test("a shell manifest without a version fails the build instead of injecting a placeholder", () => {
  const dir = mkdtempSync(join(tmpdir(), "koma-shell-version-"));

  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "no-version-shell" }));
    const shellUrl = `${pathToFileURL(dir).href}/`;

    assert.throws(() => readShellVersion(shellUrl), /has no non-empty "version"/);
    assert.throws(() => appVersionDefine(shellUrl), /has no non-empty "version"/);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  }
});

test("a blank version is treated as no version", () => {
  const dir = mkdtempSync(join(tmpdir(), "koma-shell-blank-"));

  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "   " }));
    const shellUrl = `${pathToFileURL(dir).href}/`;

    assert.throws(() => readShellVersion(shellUrl), /has no non-empty "version"/);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  }
});
