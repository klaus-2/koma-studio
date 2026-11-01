import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runtimeLaunchManifestDeclaresProfile } from "../mini-backend-runtime-launch-manifest.ts";

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
