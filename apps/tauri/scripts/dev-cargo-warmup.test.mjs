import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isTransientLinkerFailure, resolveDevFeatureArgs } from "./dev-cargo-warmup.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const realCargoToml = fs.readFileSync(path.join(scriptDir, "..", "src-tauri", "Cargo.toml"), "utf8");

test("resolves the dev feature set from the real Cargo.toml defaults", () => {
  assert.deepEqual(resolveDevFeatureArgs(realCargoToml), ["--no-default-features", "--features", "discord-rpc"]);
});

test("drops custom-protocol from the dev features", () => {
  const cargoToml = '[features]\ndefault = ["custom-protocol", "shipped-feature"]\n';
  assert.deepEqual(resolveDevFeatureArgs(cargoToml), ["--no-default-features", "--features", "shipped-feature"]);
});

test("keeps only --no-default-features when every default feature is custom-protocol", () => {
  const cargoToml = '[features]\ndefault = ["custom-protocol"]\n';
  assert.deepEqual(resolveDevFeatureArgs(cargoToml), ["--no-default-features"]);
});

test("uses the default feature set when Cargo.toml declares no default key", () => {
  const cargoToml = '[package]\nname = "app"\n';
  assert.deepEqual(resolveDevFeatureArgs(cargoToml), []);
});

test("flags LNK1104 as the transient linker failure and nothing else", () => {
  const lnkError = "LINK : fatal error LNK1104: cannot open file 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\lnk{DC286F40-BE0B-44F0-B150-3DD3D4279C87}.tmp'";
  assert.equal(isTransientLinkerFailure(lnkError), true);
  assert.equal(isTransientLinkerFailure("error: could not compile `koma-studio-v2` (lib) due to 1 previous error"), false);
});
