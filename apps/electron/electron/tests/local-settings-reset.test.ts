import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getMiniBackendRuntimeSelectionPath } from "../mini-backend-runtime-selection.ts";
import { resetLocalSettingsFilesAt } from "../modules/local-settings-reset.ts";
import { getMiniBackendThreadOverridePath } from "../modules/mini-backend-thread-override.ts";

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "koma-local-settings-reset-"));

test("reset removes the known local setting files and reports every path", () => {
  const userDataPath = makeTempDir();
  try {
    fs.mkdirSync(path.join(userDataPath, "secure-store"), { recursive: true });
    fs.writeFileSync(path.join(userDataPath, "desktop-device-id.json"), "{}");
    fs.writeFileSync(getMiniBackendRuntimeSelectionPath(userDataPath), "{}");
    fs.writeFileSync(getMiniBackendThreadOverridePath(userDataPath), "{}");

    const clearedPaths = resetLocalSettingsFilesAt(userDataPath);

    assert.equal(clearedPaths.length, 4);
    assert.ok(!fs.existsSync(path.join(userDataPath, "secure-store")));
    assert.ok(!fs.existsSync(path.join(userDataPath, "desktop-device-id.json")));
    assert.ok(!fs.existsSync(getMiniBackendRuntimeSelectionPath(userDataPath)));
    assert.ok(!fs.existsSync(getMiniBackendThreadOverridePath(userDataPath)));
    assert.ok(
      clearedPaths.some((clearedPath) =>
        clearedPath.endsWith("mini-backend-thread-override.json"),
      ),
      "the thread override file must be reported in clearedPaths",
    );
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("reset tolerates missing entries and still reports their paths", () => {
  const userDataPath = makeTempDir();
  try {
    const clearedPaths = resetLocalSettingsFilesAt(userDataPath);

    assert.equal(clearedPaths.length, 4);
    assert.ok(
      clearedPaths.every((clearedPath) => path.isAbsolute(clearedPath)),
    );
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});
