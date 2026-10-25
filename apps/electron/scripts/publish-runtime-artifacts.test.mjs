import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildRuntimePublishPlan } from "./publish-runtime-artifacts.mjs";

const makeArtifactsDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "koma-publish-"));

const writePart = (artifactsDir, name, byteLength) => {
  fs.writeFileSync(path.join(artifactsDir, name), Buffer.alloc(byteLength, 3));
  return { name, byteLength };
};

const writeManifest = (artifactsDir, fileName, parts, { withSignature = true, version = "1.2.0" } = {}) => {
  fs.writeFileSync(
    path.join(artifactsDir, fileName),
    JSON.stringify({
      schemaVersion: 2,
      version,
      generatedAt: "2026-10-25T00:00:00.000Z",
      platform: "win32",
      arch: "x64",
      defaultProfile: "cpu",
      profiles: {
        cpu: {
          profile: "cpu",
          version,
          platform: "win32",
          arch: "x64",
          entry: "mini-backend.exe",
          parts: parts.map((part) => ({
            file: part.name,
            url: `https://github.com/klaus-2/koma-studio/releases/download/runtime-v${version}/${part.name}`,
            sha512: "hash",
            size: part.byteLength,
          })),
        },
      },
    }),
  );
  if (withSignature) {
    fs.writeFileSync(path.join(artifactsDir, `${fileName}.sig`), "ed25519-signature\n");
  }
};

test("buildRuntimePublishPlan orders parts first, manifests last, and derives the runtime tag", () => {
  const dir = makeArtifactsDir();
  const partA = writePart(dir, "mini-backend-runtime-cpu-1.2.0-win32-x64.part-1-of-2.zip", 100);
  const partB = writePart(dir, "mini-backend-runtime-cpu-1.2.0-win32-x64.part-2-of-2.zip", 50);
  writeManifest(dir, "mini-backend-latest-win32-x64.json", [partA, partB]);

  const plan = buildRuntimePublishPlan({ artifactsDir: dir });
  assert.equal(plan.runtimeTag, "runtime-v1.2.0");
  assert.deepEqual(
    plan.partUploads.map((part) => part.file),
    [
      "mini-backend-runtime-cpu-1.2.0-win32-x64.part-1-of-2.zip",
      "mini-backend-runtime-cpu-1.2.0-win32-x64.part-2-of-2.zip",
    ],
  );
  assert.deepEqual(plan.manifestUploads, [
    { file: "mini-backend-latest-win32-x64.json", signatureFile: "mini-backend-latest-win32-x64.json.sig" },
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("buildRuntimePublishPlan refuses unsigned manifests without an explicit override", () => {
  const dir = makeArtifactsDir();
  const part = writePart(dir, "mini-backend-runtime-cpu-1.2.0-win32-x64.part-1-of-1.zip", 10);
  writeManifest(dir, "mini-backend-latest-win32-x64.json", [part], { withSignature: false });

  assert.throws(
    () => buildRuntimePublishPlan({ artifactsDir: dir }),
    /Unsigned manifests refuse to publish without --allow-unsigned/,
  );

  const plan = buildRuntimePublishPlan({ artifactsDir: dir, allowUnsigned: true });
  assert.deepEqual(plan.manifestUploads, [
    { file: "mini-backend-latest-win32-x64.json", signatureFile: null },
  ]);
  assert.deepEqual(plan.unsignedManifests, ["mini-backend-latest-win32-x64.json"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("buildRuntimePublishPlan validates part presence, sizes, flat names and version coherence", () => {
  const dir = makeArtifactsDir();
  const part = writePart(dir, "mini-backend-runtime-cpu-1.2.0-win32-x64.part-1-of-1.zip", 10);

  const missingDir = makeArtifactsDir();
  writeManifest(missingDir, "mini-backend-latest-win32-x64.json", [part]);
  assert.throws(
    () => buildRuntimePublishPlan({ artifactsDir: missingDir }),
    /part file missing on disk/,
  );

  const mismatchDir = makeArtifactsDir();
  const wrongSize = { name: part.name, byteLength: 999 };
  writePart(mismatchDir, part.name, 10);
  writeManifest(mismatchDir, "mini-backend-latest-win32-x64.json", [wrongSize]);
  assert.throws(
    () => buildRuntimePublishPlan({ artifactsDir: mismatchDir }),
    /part size mismatch/,
  );

  const divergentDir = makeArtifactsDir();
  writePart(divergentDir, "mini-backend-runtime-cpu-1.2.0-win32-x64.part-1-of-1.zip", 10);
  writePart(divergentDir, "mini-backend-runtime-cpu-1.3.0-win32-x64.part-1-of-1.zip", 10);
  writeManifest(divergentDir, "mini-backend-latest-win32-x64.json", [
    { name: "mini-backend-runtime-cpu-1.2.0-win32-x64.part-1-of-1.zip", byteLength: 10 },
  ]);
  writeManifest(divergentDir, "mini-backend-latest-linux-x64.json", [
    { name: "mini-backend-runtime-cpu-1.3.0-win32-x64.part-1-of-1.zip", byteLength: 10 },
  ], { version: "1.3.0" });
  assert.throws(
    () => buildRuntimePublishPlan({ artifactsDir: divergentDir }),
    /same version/,
  );

  for (const cleanup of [dir, missingDir, mismatchDir, divergentDir]) {
    fs.rmSync(cleanup, { recursive: true, force: true });
  }
});
