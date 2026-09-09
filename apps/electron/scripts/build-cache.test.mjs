import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { computeSourceHash } from "./build-cache.mjs";

test("computeSourceHash ignores __pycache__ bytecode so builds cache stably", () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-hash-"));
  fs.writeFileSync(path.join(sourceDir, "app.py"), "print('hi')\n", "utf-8");

  const before = computeSourceHash([sourceDir]);

  // Simulate what PyInstaller/Python do during a build: drop bytecode caches.
  const pycacheDir = path.join(sourceDir, "__pycache__");
  fs.mkdirSync(pycacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(pycacheDir, "app.cpython-312.pyc"),
    "bytecode",
    "utf-8",
  );

  const after = computeSourceHash([sourceDir]);

  assert.equal(after, before);

  // A real source change must still invalidate the hash.
  fs.writeFileSync(path.join(sourceDir, "app.py"), "print('changed')\n", "utf-8");
  assert.notEqual(computeSourceHash([sourceDir]), before);
});
