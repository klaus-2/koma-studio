import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  computeMiniDepsMarkerHash,
  isMiniDepsMarkerFresh,
  listMiniDepsInputFiles,
  readMiniDepsMarker,
  writeMiniDepsMarker,
} from "./mini-deps-marker.mjs";

const buildFakeProject = ({ requirementsBodies }) => {
  // espelha o layout do monorepo: <base>/apps/electron + <base>/packages/mini-backend
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "koma-marker-"));
  const rootDir = path.join(base, "apps", "electron");
  fs.mkdirSync(path.join(rootDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(base, "packages", "mini-backend", "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "packages", "mini-backend", "scripts", "ensure-mini-deps.py"),
    "# installer v1\n",
    "utf-8",
  );
  for (const [name, body] of Object.entries(requirementsBodies)) {
    fs.writeFileSync(path.join(base, "packages", "mini-backend", name), body, "utf-8");
  }
  return rootDir;
};

test("marker hash covers requirements files and the installer script", () => {
  const rootDir = buildFakeProject({
    requirementsBodies: {
      "requirements.txt": "fastapi==1.0\n",
      "requirements-windows-nvidia.txt": "onnxruntime-gpu==1.20\n",
    },
  });

  const files = listMiniDepsInputFiles(rootDir).map((filePath) =>
    path.basename(filePath),
  );
  assert.deepEqual(files, [
    "ensure-mini-deps.py",
    "requirements-windows-nvidia.txt",
    "requirements.txt",
  ]);
});

test("marker hash changes when a requirements file changes", () => {
  const rootDir = buildFakeProject({
    requirementsBodies: { "requirements.txt": "fastapi==1.0\n" },
  });
  const before = computeMiniDepsMarkerHash(rootDir);

  fs.writeFileSync(
    path.join(rootDir, "..", "..", "packages", "mini-backend", "requirements.txt"),
    "fastapi==1.1\n",
    "utf-8",
  );
  const after = computeMiniDepsMarkerHash(rootDir);

  assert.notEqual(before, after);
});

test("marker hash changes when the acceleration profile changes", () => {
  const rootDir = buildFakeProject({
    requirementsBodies: { "requirements.txt": "fastapi==1.0\n" },
  });

  assert.notEqual(
    computeMiniDepsMarkerHash(rootDir, { profile: "cpu" }),
    computeMiniDepsMarkerHash(rootDir, { profile: "nvidia-cuda" }),
  );
});

test("marker round trip: write, read, freshness", () => {
  const venvDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-venv-"));
  assert.equal(readMiniDepsMarker(venvDir), null);
  assert.equal(isMiniDepsMarkerFresh(venvDir, "abc123"), false);

  writeMiniDepsMarker(venvDir, "abc123");
  assert.equal(readMiniDepsMarker(venvDir), "abc123");
  assert.equal(isMiniDepsMarkerFresh(venvDir, "abc123"), true);
  assert.equal(isMiniDepsMarkerFresh(venvDir, "other"), false);
});
