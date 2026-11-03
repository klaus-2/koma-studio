import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { desktopCommandChannels } from "../../../../packages/types/src/desktop-api.ts";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadSource = fs.readFileSync(path.join(testDirectory, "../preload.ts"), "utf8");
const modelsModuleSource = fs.readFileSync(path.join(testDirectory, "../modules/models.ts"), "utf8");

const modelChannels = Object.values(desktopCommandChannels.models);

test("every models channel is wired in the electron preload", () => {
  for (const channel of modelChannels) {
    assert.ok(
      preloadSource.includes(`"${channel}"`),
      `preload.ts must reference the ${channel} channel`,
    );
  }
});

test("every models channel has an ipc handler in the electron main module", () => {
  for (const channel of modelChannels) {
    assert.ok(
      modelsModuleSource.includes(`"${channel}"`),
      `modules/models.ts must register the ${channel} channel`,
    );
  }
});
