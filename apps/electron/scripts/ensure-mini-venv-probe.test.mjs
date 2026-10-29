import test from "node:test";
import assert from "node:assert/strict";
import { CUDA_PROVIDER_PROBE_SNIPPET } from "../../tauri/scripts/lib/mini-venv-gpu.mjs";
import {
  buildQueryProbe,
  queryVenv,
  QUERY_MODULES,
  QUERY_PROBE,
  QUERY_TIMEOUT_MS,
  requiresNvidiaProviderProbe,
} from "./mini-venv-probe.mjs";

const PYTHON_PATH = "/usr/bin/python";

// ---------------------------------------------------------------------------
// Fake spawnSync factory — returns a callable that records its invocations
// and yields a predetermined result.
// ---------------------------------------------------------------------------
const fakeSpawnSync = ({ status = 0, error, stderr = "" } = {}) => {
  const calls = [];
  const fn = (command, args, options) => {
    calls.push({ command, args, options });
    return {
      status,
      error,
      stdout: Buffer.from(""),
      stderr: Buffer.from(stderr),
    };
  };
  fn.calls = calls;
  return fn;
};

// ---------------------------------------------------------------------------
// queryVenv: return-shape tests
// ---------------------------------------------------------------------------

test("probe passes when the interpreter exits 0 with no error", () => {
  const spawn = fakeSpawnSync({ status: 0 });
  const result = queryVenv(PYTHON_PATH, spawn);
  assert.equal(result.ok, true);
  assert.equal(result.errored, false);
  assert.equal(result.status, 0);
});

test("probe passes the expected Python source, stdio, and timeout to spawnSync", () => {
  const spawn = fakeSpawnSync({ status: 0 });
  queryVenv(PYTHON_PATH, spawn);

  assert.equal(spawn.calls.length, 1);
  const { command, args, options } = spawn.calls[0];
  assert.equal(command, PYTHON_PATH);
  assert.equal(args[0], "-c");
  const source = args[1];
  assert.ok(
    source.startsWith(`import ${QUERY_MODULES.join(", ")}`),
    `probe source must start with the import line, got: ${source.slice(0, 60)}`,
  );
  assert.ok(source.includes("imencode"), "probe source must check cv2.imencode");
  assert.ok(source.includes("raise SystemExit"), "probe source must raise on missing symbol");
  assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
  assert.equal(options.timeout, QUERY_TIMEOUT_MS);
});

test("probe fails when the interpreter exits non-zero", () => {
  const spawn = fakeSpawnSync({
    status: 1,
    stderr: "ImportError: No module named 'cv2'",
  });
  const result = queryVenv(PYTHON_PATH, spawn);
  assert.equal(result.ok, false);
  assert.equal(result.errored, false);
  assert.equal(result.status, 1);
  assert.ok(result.stderrTail.includes("ImportError"));
});

test("probe is errored when spawnSync reports an error (e.g. timeout or ENOENT)", () => {
  const spawn = fakeSpawnSync({
    status: null,
    error: new Error("ETIMEDOUT"),
  });
  const result = queryVenv(PYTHON_PATH, spawn);
  assert.equal(result.ok, false);
  assert.equal(result.errored, true);
  assert.equal(result.status, null);
});

test("stderrTail returns '<no output captured>' when stderr is empty", () => {
  const spawn = fakeSpawnSync({ status: 1, stderr: "" });
  const result = queryVenv(PYTHON_PATH, spawn);
  assert.equal(result.stderrTail, "<no output captured>");
});

test("stderrTail collapses multi-line stderr into a single line", () => {
  const spawn = fakeSpawnSync({
    status: 1,
    stderr:
      "Traceback (most recent call last):\n  File '<string>', line 1\nImportError: no cv2",
  });
  const result = queryVenv(PYTHON_PATH, spawn);
  assert.equal(result.stderrTail.includes("\n"), false);
  assert.ok(result.stderrTail.includes("\u23CE"), "newlines must be replaced with the return symbol");
  assert.ok(result.stderrTail.includes("ImportError"));
});

// ---------------------------------------------------------------------------
// Decision-shape tests
//
// ensure-mini-venv.mjs makes three decisions based on queryVenv output:
//   1. ok:true                              → skip provisioning (marker match, probe passed)
//   2. ok:false, errored:false, status!=null → rebuild (marker fresh, probe failed)
//   3. ok:false, errored:true || status==null → no rebuild (unclassified)
//
// These tests verify the contract that the script relies on.
// ---------------------------------------------------------------------------

test("marker-fresh + probe passes: ok is true — the script skips provisioning", () => {
  const spawn = fakeSpawnSync({ status: 0 });
  const query = queryVenv(PYTHON_PATH, spawn);
  assert.equal(query.ok, true, "ok:true triggers the skip path");
});

