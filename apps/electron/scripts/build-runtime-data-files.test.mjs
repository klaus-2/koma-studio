import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REQUIRED_RUNTIME_DATA_FILES } from "./runtime-data-files.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.resolve(
  scriptsDir,
  "..",
  "..",
  "..",
  "packages",
  "mini-backend",
  "build.spec",
);

test("every data file the spec declares from the package tree is in the contract", () => {
  const spec = fs.readFileSync(specPath, "utf-8");
  // (str(PROJECT_ROOT / 'a' / 'b' / 'file.ext'), '<destination>')
  const declared = [...spec.matchAll(/PROJECT_ROOT((?:\s*\/\s*'[^']+')+)\s*\)\s*,\s*'([^']+)'/g)].map(
    ([, chain, destination]) => {
      const segments = [...chain.matchAll(/'([^']+)'/g)].map(([, segment]) => segment);
      return {
        source: segments.join("/"),
        suffix: `${destination}/${segments[segments.length - 1]}`,
      };
    },
  );

  assert.ok(declared.length > 0, "the spec must declare its package data files");
  for (const { source, suffix } of declared) {
    assert.ok(
      REQUIRED_RUNTIME_DATA_FILES.includes(suffix),
      `the spec declares ${source} -> ${suffix}; add it to REQUIRED_RUNTIME_DATA_FILES so the `
        + "build refuses to ship a bundle that cannot import it",
    );
  }
});

test("the contract only names files the spec ships", () => {
  const spec = fs.readFileSync(specPath, "utf-8");
  const declared = [...spec.matchAll(/PROJECT_ROOT((?:\s*\/\s*'[^']+')+)\s*\)\s*,\s*'([^']+)'/g)].map(
    ([, chain, destination]) => {
      const segments = [...chain.matchAll(/'([^']+)'/g)].map(([, segment]) => segment);
      return `${destination}/${segments[segments.length - 1]}`;
    },
  );
  for (const suffix of REQUIRED_RUNTIME_DATA_FILES) {
    assert.ok(
      declared.includes(suffix),
      `${suffix} is in the contract but the spec does not ship it`,
    );
  }
});
