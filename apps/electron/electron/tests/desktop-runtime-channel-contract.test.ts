import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { desktopCommandChannels } from "../../../../packages/types/src/desktop-api.ts";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadSource = fs.readFileSync(path.join(testDirectory, "../preload.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(testDirectory, "../main.ts"), "utf8");

const runtimeChannels = Object.values(desktopCommandChannels.runtime);

test("every runtime channel is wired in the electron preload", () => {
  for (const channel of runtimeChannels) {
    assert.ok(
      preloadSource.includes(`"${channel}"`),
      `preload.ts must reference the ${channel} channel`,
    );
  }
});

test("every runtime channel has an ipc handler in the electron main module", () => {
  for (const channel of runtimeChannels) {
    assert.ok(
      mainSource.includes(`"${channel}"`),
      `main.ts must register the ${channel} channel`,
    );
  }
});
