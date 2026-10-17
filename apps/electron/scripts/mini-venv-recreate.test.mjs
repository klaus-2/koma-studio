import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  maybeWriteMarker,
  runProvisionerWithRecreate,
  testSeamNames,
} from "./mini-venv-recreate.mjs";
import { readMiniDepsMarker, writeMiniDepsMarker } from "./mini-deps-marker.mjs";

const PROVISIONER = path.join("packages", "mini-backend", "scripts", "ensure-mini-deps.py");
const MARKER_NAME = ".koma-mini-deps-marker";
const BANNED_INTERACTION = ["readline", "process.stdin", "input(", "prompt(", "question"];

const createTempVenv = () => {
  const venvDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-recreate-"));
  const binDir = path.join(venvDir, process.platform === "win32" ? "Scripts" : "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const pythonBin = path.join(
    binDir,
    process.platform === "win32" ? "python.exe" : "python",
  );
  fs.writeFileSync(pythonBin, "fake interpreter image\n", "utf-8");
  const sentinel = path.join(venvDir, "sentinel.txt");
  fs.writeFileSync(sentinel, "prove the delete never happened\n", "utf-8");
  return { venvDir, pythonBin, sentinel };
};

const snapshot = (directory) =>
  JSON.stringify(
    fs
      .readdirSync(directory)
      .sort()
      .map((name) => [name, fs.statSync(path.join(directory, name)).mtimeMs]),
  );

const buildHarness = ({ statuses, venvDir, allowedVenvDir, pythonBin, createSucceeds = true }) => {
  const invocations = [];
  const deletions = [];
  const logs = [];
  const harness = {
    invocations,
    deletions,
    logs,
    run: (command, args) => {
      invocations.push([command, args]);
      if (command === pythonBin && args[0] === PROVISIONER) {
        return statuses.shift();
      }
      if (createSucceeds) {
        fs.mkdirSync(path.dirname(pythonBin), { recursive: true });
        fs.writeFileSync(pythonBin, "recreated interpreter image\n", "utf-8");
      }
      return 0;
    },
    rmSync: (target, options) => {
      deletions.push([target, options]);
      fs.rmSync(target, options);
    },
    existsSync: fs.existsSync,
    directoryBytes: () => 4096,
    log: (line) => logs.push(line),
  };
  return {
    ...harness,
    call: () =>
      runProvisionerWithRecreate({
        venvDir,
        allowedVenvDir,
        pythonBin,
        provisionerPath: PROVISIONER,
        createCommand: "py",
        createArgs: ["-3.12", "-m", "venv", venvDir],
        run: harness.run,
        rmSync: harness.rmSync,
        existsSync: harness.existsSync,
        directoryBytes: harness.directoryBytes,
        log: harness.log,
      }),
  };
};

test("proven unusable deletes the allowed venv once, recreates it and retries once", () => {
  const { venvDir, pythonBin, sentinel } = createTempVenv();
  const harness = buildHarness({
    statuses: [4, 0],
    venvDir,
    allowedVenvDir: venvDir,
    pythonBin,
  });

  assert.equal(harness.call(), 0);
  assert.equal(harness.deletions.length, 1);
  assert.equal(harness.deletions[0][0], venvDir);
  assert.deepEqual(harness.deletions[0][1], { recursive: true, force: true });
  assert.equal(fs.existsSync(sentinel), false);
  assert.equal(fs.existsSync(venvDir), true);
  assert.equal(
    harness.invocations.filter(
      ([command, args]) => command === pythonBin && args[0] === PROVISIONER,
    ).length,
    2,
  );
  assert.equal(harness.invocations.length, 3);
  assert.ok(
    harness.logs.some((line) =>
      line.startsWith("[mini:venv] The provisioner proved this environment unusable (exit 4)"),
    ),
  );
  assert.ok(
    harness.logs.some((line) => line.includes(`Recreating ${venvDir} (4096 bytes)`)),
    "the announcement must carry the reason and the size",
  );
});

test("a second unusable verdict exits 1 and never loops", () => {
  const { venvDir, pythonBin } = createTempVenv();
  const harness = buildHarness({
    statuses: [4, 4],
    venvDir,
    allowedVenvDir: venvDir,
    pythonBin,
  });

  assert.equal(harness.call(), 1);
  assert.equal(
    harness.invocations.filter(
      ([command, args]) => command === pythonBin && args[0] === PROVISIONER,
    ).length,
    2,
  );
  assert.equal(harness.deletions.length, 1);
  assert.ok(harness.logs.some((line) => line.includes("recreate did not fix it")));
});

test("a transient-shaped failure changes no entry and no mtime, and exits non-zero", () => {
  const { venvDir, pythonBin, sentinel } = createTempVenv();
  const harness = buildHarness({
    statuses: [1],
    venvDir,
    allowedVenvDir: venvDir,
    pythonBin,
  });
  const before = snapshot(venvDir);

  assert.equal(harness.call(), 1);
  assert.equal(harness.deletions.length, 0);
  assert.equal(harness.invocations.length, 1);
  assert.equal(snapshot(venvDir), before);
  assert.equal(fs.existsSync(sentinel), true);
});

