#!/usr/bin/env node
// Cross-platform helper: creates .venv-mini if missing, installs mini-backend
// dependencies, and runs Python through the venv interpreter.
//   node scripts/ensure-mini-venv.mjs                → venv + deps only
//   node scripts/ensure-mini-venv.mjs --run  [args]  → venv + deps + scripts/run-mini-backend.py [args]
//   node scripts/ensure-mini-venv.mjs --exec [args]  → venv + deps + python [args] (e.g. -m pytest ...)
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  computeMiniDepsMarkerHash,
  isMiniDepsMarkerFresh,
  writeMiniDepsMarker,
} from "./mini-deps-marker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const venvDir = path.join(rootDir, ".venv-mini");
const pythonBin = process.platform === "win32"
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");

const flag = process.argv[2];
const passthroughArgs = process.argv.slice(3);

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

// Bootstrap without an explicit profile: "" preserves the ONNX variant already
// installed (the canonical installer filters out the CPU pin when GPU/OpenVINO
// is present) — the dev stack must not downgrade the profile the app selected
// or auto-detected. Build flows keep passing concrete profiles.
const activeProfile = (process.env.MINI_BACKEND_ACCELERATION_PROFILE || "")
  .trim()
  .toLowerCase();
const depsMarkerHash = computeMiniDepsMarkerHash(rootDir, {
  profile: activeProfile,
});

if (!existsSync(pythonBin)) {
  console.log(
    "[mini:deps] First run detected: creating the mini-backend virtual environment and installing dependencies.",
  );
  console.log(
    "[mini:deps] This happens automatically and only takes long the first time.",
  );
  const basePython = process.env.KOMA_PYTHON ?? (process.platform === "win32" ? "py" : "python3");
  const createArgs = basePython === "py" ? ["-3.12", "-m", "venv", venvDir] : ["-m", "venv", venvDir];
  run(basePython, createArgs);
}

if (isMiniDepsMarkerFresh(venvDir, depsMarkerHash)) {
  console.log(
    `[mini:deps] Dependencies already installed${activeProfile ? ` for profile '${activeProfile}'` : ""} (marker match). Skipping.`,
  );
} else {
  if (existsSync(pythonBin)) {
    console.log(
      "[mini:deps] Dependencies or profile changed since the last install. Updating...",
    );
  }
  // monorepo: canonical installer lives in the shared backend package
  run(pythonBin, [path.join(__dirname, "..", "..", "..", "packages", "mini-backend", "scripts", "ensure-mini-deps.py")]);
  writeMiniDepsMarker(venvDir, depsMarkerHash);
  console.log("[mini:deps] Marker saved — next runs will skip this step.");
}

if (flag === "--run") {
  const args = [path.join(__dirname, "run-mini-backend.py"), ...passthroughArgs];
  const child = spawn(pythonBin, args, {
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
} else if (flag === "--exec") {
  const child = spawn(pythonBin, passthroughArgs, {
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
