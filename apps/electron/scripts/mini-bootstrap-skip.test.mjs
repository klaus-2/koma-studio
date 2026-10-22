import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { shouldSkipMiniBootstrap } from "./mini-dev-env.mjs";
import { computeMiniDepsMarkerHash, writeMiniDepsMarker } from "./mini-deps-marker.mjs";
import { missingInterpreterStatus } from "./mini-venv-recreate.mjs";

const readSource = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf-8");

test("the same truthiness sets as Tauri decide the skip, and name the variable that asked", () => {
  assert.deepEqual(shouldSkipMiniBootstrap({ KOMA_SKIP_MINI_BOOTSTRAP: "1" }), {
    skip: true,
    source: "KOMA_SKIP_MINI_BOOTSTRAP",
  });
  assert.deepEqual(shouldSkipMiniBootstrap({ KOMA_SKIP_MINI_BOOTSTRAP: " Yes " }), {
    skip: true,
    source: "KOMA_SKIP_MINI_BOOTSTRAP",
  });
  assert.deepEqual(shouldSkipMiniBootstrap({ CI: "true" }), { skip: true, source: "CI" });
  assert.deepEqual(shouldSkipMiniBootstrap({ CI: "1" }), { skip: true, source: "CI" });
  assert.deepEqual(shouldSkipMiniBootstrap({ CI: "yes" }), { skip: false, source: "" });
  assert.deepEqual(shouldSkipMiniBootstrap({ KOMA_SKIP_MINI_BOOTSTRAP: "0" }), {
    skip: false,
    source: "",
  });
  assert.deepEqual(shouldSkipMiniBootstrap({}), { skip: false, source: "" });
  assert.deepEqual(
    shouldSkipMiniBootstrap({ KOMA_SKIP_MINI_BOOTSTRAP: "1", CI: "true" }),
    { skip: true, source: "KOMA_SKIP_MINI_BOOTSTRAP" },
    "the explicit opt-out is named before CI, exactly like mini-venv.mjs",
  );
});

test("the hatch is consulted by the dev-stack bootstrap and by nothing else", () => {
  const [afterOpen] = readSource("./dev-stack.mjs").split("const ensureMiniDeps = () => {").slice(1);
  const body = afterOpen.slice(0, afterOpen.indexOf("\n};"));
  assert.ok(body.includes("shouldSkipMiniBootstrap(process.env)"), "ensureMiniDeps must consult the hatch");
  assert.ok(
    body.indexOf("return;") < body.indexOf("spawnSync("),
    "a deliberate skip must return before the bootstrap child is spawned",
  );
  assert.ok(body.includes("console.warn("), "a skip warns instead of failing");

  const ensure = readSource("./ensure-mini-venv.mjs");
  for (const banned of ["shouldSkipMiniBootstrap", "KOMA_SKIP_MINI_BOOTSTRAP", "process.env.CI"]) {
    assert.equal(
      ensure.includes(banned),
      false,
      "mini:install-deps, --run and --exec keep provisioning unconditionally, so " +
        `${banned} must not appear in ensure-mini-venv.mjs`,
    );
  }
});

test("both shells share the hatch sets, the prose shape and the repair command", () => {
  const shells = [
    {
      name: "electron",
      hatch: readSource("./mini-dev-env.mjs"),
      warning: readSource("./dev-stack.mjs"),
    },
    {
      name: "tauri",
      hatch: readSource("../../tauri/scripts/mini-venv.mjs"),
      warning: readSource("../../tauri/scripts/mini-venv.mjs"),
    },
  ];
  for (const shell of shells) {
    assert.ok(
      shell.hatch.includes('["1", "true", "yes"]') && shell.hatch.includes('["1", "true"]'),
      `${shell.name} must keep the shared truthiness sets`,
    );
    assert.ok(
      shell.hatch.includes("KOMA_SKIP_MINI_BOOTSTRAP") && shell.hatch.includes("CI"),
      `${shell.name} must name both opt-outs`,
    );
    assert.ok(
      shell.warning.includes("auto-install is disabled"),
      `${shell.name} must use the shared skip prose`,
    );
    assert.ok(
      shell.warning.includes("will fail until you run"),
      `${shell.name} must state the consequence and point at the repair`,
    );
    assert.ok(
      shell.warning.includes("`bun run mini:install-deps`"),
      `${shell.name} must name the repair command`,
    );
  }
});

test("the interpreter guard is silent when the interpreter exists and actionable when it does not", () => {
  const venvDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-interpreter-guard-"));
  const pythonBin = path.join(
    venvDir,
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const logs = [];
  const args = { pythonBin, existsSync: fs.existsSync, log: (line) => logs.push(line) };

  assert.equal(missingInterpreterStatus(args), 1);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].includes(pythonBin));
  assert.ok(logs[0].includes("`bun run mini:install-deps`"));
  assert.ok(logs[0].includes("KOMA_PYTHON"));
  assert.equal(
    logs[0].includes("ENOENT"),
    false,
    "the guard replaces the ENOENT stack, it does not add to it",
  );

  fs.mkdirSync(path.dirname(pythonBin), { recursive: true });
  fs.writeFileSync(pythonBin, "interpreter image\n", "utf-8");
  assert.equal(missingInterpreterStatus(args), 0);
  assert.equal(logs.length, 1, "a present interpreter must print nothing");
});

