import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const scriptPath = path.join(import.meta.dirname, "zip-runtime-parts.py");

const resolvePythonCommand = () => {
  const candidates =
    process.platform === "win32"
      ? [["py", "-3.12"], ["python"]]
      : [["python3"], ["python"]];
  for (const candidate of candidates) {
    const [command, ...args] = candidate;
    const probe = spawnSync(command, [...args, "--version"], { encoding: "utf-8" });
    if (probe.status === 0) {
      return candidate;
    }
  }
  return null;
};

const pythonCommand = resolvePythonCommand();

const runPartitioner = (args) => {
  const [command, ...baseArgs] = pythonCommand;
  return spawnSync(
    command,
    [...baseArgs, scriptPath, ...args],
    { encoding: "utf-8" },
  );
};

const listZipEntries = (zipPaths) => {
  const [command, ...baseArgs] = pythonCommand;
  const script =
    'import json,sys,zipfile; print(json.dumps({p: zipfile.ZipFile(p).namelist() for p in sys.argv[1:]}))';
  const result = spawnSync(
    command,
    [...baseArgs, "-c", script, ...zipPaths],
    { encoding: "utf-8" },
  );
  assert.equal(result.status, 0, `zip listing failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
};

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "koma-parts-test-"));

const writeIncompressibleFile = (dir, relative, byteLength) => {
  const target = path.join(dir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, crypto.randomBytes(byteLength));
};

test("zip-runtime-parts partitions under the budget with full union coverage", { skip: pythonCommand ? false : "python interpreter not available" }, () => {
  const sourceDir = makeTempDir();
  const outputDir = makeTempDir();
  const budgetBytes = 2_500_000;
  const inputFiles = [
    "_internal/a/big1.bin",
    "_internal/a/big2.bin",
    "_internal/b/big3.bin",
    "_internal/c/small.bin",
    "mini-backend.exe",
  ];
  for (const relative of inputFiles) {
    writeIncompressibleFile(
      sourceDir,
      relative,
      relative.startsWith("_internal/a/") || relative.startsWith("_internal/b/") ? 1_000_000 : 300_000,
    );
  }
  const outputBase = path.join(outputDir, "mini-backend-runtime-cpu-1.2.0-win32-x64");

  const result = runPartitioner([
    "--source-dir",
    sourceDir,
    "--output-base",
    outputBase,
    "--budget-bytes",
    String(budgetBytes),
  ]);
  assert.equal(result.status, 0, `partitioner failed: ${result.stderr}`);

  const summary = JSON.parse(result.stdout);
  assert.equal(summary.parts, 2);
  assert.equal(summary.entries, inputFiles.length);

  const plan = JSON.parse(
    fs.readFileSync(`${outputBase}.partition-plan.json`, "utf-8"),
  );
  assert.deepEqual(
    plan.parts.map((part) => part.file),
    [
      "mini-backend-runtime-cpu-1.2.0-win32-x64.part-1-of-2.zip",
      "mini-backend-runtime-cpu-1.2.0-win32-x64.part-2-of-2.zip",
    ],
  );
  for (const part of plan.parts) {
    assert.ok(part.sizeBytes > 0);
    assert.ok(part.sizeBytes <= budgetBytes, `part ${part.file} exceeds budget`);
  }

  const plannedEntries = plan.parts.flatMap((part) => part.entries).sort();
  assert.deepEqual(plannedEntries, [...inputFiles].sort());

  const zipPaths = plan.parts.map((part) => path.join(outputDir, part.file));
  const zipEntries = listZipEntries(zipPaths);
  for (const zipPath of zipPaths) {
    const entries = zipEntries[zipPath].sort();
    const planned = plan.parts
      .find((part) => zipPath.endsWith(part.file))
      .entries.sort();
    assert.deepEqual(entries, planned);
  }

  fs.rmSync(sourceDir, { recursive: true, force: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
});

test("zip-runtime-parts fails loudly when one file exceeds the budget", { skip: pythonCommand ? false : "python interpreter not available" }, () => {
  const sourceDir = makeTempDir();
  const outputDir = makeTempDir();
  writeIncompressibleFile(sourceDir, "_internal/nvidia/huge.dll", 3_000_000);
  const outputBase = path.join(outputDir, "mini-backend-runtime-cpu-1.2.0-win32-x64");

  const result = runPartitioner([
    "--source-dir",
    sourceDir,
    "--output-base",
    outputBase,
    "--budget-bytes",
    "2500000",
  ]);
  assert.equal(result.status, 2);
  const error = JSON.parse(result.stderr);
  assert.equal(error.error, "single file exceeds part budget");
  assert.equal(
    fs.readdirSync(outputDir).filter((name) => name.includes(".part-")).length,
    0,
    "no part zips may survive an oversized failure",
  );

  fs.rmSync(sourceDir, { recursive: true, force: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
});

test("zip-runtime-parts rejects budgets below the safety minimum", { skip: pythonCommand ? false : "python interpreter not available" }, () => {
  const sourceDir = makeTempDir();
  const outputDir = makeTempDir();
  writeIncompressibleFile(sourceDir, "mini-backend.exe", 10_000);

  const result = runPartitioner([
    "--source-dir",
    sourceDir,
    "--output-base",
    path.join(outputDir, "out"),
    "--budget-bytes",
    "1000",
  ]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).error, "budget too small");

  fs.rmSync(sourceDir, { recursive: true, force: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
});
