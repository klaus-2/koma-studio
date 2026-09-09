import test from "node:test";
import assert from "node:assert/strict";

import { resolveMiniBackendStartupPolicy } from "../mini-backend-runtime-startup.ts";

test("resolveMiniBackendStartupWaitOptions gives downloaded runtimes more startup time in production", () => {
  const embedded = resolveMiniBackendStartupPolicy({
    isDev: false,
    source: "bundled-core",
  });
  const downloaded = resolveMiniBackendStartupPolicy({
    isDev: false,
    source: "downloaded-runtime",
  });

  assert.deepEqual(embedded, {
    initial: { attempts: 60, delayMs: 500 },
    background: null,
  });
  assert.deepEqual(downloaded, {
    initial: { attempts: 600, delayMs: 1_000 },
    background: null,
  });
});

test("resolveMiniBackendStartupWaitOptions preserves the long dev startup window", () => {
  assert.deepEqual(resolveMiniBackendStartupPolicy({
    isDev: true,
    source: "bundled-core",
  }), {
    initial: { attempts: 240, delayMs: 500 },
    background: null,
  });
});