test("the guard runs before any --run/--exec spawn", () => {
  const source = readSource("./ensure-mini-venv.mjs");
  const guard = source.indexOf("missingInterpreterStatus(");
  const spawn = source.indexOf("spawn(pythonBin");
  assert.ok(guard >= 0, "ensure-mini-venv.mjs must call the guard");
  assert.ok(
    spawn > guard,
    "no pythonBin spawn may be reachable before the guard has been consulted",
  );
});

const LAUNCHER_CANDIDATES = [
  { command: "py", args: ["-3.12"] },
  { command: "python", args: [] },
  { command: "python3", args: [] },
];

const findLauncher = () => {
  const override = (process.env.KOMA_PYTHON || "").trim();
  const candidates = override
    ? [{ command: override, args: [] }, ...LAUNCHER_CANDIDATES]
    : LAUNCHER_CANDIDATES;
  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.args, "-c", "import sys"], {
      stdio: "ignore",
    });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
};

const launcher = findLauncher();

const buildFakeProject = () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "koma-bootstrap-skip-"));
  const rootDir = path.join(base, "apps", "electron");
  const scriptsDir = path.join(rootDir, "scripts");
  const backendDir = path.join(base, "packages", "mini-backend");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(path.join(backendDir, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(backendDir, "scripts", "ensure-mini-deps.py"),
    "# installer v1\n",
    "utf-8",
  );
  fs.writeFileSync(path.join(backendDir, "requirements.txt"), "fastapi==1.0\n", "utf-8");
  for (const name of [
    "ensure-mini-venv.mjs",
    "mini-deps-marker.mjs",
    "mini-dev-env.mjs",
    "mini-venv-recreate.mjs",
    "mini-venv-probe.mjs",
  ]) {
    fs.copyFileSync(new URL(`./${name}`, import.meta.url), path.join(scriptsDir, name));
  }
  return { base, rootDir, venvDir: path.join(rootDir, ".venv-mini") };
};

const pythonBinOf = (venvDir) =>
  path.join(venvDir, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

const execChild = ({ rootDir, env }) =>
  spawnSync(
    process.execPath,
    [path.join(rootDir, "scripts", "ensure-mini-venv.mjs"), "--exec", "-c", "print(1)"],
    { cwd: rootDir, encoding: "utf8", env: { ...process.env, ...env }, timeout: 120_000 },
  );

test(
  "CI does not apply to --exec: the real script still runs the interpreter and prints 1",
  {
    skip:
      launcher === null ? "no Python 3.12 launcher (KOMA_PYTHON / py -3.12 / python) on this machine" : false,
  },
  () => {
    const { base, rootDir, venvDir } = buildFakeProject();
    const created = spawnSync(
      launcher.command,
      [...launcher.args, "-m", "venv", "--without-pip", venvDir],
      { stdio: "pipe", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `throwaway venv creation failed: ${created.stderr}`);
    const pythonBin = pythonBinOf(venvDir);
    assert.ok(fs.existsSync(pythonBin), `${pythonBin} must exist after the throwaway venv`);
    writeMiniDepsMarker(venvDir, computeMiniDepsMarkerHash(rootDir, { profile: "" }));

    const result = execChild({
      rootDir,
      env: { CI: "true", KOMA_SKIP_MINI_BOOTSTRAP: "1" },
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.ok(result.stdout.includes("1"));
    // The test venv has no packages (--without-pip), so the import probe
    // detects missing modules and falls through to the fake provisioner
    // (which exits 0), then --exec still runs print(1) successfully.
    assert.ok(
      result.stdout.includes("(marker match, probe passed). Skipping.") ||
      result.stdout.includes("Marker is fresh but the venv failed the import probe"),
      "the script must check the marker and run the import probe",
    );
    assert.equal(
      `${result.stdout}${result.stderr}`.includes("KOMA_SKIP_MINI_BOOTSTRAP"),
      false,
      "the hatch must not be consulted on this path — see the dev-stack-only scope",
    );
    fs.rmSync(base, { recursive: true, force: true });
  },
);

test("a launcher that cannot create the venv exits 1 without an ENOENT stack", () => {
  const { base, rootDir } = buildFakeProject();
  const result = execChild({
    rootDir,
    env: { CI: "true", KOMA_PYTHON: path.join(base, "no-such-launcher") },
  });
  assert.equal(result.status, 1);
  assert.equal(
    `${result.stdout}${result.stderr}`.includes("ENOENT"),
    false,
    "the failure must be a status the script chose, never a node spawn stack",
  );
  fs.rmSync(base, { recursive: true, force: true });
});