test("an unclassified child failure is equally non-destructive", () => {
  const { venvDir, pythonBin, sentinel } = createTempVenv();
  const harness = buildHarness({
    statuses: [130],
    venvDir,
    allowedVenvDir: venvDir,
    pythonBin,
  });
  const before = snapshot(venvDir);

  assert.equal(harness.call(), 130);
  assert.equal(harness.deletions.length, 0);
  assert.equal(snapshot(venvDir), before);
  assert.equal(fs.existsSync(sentinel), true);
});

test("a delete target that is not the allowed venv throws with zero deletions", () => {
  const { venvDir, pythonBin, sentinel } = createTempVenv();
  const elsewhere = path.join(path.dirname(venvDir), "not-the-venv");
  const harness = buildHarness({
    statuses: [4],
    venvDir,
    allowedVenvDir: elsewhere,
    pythonBin,
  });
  const before = snapshot(venvDir);

  assert.throws(
    () => harness.call(),
    (error) => error.message.includes("Refusing to delete"),
  );
  assert.equal(harness.deletions.length, 0);
  assert.equal(harness.invocations.length, 1);
  assert.equal(snapshot(venvDir), before);
  assert.equal(fs.existsSync(sentinel), true);

  const relative = buildHarness({
    statuses: [4],
    venvDir,
    allowedVenvDir: ".venv-mini",
    pythonBin,
  });
  assert.throws(() => relative.call(), (error) => error.message.includes("Refusing to delete"));
  assert.equal(relative.deletions.length, 0);
});

test("a recreate whose venv has no interpreter exits 1 with the actionable line", () => {
  const { venvDir, pythonBin } = createTempVenv();
  const harness = buildHarness({
    statuses: [4, 0],
    venvDir,
    allowedVenvDir: venvDir,
    pythonBin,
    createSucceeds: false,
  });

  assert.equal(harness.call(), 1);
  assert.equal(harness.deletions.length, 1);
  assert.equal(harness.invocations.length, 2);
  assert.ok(harness.logs.some((line) => line.includes("has no interpreter at")));
});

test("a seam in the writer's own environment withholds the marker and changes no exit code", () => {
  const venvDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-marker-venv-"));
  const logs = [];
  const written = maybeWriteMarker({
    env: { MINI_DEPS_FAKE_PYTHON_ARGV: `python;fake_interpreter.py;--mode;succeed` },
    venvDir,
    markerHash: "abc123",
    writeMarker: writeMiniDepsMarker,
    log: (line) => logs.push(line),
  });

  assert.equal(written, false);
  assert.equal(readMiniDepsMarker(venvDir), null);
  assert.equal(fs.existsSync(path.join(venvDir, MARKER_NAME)), false);
  assert.ok(logs[0].includes("MINI_DEPS_FAKE_UV_ARGV"));
  assert.ok(logs[0].includes("MINI_DEPS_FAKE_PYTHON_ARGV"));
  assert.ok(logs[0].startsWith("[mini:deps] Marker NOT written"));

  const pythonBin = path.join(venvDir, "python");
  const harness = buildHarness({
    statuses: [0],
    venvDir,
    allowedVenvDir: venvDir,
    pythonBin,
  });
  assert.equal(harness.call(), 0, "a withheld stamp must not change the run's exit code");

  const stamped = maybeWriteMarker({
    env: {},
    venvDir,
    markerHash: "abc123",
    writeMarker: writeMiniDepsMarker,
    log: () => {},
  });
  assert.equal(stamped, true);
  assert.equal(readMiniDepsMarker(venvDir), "abc123");
});

test("testSeamNames reports exactly the seam variables that hold a value", () => {
  assert.deepEqual(testSeamNames({}), []);
  assert.deepEqual(testSeamNames({ MINI_DEPS_FAKE_UV_ARGV: "" }), []);
  assert.deepEqual(testSeamNames({ MINI_DEPS_FAKE_UV_ARGV: "python;fake_uv.py" }), [
    "MINI_DEPS_FAKE_UV_ARGV",
  ]);
  assert.deepEqual(
    testSeamNames({
      MINI_DEPS_FAKE_UV_ARGV: "python;fake_uv.py",
      MINI_DEPS_FAKE_PYTHON_ARGV: "python;fake_interpreter.py",
    }),
    ["MINI_DEPS_FAKE_UV_ARGV", "MINI_DEPS_FAKE_PYTHON_ARGV"],
  );
});

test("the recreate rung and its caller never prompt, read a TTY or read ambient env", () => {
  for (const source of [
    fs.readFileSync(new URL("./mini-venv-recreate.mjs", import.meta.url), "utf-8"),
    fs.readFileSync(new URL("./ensure-mini-venv.mjs", import.meta.url), "utf-8"),
  ]) {
    for (const banned of BANNED_INTERACTION) {
      assert.equal(
        source.includes(banned),
        false,
        `a bootstrap that runs under bun run --parallel and CI must not contain ${banned}`,
      );
    }
  }
});