test("marker-fresh + probe fails (exit 1): the script falls through to provisioner", () => {
  const spawn = fakeSpawnSync({
    status: 1,
    stderr: "cv2 has no native module",
  });
  const query = queryVenv(PYTHON_PATH, spawn);
  // The script checks: not ok, not errored, status is set → needsProvisioning stays true
  assert.equal(query.ok, false, "ok must be false for a failed import");
  assert.equal(query.errored, false, "errored must be false (the interpreter ran)");
  assert.notEqual(query.status, null, "status must be set (not a launch failure)");
});

test("probe unclassified (errored): the script does NOT trigger a rebuild", () => {
  const spawn = fakeSpawnSync({
    status: null,
    error: new Error("ETIMEDOUT"),
  });
  const query = queryVenv(PYTHON_PATH, spawn);
  assert.equal(query.ok, false);
  assert.equal(
    query.errored || query.status === null,
    true,
    "the unclassified guard (errored || status===null) must catch this case",
  );
});

test("probe unclassified (null status without error): the script does NOT trigger a rebuild", () => {
  // Possible when the process is killed by signal — status is null but error is undefined.
  const spawn = fakeSpawnSync({ status: null });
  const query = queryVenv(PYTHON_PATH, spawn);
  assert.equal(query.ok, false);
  assert.equal(
    query.errored || query.status === null,
    true,
    "the unclassified guard must catch null-status even without an error object",
  );
});

// ---------------------------------------------------------------------------
// Constant sanity checks
// ---------------------------------------------------------------------------

test("QUERY_MODULES lists the four expected modules", () => {
  assert.deepEqual(QUERY_MODULES, ["fastapi", "onnxruntime", "torch", "cv2"]);
});

test("QUERY_PROBE checks for the cv2.imencode symbol", () => {
  assert.ok(QUERY_PROBE.includes("imencode"));
  assert.ok(QUERY_PROBE.includes("raise SystemExit"));
});

test("QUERY_TIMEOUT_MS is 120 seconds", () => {
  assert.equal(QUERY_TIMEOUT_MS, 120_000);
});

// ---------------------------------------------------------------------------
// NVIDIA provider probe
//
// onnxruntime (CPU) and onnxruntime-gpu share one package namespace: a venv
// whose GPU wheel was clobbered by the CPU package still imports cleanly, so
// the CUDA-profile probe must assert the execution provider itself.
// ---------------------------------------------------------------------------

test("requiresNvidiaProviderProbe is true only for nvidia-* profiles", () => {
  assert.equal(requiresNvidiaProviderProbe("nvidia-cuda"), true);
  assert.equal(requiresNvidiaProviderProbe("nvidia-cuda-legacy"), true);
  assert.equal(requiresNvidiaProviderProbe("nvidia-tensorrt"), true);
  assert.equal(requiresNvidiaProviderProbe("cpu"), false);
  assert.equal(requiresNvidiaProviderProbe("amd-rocm"), false);
  assert.equal(requiresNvidiaProviderProbe(""), false);
  assert.equal(requiresNvidiaProviderProbe(undefined), false);
});

test("buildQueryProbe keeps the base probe for non-NVIDIA profiles", () => {
  assert.equal(buildQueryProbe("cpu"), QUERY_PROBE);
  assert.equal(buildQueryProbe(""), QUERY_PROBE);
  assert.equal(buildQueryProbe(undefined), QUERY_PROBE);
});

test("buildQueryProbe asserts the CUDA provider for NVIDIA profiles", () => {
  const probe = buildQueryProbe("nvidia-cuda-legacy");
  assert.ok(probe.startsWith(QUERY_PROBE), "the cv2 check must stay in front");
  assert.ok(probe.includes("get_available_providers"));
  assert.ok(probe.includes("CUDAExecutionProvider"));
  assert.ok(probe.includes("raise SystemExit"));
});

test("queryVenv forwards the profile into the probe source", () => {
  const spawn = fakeSpawnSync({ status: 0 });
  queryVenv(PYTHON_PATH, spawn, "nvidia-cuda-legacy");
  assert.equal(spawn.calls.length, 1);
  assert.ok(
    spawn.calls[0].args[1].includes("CUDAExecutionProvider"),
    "the NVIDIA profile must extend the probe with the provider assertion",
  );

  const plainSpawn = fakeSpawnSync({ status: 0 });
  queryVenv(PYTHON_PATH, plainSpawn, "cpu");
  assert.equal(
    plainSpawn.calls[0].args[1].includes("CUDAExecutionProvider"),
    false,
    "non-NVIDIA profiles must keep the base probe",
  );
});

test("the CUDA provider probe stays in lockstep with the Tauri shell", () => {
  const probe = buildQueryProbe("nvidia-cuda-legacy");
  assert.ok(
    probe.includes(CUDA_PROVIDER_PROBE_SNIPPET),
    "the Electron probe must embed the Tauri shell's canonical CUDA snippet " +
    "verbatim (apps/tauri/scripts/lib/mini-venv-gpu.mjs) — the two shells " +
    "detect the same clobbered-ort state or neither does",
  );
  assert.equal(
    buildQueryProbe("cpu").includes(CUDA_PROVIDER_PROBE_SNIPPET),
    false,
    "the snippet is NVIDIA-only in both shells",
  );
});
