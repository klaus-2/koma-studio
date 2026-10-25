import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMiniBackendRuntimeArtifactManifest,
  isMiniBackendRuntimeArtifactManifest,
  listMiniBackendRuntimeArtifactOptions,
  type MiniBackendRuntimeArtifactManifest,
} from "../mini-backend-artifacts.ts";

// The golden fixture is the cross-language contract: the Rust serde test
// parses the exact same file (see src-tauri runtime tests).
const goldenFixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "scripts",
  "fixtures",
  "mini-backend-manifest-v2.golden.json",
);

const buildRecord = (overrides: Partial<MiniBackendRuntimeArtifactManifest["profiles"]["cpu"]> = {}) => ({
  profile: "cpu" as const,
  version: "1.2.3",
  platform: "win32" as const,
  arch: "x64",
  entry: "mini-backend.exe",
  parts: [
    {
      file: "mini-backend-runtime-cpu-1.2.3-win32-x64.part-1-of-1.zip",
      url: "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.3/mini-backend-runtime-cpu-1.2.3-win32-x64.part-1-of-1.zip",
      sha512: "cpu-part-hash",
      size: 100,
    },
  ],
  ...overrides,
});

test("golden fixture manifest passes the v2 guard on both sides of the contract", () => {
  const payload: unknown = JSON.parse(fs.readFileSync(goldenFixturePath, "utf-8"));
  assert.equal(isMiniBackendRuntimeArtifactManifest(payload), true);
});

test("isMiniBackendRuntimeArtifactManifest rejects schema and shape violations", () => {
  const valid: unknown = buildMiniBackendRuntimeArtifactManifest({
    version: "1.2.3",
    platform: "win32",
    arch: "x64",
    profiles: { cpu: buildRecord() },
  });
  assert.equal(isMiniBackendRuntimeArtifactManifest(valid), true);

  const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

  interface DraftPart {
    file: string;
    url: string;
    size: number;
  }
  interface DraftRecord {
    parts: DraftPart[];
    entry?: string;
    fileName?: string;
  }
  interface DraftManifest {
    schemaVersion: number;
    profiles: { cpu: DraftRecord };
  }
  const mutateDraft = (value: unknown, mutate: (draft: DraftManifest) => void): unknown => {
    const draft = structuredClone(value) as DraftManifest;
    mutate(draft);
    return draft;
  };

  const versionOne = mutateDraft(valid, (draft) => {
    draft.schemaVersion = 1;
  });
  assert.equal(isMiniBackendRuntimeArtifactManifest(versionOne), false, "schemaVersion 1 is rejected");

  const relativeUrl = mutateDraft(valid, (draft) => {
    draft.profiles.cpu.parts[0].url = "parts/mini-backend.part-1-of-1.zip";
  });
  assert.equal(isMiniBackendRuntimeArtifactManifest(relativeUrl), false, "relative part urls are rejected");

  const slashFileName = mutateDraft(valid, (draft) => {
    draft.profiles.cpu.parts[0].file = "nested/mini-backend.part-1-of-1.zip";
  });
  assert.equal(isMiniBackendRuntimeArtifactManifest(slashFileName), false, "non-flat part names are rejected");

  const emptyParts = mutateDraft(valid, (draft) => {
    draft.profiles.cpu.parts = [];
  });
  assert.equal(isMiniBackendRuntimeArtifactManifest(emptyParts), false, "records need at least one part");

  const missingEntry = mutateDraft(valid, (draft) => {
    delete draft.profiles.cpu.entry;
  });
  assert.equal(isMiniBackendRuntimeArtifactManifest(missingEntry), false, "entry is required");

  const legacyFields = mutateDraft(valid, (draft) => {
    draft.profiles.cpu.fileName = "legacy.zip";
  });
  assert.equal(
    isMiniBackendRuntimeArtifactManifest(legacyFields),
    true,
    "extra unknown fields stay tolerated, parts remain the only download shape",
  );
  assert.equal(typeof asRecord(valid).schemaVersion, "number");
});

test("listMiniBackendRuntimeArtifactOptions sums part sizes and marks recommended and installed profiles", () => {
  const manifest: MiniBackendRuntimeArtifactManifest = {
    schemaVersion: 2,
    version: "1.2.3",
    generatedAt: new Date().toISOString(),
    platform: "win32",
    arch: "x64",
    defaultProfile: "cpu",
    profiles: {
      cpu: buildRecord(),
      "nvidia-cuda-legacy": buildRecord({
        profile: "nvidia-cuda-legacy",
        parts: [
          {
            file: "mini-backend-runtime-nvidia-cuda-legacy-1.2.3-win32-x64.part-1-of-2.zip",
            url: "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.3/mini-backend-runtime-nvidia-cuda-legacy-1.2.3-win32-x64.part-1-of-2.zip",
            sha512: "legacy-part-1",
            size: 150,
          },
          {
            file: "mini-backend-runtime-nvidia-cuda-legacy-1.2.3-win32-x64.part-2-of-2.zip",
            url: "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.3/mini-backend-runtime-nvidia-cuda-legacy-1.2.3-win32-x64.part-2-of-2.zip",
            sha512: "legacy-part-2",
            size: 50,
          },
        ],
      }),
      "intel-openvino": buildRecord({
        profile: "intel-openvino",
        parts: [
          {
            file: "mini-backend-runtime-intel-openvino-1.2.3-win32-x64.part-1-of-1.zip",
            url: "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.3/mini-backend-runtime-intel-openvino-1.2.3-win32-x64.part-1-of-1.zip",
            sha512: "openvino-part",
            size: 300,
          },
        ],
      }),
    },
  };

  const options = listMiniBackendRuntimeArtifactOptions({
    manifest,
    recommendedProfile: "nvidia-cuda-legacy",
    installedProfiles: ["cpu", "nvidia-cuda-legacy"] as const,
  });

  assert.deepEqual(options, [
    {
      profile: "cpu",
      version: "1.2.3",
      size: 100,
      installed: true,
      recommended: false,
    },
    {
      profile: "nvidia-cuda-legacy",
      version: "1.2.3",
      size: 200,
      installed: true,
      recommended: true,
    },
    {
      profile: "intel-openvino",
      version: "1.2.3",
      size: 300,
      installed: false,
      recommended: false,
    },
  ]);
});
