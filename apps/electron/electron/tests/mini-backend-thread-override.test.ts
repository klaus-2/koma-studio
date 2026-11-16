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

const emptyOverride = {
  intraOpThreads: null,
  interOpThreads: null,
  engineIdleTimeoutSeconds: null,
  workingResolutionMegapixels: null,
  workingResolutionOcrClean: null,
};

test("thread override round-trips through the override file", () => {
  const userDataPath = makeTempDir();
  try {
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);

    const stored = writeMiniBackendThreadOverride(userDataPath, {
      intraOpThreads: 4,
      interOpThreads: 2,
    });
    assert.deepEqual(stored, { ...emptyOverride, intraOpThreads: 4, interOpThreads: 2 });
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), {
      ...emptyOverride,
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
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);

    fs.writeFileSync(
      getMiniBackendThreadOverridePath(userDataPath),
      "not-json",
      "utf-8",
    );
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);

    fs.writeFileSync(
      getMiniBackendThreadOverridePath(userDataPath),
      JSON.stringify({ intraOpThreads: "many", unrelated: true }),
      "utf-8",
    );
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("missing override file stays silent; unreadable and malformed files warn", (t) => {
  const userDataPath = makeTempDir();
  const warn = t.mock.method(console, "warn", () => {});
  try {
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);
    assert.equal(warn.mock.callCount(), 0);

    fs.mkdirSync(getMiniBackendThreadOverridePath(userDataPath));
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);
    assert.equal(warn.mock.callCount(), 1);

    fs.rmSync(getMiniBackendThreadOverridePath(userDataPath), {
      recursive: true,
      force: true,
    });

    fs.writeFileSync(
      getMiniBackendThreadOverridePath(userDataPath),
      "not-json",
      "utf-8",
    );
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);
    assert.equal(warn.mock.callCount(), 2);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("old override files without the runtime tunables keep loading", () => {
  const userDataPath = makeTempDir();
  try {
    fs.writeFileSync(
      getMiniBackendThreadOverridePath(userDataPath),
      JSON.stringify({ intraOpThreads: 6 }),
      "utf-8",
    );
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), {
      ...emptyOverride,
      intraOpThreads: 6,
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
    assert.deepEqual(readMiniBackendThreadOverride(userDataPath), emptyOverride);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("sanitize clamps thread counts into 1..64 or null", () => {
  assert.deepEqual(sanitizeMiniBackendThreadOverride({ intraOpThreads: 4.6 }), {
    ...emptyOverride,
    intraOpThreads: 5,
  });
  assert.deepEqual(sanitizeMiniBackendThreadOverride({ intraOpThreads: 500 }), {
    ...emptyOverride,
    intraOpThreads: 64,
  });
  assert.deepEqual(sanitizeMiniBackendThreadOverride({ intraOpThreads: 0 }), emptyOverride);
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      interOpThreads: 0,
    }),
    { ...emptyOverride, intraOpThreads: 4 },
  );
  assert.deepEqual(sanitizeMiniBackendThreadOverride("nope"), emptyOverride);
});

test("sanitize clamps idle timeout into 0..86400 or null", () => {
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      engineIdleTimeoutSeconds: 0,
    }),
    { ...emptyOverride, intraOpThreads: 4, engineIdleTimeoutSeconds: 0 },
  );
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      engineIdleTimeoutSeconds: 999999,
    }),
    { ...emptyOverride, intraOpThreads: 4, engineIdleTimeoutSeconds: 86400 },
  );
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      engineIdleTimeoutSeconds: -5,
    }),
    { ...emptyOverride, intraOpThreads: 4, engineIdleTimeoutSeconds: 0 },
  );
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      engineIdleTimeoutSeconds: "many",
    }),
    { ...emptyOverride, intraOpThreads: 4 },
  );
});

test("sanitize clamps working resolution into 4..64 and keeps booleans", () => {
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      workingResolutionMegapixels: 2,
    }),
    { ...emptyOverride, intraOpThreads: 4, workingResolutionMegapixels: 4 },
  );
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      workingResolutionMegapixels: 100,
    }),
    { ...emptyOverride, intraOpThreads: 4, workingResolutionMegapixels: 64 },
  );
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      workingResolutionOcrClean: true,
    }),
    { ...emptyOverride, intraOpThreads: 4, workingResolutionOcrClean: true },
  );
  assert.deepEqual(
    sanitizeMiniBackendThreadOverride({
      intraOpThreads: 4,
      workingResolutionOcrClean: "yes",
    }),
    { ...emptyOverride, intraOpThreads: 4 },
  );
});

test("env mapping emits intra, OMP mirror and inter only when set", () => {
  assert.deepEqual(miniBackendThreadEnvVars(emptyOverride), {});
  assert.deepEqual(
    miniBackendThreadEnvVars({ ...emptyOverride, intraOpThreads: 4 }),
    {
      MINI_BACKEND_INTRA_OP_THREADS: "4",
      OMP_NUM_THREADS: "4",
    },
  );
  assert.deepEqual(
    miniBackendThreadEnvVars({ ...emptyOverride, intraOpThreads: 4, interOpThreads: 2 }),
    {
      MINI_BACKEND_INTRA_OP_THREADS: "4",
      OMP_NUM_THREADS: "4",
      MINI_BACKEND_INTER_OP_THREADS: "2",
    },
  );
});

test("env mapping emits the runtime tunables only when set", () => {
  assert.deepEqual(
    miniBackendThreadEnvVars({
      intraOpThreads: 4,
      interOpThreads: null,
      engineIdleTimeoutSeconds: 600,
      workingResolutionMegapixels: 24,
      workingResolutionOcrClean: false,
    }),
    {
      MINI_BACKEND_INTRA_OP_THREADS: "4",
      OMP_NUM_THREADS: "4",
      MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS: "600",
      MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS: "24",
      MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN: "0",
    },
  );
  assert.deepEqual(
    miniBackendThreadEnvVars({
      intraOpThreads: null,
      interOpThreads: null,
      engineIdleTimeoutSeconds: 0,
      workingResolutionMegapixels: 48,
      workingResolutionOcrClean: true,
    }),
    {
      MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS: "0",
      MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS: "48",
      MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN: "1",
    },
  );
});

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const mainSource = fs.readFileSync(path.join(testDirectory, "../main.ts"), "utf8");
const rustOverrideSource = fs.readFileSync(
  path.join(
    testDirectory,
    "../../../tauri/src-tauri/src/sidecar/mini_backend/thread_override.rs",
  ),
  "utf8",
);
const pythonContractSource = [
  fs.readFileSync(
    path.join(testDirectory, "../../../../packages/mini-backend/core/threads.py"),
    "utf8",
  ),
  fs.readFileSync(
    path.join(testDirectory, "../../../../packages/mini-backend/core/config.py"),
    "utf8",
  ),
].join("\n");

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

test("test_override_fields_have_parity_across_shells", () => {
  const fullySet = sanitizeMiniBackendThreadOverride({
    intraOpThreads: 4,
    interOpThreads: 2,
    engineIdleTimeoutSeconds: 600,
    workingResolutionMegapixels: 24,
    workingResolutionOcrClean: true,
  });

  for (const field of Object.keys(fullySet)) {
    assert.ok(
      rustOverrideSource.includes(field),
      `thread_override.rs must carry the camelCase field "${field}" (serde rename_all camelCase)`,
    );
  }

  for (const envName of Object.keys(miniBackendThreadEnvVars(fullySet))) {
    assert.ok(
      pythonContractSource.includes(envName),
      `the mini-backend Python contract (core/threads.py, core/config.py) must consume "${envName}"`,
    );
  }
});
