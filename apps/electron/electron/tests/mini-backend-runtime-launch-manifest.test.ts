import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  resolveSpawnableRuntimeBinary,
  runtimeLaunchManifestDeclaresProfile,
} from "../mini-backend-runtime-launch-manifest.ts";

const writeInstallDir = (files: Record<string, string>): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-launch-manifest-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
};

test("a launch manifest that declares the profile makes the runtime spawnable", () => {
  const dir = writeInstallDir({
    "launch-manifest.json": JSON.stringify({
      profiles: { cpu: { entry: "mini-backend.exe" } },
    }),
  });

  assert.equal(runtimeLaunchManifestDeclaresProfile(dir, "cpu"), true);
  assert.equal(runtimeLaunchManifestDeclaresProfile(dir, "nvidia-cuda"), false);
});

test("a missing, partial or unreadable manifest never declares a profile", () => {
  assert.equal(runtimeLaunchManifestDeclaresProfile(path.join(os.tmpdir(), "absent"), "cpu"), false);

  const withoutManifest = writeInstallDir({});
  assert.equal(runtimeLaunchManifestDeclaresProfile(withoutManifest, "cpu"), false);

  const broken = writeInstallDir({ "launch-manifest.json": "{not json" });
  assert.equal(runtimeLaunchManifestDeclaresProfile(broken, "cpu"), false);

  const withoutProfiles = writeInstallDir({ "launch-manifest.json": JSON.stringify({}) });
  assert.equal(runtimeLaunchManifestDeclaresProfile(withoutProfiles, "cpu"), false);
});

test("the profile that was built is the one the manifest names as default", () => {
  const dir = writeInstallDir({
    "launch-manifest.json": JSON.stringify({
      defaultProfile: "cpu",
      profiles: { cpu: { entry: "mini-backend.exe" }, "nvidia-cuda": { entry: "mini-backend.exe" } },
    }),
  });

  // The manifest lists every profile the build knows; only the default one
  // proves which payload the tree holds.
  assert.equal(runtimeLaunchManifestDeclaresProfile(dir, "cpu"), true);
  assert.equal(runtimeLaunchManifestDeclaresProfile(dir, "nvidia-cuda"), false);
});

test("a manifest without the entry binary is not spawnable", () => {
  const dir = writeInstallDir({
    "launch-manifest.json": JSON.stringify({
      defaultProfile: "cpu",
      profiles: { cpu: { entry: "mini-backend.exe" } },
    }),
  });

  assert.equal(resolveSpawnableRuntimeBinary(dir, "cpu", "mini-backend.exe"), null);

  fs.writeFileSync(path.join(dir, "mini-backend.exe"), "binary");
  assert.equal(
    resolveSpawnableRuntimeBinary(dir, "cpu", "mini-backend.exe"),
    path.join(dir, "mini-backend.exe"),
  );
});

test("a runtime without its declared data files is not spawnable", () => {
  const dir = writeInstallDir({
    "launch-manifest.json": JSON.stringify({
      defaultProfile: "cpu",
      requiredFiles: ["models/manifests/model-assets.json"],
    }),
  });
  fs.writeFileSync(path.join(dir, "mini-backend.exe"), "binary");

  assert.equal(resolveSpawnableRuntimeBinary(dir, "cpu", "mini-backend.exe"), null);

  const dataDir = path.join(dir, "_internal", "models", "manifests");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "model-assets.json"), "{}");
  assert.equal(
    resolveSpawnableRuntimeBinary(dir, "cpu", "mini-backend.exe"),
    path.join(dir, "mini-backend.exe"),
  );
});
