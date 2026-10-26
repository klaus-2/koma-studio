import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renameTauriInstallers } from "./rename-tauri-installers.mjs";

const makeBundleDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "koma-tauri-rename-"));

test("appends -tauri to msi and nsis installers and reports the renamed files", () => {
  const bundleDir = makeBundleDir();
  fs.mkdirSync(path.join(bundleDir, "msi"));
  fs.mkdirSync(path.join(bundleDir, "nsis"));
  fs.writeFileSync(path.join(bundleDir, "msi", "KOMA.Studio_1.2.0_x64_en-US.msi"), "msi");
  fs.writeFileSync(path.join(bundleDir, "nsis", "KOMA.Studio_1.2.0_x64-setup.exe"), "nsis");

  const renamed = renameTauriInstallers(bundleDir);

  assert.deepEqual(renamed.toSorted(), [
    path.join("msi", "KOMA.Studio_1.2.0_x64_en-US-tauri.msi"),
    path.join("nsis", "KOMA.Studio_1.2.0_x64-setup-tauri.exe"),
  ]);
  assert.deepEqual(fs.readdirSync(path.join(bundleDir, "nsis")).toSorted(), ["KOMA.Studio_1.2.0_x64-setup-tauri.exe"]);
  assert.deepEqual(fs.readdirSync(path.join(bundleDir, "msi")).toSorted(), ["KOMA.Studio_1.2.0_x64_en-US-tauri.msi"]);
});

test("overwrites a stale -tauri target from a previous run instead of leaving both names", () => {
  const bundleDir = makeBundleDir();
  const nsis = path.join(bundleDir, "nsis");
  fs.mkdirSync(nsis);
  fs.writeFileSync(path.join(nsis, "app_1.2.0_x64-setup-tauri.exe"), "stale");
  fs.writeFileSync(path.join(nsis, "app_1.2.0_x64-setup.exe"), "fresh");

  const renamed = renameTauriInstallers(bundleDir);

  assert.deepEqual(renamed, [path.join("nsis", "app_1.2.0_x64-setup-tauri.exe")]);
  assert.deepEqual(fs.readdirSync(nsis).toSorted(), ["app_1.2.0_x64-setup-tauri.exe"]);
  assert.equal(fs.readFileSync(path.join(nsis, "app_1.2.0_x64-setup-tauri.exe"), "utf-8"), "fresh");
});

test("keeps already-renamed installers, follows .sig twins and ignores other files", () => {
  const bundleDir = makeBundleDir();
  const dmg = path.join(bundleDir, "dmg");
  fs.mkdirSync(dmg);
  fs.writeFileSync(path.join(dmg, "KOMA.Studio_1.2.0_aarch64-tauri.dmg"), "already");
  fs.writeFileSync(path.join(dmg, "KOMA.Studio_1.2.0_x64.dmg"), "app");
  fs.writeFileSync(path.join(dmg, "KOMA.Studio_1.2.0_x64.dmg.sig"), "sig");
  fs.writeFileSync(path.join(dmg, "notes.txt"), "keep");

  const renamed = renameTauriInstallers(bundleDir);

  assert.deepEqual(renamed, [path.join("dmg", "KOMA.Studio_1.2.0_x64-tauri.dmg")]);
  assert.equal(fs.existsSync(path.join(dmg, "KOMA.Studio_1.2.0_x64.dmg")), false);
  assert.equal(fs.readFileSync(path.join(dmg, "KOMA.Studio_1.2.0_x64-tauri.dmg"), "utf-8"), "app");
  assert.equal(fs.readFileSync(path.join(dmg, "KOMA.Studio_1.2.0_x64-tauri.dmg.sig"), "utf-8"), "sig");
  assert.equal(fs.readFileSync(path.join(dmg, "KOMA.Studio_1.2.0_aarch64-tauri.dmg"), "utf-8"), "already");
  assert.equal(fs.readFileSync(path.join(dmg, "notes.txt"), "utf-8"), "keep");
});

test("returns an empty list without touching anything when the bundle dir does not exist", () => {
  const missing = path.join(makeBundleDir(), "target", "release", "bundle");
  assert.deepEqual(renameTauriInstallers(missing), []);
});
