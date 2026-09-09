import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanupPyInstallerTempDirs,
  removeDirIfExists,
  resolvePipCacheDir,
} from "./cleanup-build-caches.mjs";

test("removeDirIfExists ignora diretorio bloqueado com erro retryable", () => {
  const fakeFs = {
    existsSync: () => true,
    rmSync: () => {
      const error = new Error("locked");
      error.code = "EPERM";
      throw error;
    },
  };

  const messages = [];
  const result = removeDirIfExists("C:\\temp\\_MEI123", {
    fsModule: fakeFs,
    onLog: (level, message) => messages.push({ level, message }),
  });

  assert.equal(result.removed, false);
  assert.equal(result.skipped, true);
  assert.match(result.reason, /locked/i);
  assert.equal(messages[0]?.level, "warn");
});

test("cleanupPyInstallerTempDirs removes only _MEI folders", () => {
  const removed = [];
  const fakeFs = {
    existsSync: () => true,
    readdirSync: () => [
      { name: "_MEI111", isDirectory: () => true },
      { name: "normal-dir", isDirectory: () => true },
      { name: "_MEI-file", isDirectory: () => false },
    ],
    rmSync: (targetPath) => {
      removed.push(targetPath);
    },
  };

  const results = cleanupPyInstallerTempDirs({
    fsModule: fakeFs,
    tempDir: "C:\\Temp",
  });

  assert.equal(results.length, 1);
  assert.deepEqual(removed, ["C:\\Temp\\_MEI111"]);
  assert.equal(results[0].removed, true);
});

test("resolvePipCacheDir usa caminho correto no Windows", () => {
  assert.equal(
    resolvePipCacheDir({ platform: "win32", homeDir: "C:\\Users\\Admin" }),
    "C:\\Users\\Admin\\AppData\\Local\\pip\\Cache",
  );
});
