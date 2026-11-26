import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildBackendOverlay } from "./build-backend-overlay.mjs";
import { createVerifiedZstdDelta } from "./build-delta.mjs";
import { pruneEngineBloat } from "./build-engine-base.mjs";
import { computeContentTreeHash } from "./hash-tree.mjs";
import { signMinisignWithVersion, verifyTauriMinisignFile } from "./minisign.mjs";
import { extractTarZst, packShardedTarZst, writeTarZst } from "./tar-zst.mjs";

test("computeContentTreeHash ignores mtime and cache directories", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "koma-hash-"));
  try {
    const srcFile = path.join(root, "app.py");
    fs.writeFileSync(srcFile, "print('hi')\n");
    fs.mkdirSync(path.join(root, "__pycache__"));
    fs.writeFileSync(path.join(root, "__pycache__", "app.cpython-312.pyc"), "pyc");
    fs.mkdirSync(path.join(root, ".pytest_cache"));
    fs.writeFileSync(path.join(root, ".pytest_cache", "v"), "cache");
    fs.mkdirSync(path.join(root, "tests"));
    fs.writeFileSync(path.join(root, "tests", "test_app.py"), "assert True\n");

    const hashA = computeContentTreeHash([root], { baseDir: root, excludeTests: true });
    fs.writeFileSync(srcFile, "print('hi')\n");
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(srcFile, future, future);

    const hashB = computeContentTreeHash([root], { baseDir: root, excludeTests: true });
    assert.equal(hashA, hashB);

    fs.writeFileSync(srcFile, "print('changed')\n");
    const hashC = computeContentTreeHash([root], { baseDir: root, excludeTests: true });
    assert.notEqual(hashA, hashC);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("packShardedTarZst deduplicates identical files via hardlinks and roundtrips with PAX paths", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "koma-tarzst-"));
  const srcDir = path.join(root, "src");
  const outDir = path.join(root, "out");
  const extractDir = path.join(root, "extract");
  try {
    const deepSubdir = path.join(srcDir, "a".repeat(60), "b".repeat(60));
    fs.mkdirSync(deepSubdir, { recursive: true });
    const repeatedBytes = Buffer.alloc(64 * 1024, 0x4b);
    fs.writeFileSync(path.join(srcDir, "first.dll"), repeatedBytes);
    fs.writeFileSync(path.join(deepSubdir, "duplicate-long-name-payload.dll"), repeatedBytes);

    const parts = await packShardedTarZst({
      sourceDir: srcDir,
      outputDir: outDir,
      baseName: "test-engine",
      budgetBytes: 1024 * 1024,
      deduplicateHardlinks: true,
    });
    assert.equal(parts.length, 1);

    const entries = extractTarZst(parts[0].path, extractDir);
    assert.ok(entries.some((e) => e.type === "hardlink"));
    const restored = fs.readFileSync(
      path.join(extractDir, "a".repeat(60), "b".repeat(60), "duplicate-long-name-payload.dll"),
    );
    assert.deepEqual(restored, repeatedBytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("createVerifiedZstdDelta compresses small patches and skips oversized ones", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "koma-delta-"));
  try {
    const base = path.join(root, "v1.exe");
    const target = path.join(root, "v2.exe");
    const patch = path.join(root, "v1-to-v2.zst");

    const basePayload = Buffer.alloc(256 * 1024, 0x41);
    const targetPayload = Buffer.from(basePayload);
    targetPayload.write("KOMA_PATCHED_V2", 128 * 1024);
    fs.writeFileSync(base, basePayload);
    fs.writeFileSync(target, targetPayload);

    const res = createVerifiedZstdDelta({ basePath: base, targetPath: target, outputPath: patch });
    assert.equal(res.created, true);
    assert.ok(res.patchSize < targetPayload.length * 0.1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("pruneEngineBloat strips static libs, pip/setuptools, and test folders", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "koma-prune-"));
  try {
    const sp = process.platform === "win32"
      ? path.join(root, "Lib", "site-packages")
      : path.join(root, "lib", "python3.12", "site-packages");
    fs.mkdirSync(path.join(sp, "nvidia", "nvjitlink", "lib", "x64"), { recursive: true });
    fs.writeFileSync(path.join(sp, "nvidia", "nvjitlink", "lib", "x64", "nvJitLink_static.lib"), "lib");
    fs.mkdirSync(path.join(sp, "torch", "test"), { recursive: true });
    fs.writeFileSync(path.join(sp, "torch", "test", "x.py"), "x");
    fs.mkdirSync(path.join(sp, "pip"), { recursive: true });
    fs.writeFileSync(path.join(sp, "pip", "__init__.py"), "x");
    fs.mkdirSync(path.join(sp, "fastapi"), { recursive: true });
    fs.writeFileSync(path.join(sp, "fastapi", "__init__.py"), "keep");

    const { removedFiles } = pruneEngineBloat(root);
    assert.equal(removedFiles, 3);
    assert.equal(fs.existsSync(path.join(sp, "fastapi", "__init__.py")), true);
    assert.equal(fs.existsSync(path.join(sp, "nvidia", "nvjitlink", "lib")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("buildBackendOverlay packs mini-backend under 5 MB without tests or weights", async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-overlay-out-"));
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-overlay-extract-"));
  try {
    const built = await buildBackendOverlay({ outputDir: outDir });
    assert.ok(built.metadata.size > 1024 && built.metadata.size < 5 * 1024 * 1024);
    assert.equal(built.metadata.engineAbi, "v1");
    assert.equal(built.metadata.entry, "app.py");

    const entries = extractTarZst(built.archivePath, extractDir);
    const paths = new Set(entries.map((e) => e.path));
    assert.ok(paths.has("app.py"));
    assert.ok(paths.has("overlay-manifest.json"));
    assert.ok(paths.has("models/manifests/model-assets.json"));
    assert.equal([...paths].some((p) => p.startsWith("tests/")), false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
});

test("signMinisignWithVersion embeds trusted version and passes Tauri verification", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-minisign-test-"));
  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const seed32 = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
    const pub32 = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const keyId = crypto.randomBytes(8);

    const skPayload = Buffer.concat([
      Buffer.from([0x45, 0x64, 0x00, 0x00, 0x42, 0x32]),
      keyId,
      seed32,
      pub32,
      Buffer.alloc(32),
    ]);
    const skDoc = `untrusted comment: minisign secret key\n${skPayload.toString("base64")}\n`;
    const keyPath = path.join(dir, "test.key");
    fs.writeFileSync(keyPath, Buffer.from(skDoc, "utf8").toString("base64"), "utf8");

    const pkPayload = Buffer.concat([Buffer.from("Ed", "ascii"), keyId, pub32]);
    const pubkeyText = `untrusted comment: minisign public key\n${pkPayload.toString("base64")}\n`;

    const payloadPath = path.join(dir, "koma-ui-1.2.3.tar.zst");
    fs.writeFileSync(payloadPath, "synthetic-ui-bundle-payload", "utf8");

    const sigText = signMinisignWithVersion({
      filePath: payloadPath,
      keyPath,
      version: "1.2.3",
    });

    const verified = verifyTauriMinisignFile({
      filePath: payloadPath,
      sigText,
      pubkeyText,
    });
    assert.equal(verified.valid, true);
    assert.equal(verified.signedVersion, "1.2.3");
    assert.equal(verified.trustedComment?.includes("version:1.2.3"), true);

    fs.writeFileSync(payloadPath, "tampered-payload", "utf8");
    const tampered = verifyTauriMinisignFile({
      filePath: payloadPath,
      sigText,
      pubkeyText,
    });
    assert.equal(tampered.valid, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("build-delta CLI writes --meta-out metadata and removes stale meta when skipped", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-delta-cli-test-"));
  const deltaScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "build-delta.mjs");
  try {
    const base = path.join(dir, "old.bin");
    const target = path.join(dir, "new.bin");
    const outPatch = path.join(dir, "patch.zst");
    const metaOut = path.join(dir, "native-delta-windows-x86_64.json");

    const baseBuf = Buffer.alloc(128 * 1024, 0x41);
    const targetBuf = Buffer.from(baseBuf);
    targetBuf.write("PATCHED_SECTION", 64 * 1024);
    fs.writeFileSync(base, baseBuf);
    fs.writeFileSync(target, targetBuf);

    const createdRes = spawnSync(
      process.execPath,
      [
        deltaScript,
        "--base",
        base,
        "--target",
        target,
        "--out",
        outPatch,
        "--meta-out",
        metaOut,
        "--target-key",
        "windows-x86_64",
        "--from-version",
        "1.3.1",
      ],
      { encoding: "utf8" },
    );
    assert.equal(createdRes.status, 0, createdRes.stderr);
    assert.equal(fs.existsSync(metaOut), true);
    const meta = JSON.parse(fs.readFileSync(metaOut, "utf8"));
    assert.equal(meta.targetKey, "windows-x86_64");
    assert.equal(meta.fromVersion, "1.3.1");
    assert.equal(meta.file, "patch.zst");
    assert.ok(meta.size > 0);
    assert.equal(typeof meta.patchSha256, "string");
    assert.equal(typeof meta.targetSha256, "string");

    fs.writeFileSync(target, crypto.randomBytes(128 * 1024));
    const skippedRes = spawnSync(
      process.execPath,
      [
        deltaScript,
        "--base",
        base,
        "--target",
        target,
        "--out",
        outPatch,
        "--meta-out",
        metaOut,
        "--target-key",
        "windows-x86_64",
        "--from-version",
        "1.3.1",
      ],
      { encoding: "utf8" },
    );
    assert.equal(skippedRes.status, 0, skippedRes.stderr);
    assert.equal(fs.existsSync(metaOut), false);
    assert.equal(fs.existsSync(outPatch), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeTarZst handles multi-megabyte multi-file streams without EOF race", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-large-zst-test-"));
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-large-zst-out-"));
  try {
    const entries = [{ type: "dir", tarPath: "assets" }];
    for (let i = 0; i < 60; i += 1) {
      entries.push({
        type: "file",
        tarPath: `assets/chunk-${String(i).padStart(3, "0")}.bin`,
        data: crypto.randomBytes(72 * 1024),
        mode: 0o644,
      });
    }
    const outPath = path.join(dir, "bundle.tar.zst");
    await writeTarZst(entries, outPath, { level: 9 });
    const extracted = extractTarZst(outPath, extractDir);
    assert.equal(extracted.filter((e) => e.type === "file").length, 60);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
});
