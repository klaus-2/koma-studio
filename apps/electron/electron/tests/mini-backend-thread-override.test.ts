import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MINI_BACKEND_THREAD_OVERRIDE_FILENAME,
  clearMiniBackendThreadOverride,
  getMiniBackendThreadOverridePath,
  miniBackendThreadEnvVars,
  readMiniBackendThreadOverride,
  sanitizeMiniBackendThreadOverride,
  writeMiniBackendThreadOverride,
} from "../modules/mini-backend-thread-override.ts";

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "koma-thread-override-"));

test("thread override round-trips through the override file", () => {
  const userDataPath = makeTempDir();
  try {
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), {
      intraOpThreads: null,
      interOpThreads: null,
    });

    const stored = writeMiniBackendThreadOverride(userDataPath, {
      intraOpThreads: 4,
      interOpThreads: 2,
    });
    assert.deepEqual(stored, { intraOpThreads: 4, interOpThreads: 2 });
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), {
      intraOpThreads: 4,
      interOpThreads: 2,
    });
    assert.equal(
      path.basename(getMiniBackendThreadOverridePath(userDataPath)),
      MINI_BACKEND_THREAD_OVERRIDE_FILENAME,
    );
    assert.equal(
      fs.readdirSync(userDataPath).filter((name) => name.endsWith(".tmp"))
        .length,
      0,
      "the atomic write must not leave temp files behind",
    );
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("malformed or missing override file falls back to defaults", () => {
  const userDataPath = makeTempDir();
  try {
    fs.writeFileSync(
      getMiniBackendThreadOverridePath(userDataPath),
      "not-json",
      "utf-8",
    );
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), {
      intraOpThreads: null,
      interOpThreads: null,
    });

    fs.writeFileSync(
      getMiniBackendThreadOverridePath(userDataPath),
      JSON.stringify({ intraOpThreads: "many", unrelated: true }),
      "utf-8",
    );
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), {
      intraOpThreads: null,
      interOpThreads: null,
    });
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("clearMiniBackendThreadOverride removes the file", () => {
  const userDataPath = makeTempDir();
  try {
    writeMiniBackendThreadOverride(userDataPath, { intraOpThreads: 4 });
    assert.ok(fs.existsSync(getMiniBackendThreadOverridePath(userDataPath)));
    clearMiniBackendThreadOverride(userDataPath);
    assert.ok(!fs.existsSync(getMiniBackendThreadOverridePath(userDataPath)));
    clearMiniBackendThreadOverride(userDataPath);
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), {
      intraOpThreads: null,
      interOpThreads: null,
    });
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("sanitize clamps thread counts into 1..64 or null", () => {
  assert.deepEqual(sanitizeMiniBackendThreadOverride({ intraOpThreads: 4.6 }), {
    intraOpThreads: 5,
    interOpThreads: null,
  });
  assert.deepEqual(sanitizeMiniBackendThreadOverride({ intraOpThreads: 500 }), {
    intraOpThreads: 64,
    interOpThreads: null,
  });
  assert.deepEqual(sanitizeMiniBackendThreadOverride({ intraOpThreads: 0 }), {
    intraOpThreads: null,
    interOpThreads: null,
  });
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      interOpThreads: 0,
    }),
    { intraOpThreads: 4, interOpThreads: null },
  );
  assert.deepEqual(sanitizeMiniBackendThreadOverride("nope"), {
    intraOpThreads: null,
    interOpThreads: null,
  });
});

test("env mapping emits intra, OMP mirror and inter only when set", () => {
  assert.deepEqual(
    miniBackendThreadEnvVars({ intraOpThreads: null, interOpThreads: null }),
    {},
  );
  assert.deepEqual(
    miniBackendThreadEnvVars({ intraOpThreads: 4, interOpThreads: null }),
    {
      MINI_BACKEND_INTRA_OP_THREADS: "4",
      OMP_NUM_THREADS: "4",
    },
  );
  assert.deepEqual(
    miniBackendThreadEnvVars({ intraOpThreads: 4, interOpThreads: 2 }),
    {
      MINI_BACKEND_INTRA_OP_THREADS: "4",
      OMP_NUM_THREADS: "4",
      MINI_BACKEND_INTER_OP_THREADS: "2",
    },
  );
});

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(path.join(testDirectory, "../main.ts"), "utf8");

test("main.ts applies the thread override env in the mini-backend spawn env block", () => {
  const startIndex = mainSource.indexOf("const startMiniBackend");
  assert.ok(startIndex >= 0, "main.ts must define startMiniBackend");
  const startFnSource = mainSource.slice(startIndex);
  assert.ok(
    startFnSource.includes("...miniBackendThreadEnvVars("),
    "startMiniBackend must spread miniBackendThreadEnvVars into the spawn env",
  );
  assert.ok(
    startFnSource.includes('readMiniBackendThreadOverride(app.getPath("userData"))'),
    "startMiniBackend must read the override file from userData at spawn time",
  );
});
