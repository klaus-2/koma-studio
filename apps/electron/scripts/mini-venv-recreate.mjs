import path from "node:path";

const EXIT_RECREATE_REQUIRED = 4;

const SEAM_VARIABLES = ["MINI_DEPS_FAKE_UV_ARGV", "MINI_DEPS_FAKE_PYTHON_ARGV"];

export const testSeamNames = (env) =>
  SEAM_VARIABLES.filter(
    (name) => typeof env[name] === "string" && env[name].length > 0,
  );

export const missingInterpreterStatus = ({ pythonBin, existsSync, log }) => {
  if (existsSync(pythonBin)) {
    return 0;
  }
  log(
    `[mini:deps] .venv-mini has no interpreter at ${pythonBin}. Run ` +
      "`bun run mini:install-deps` to create it, or set KOMA_PYTHON to a Python 3.12 launcher.",
  );
  return 1;
};

export const maybeWriteMarker = ({ env, venvDir, markerHash, writeMarker, log }) => {
  const activeSeams = testSeamNames(env);
  if (activeSeams.length > 0) {
    log(
      `[mini:deps] Marker NOT written — test seam active (${activeSeams.join(", ")}). ` +
        "A provisioner run against a fake child installed nothing, so stamping it would " +
        "make every later run skip an empty venv. Unset " +
        `${SEAM_VARIABLES.join(" / ")} and re-run to write the marker.`,
    );
    return false;
  }
  writeMarker(venvDir, markerHash);
  log("[mini:deps] Marker saved — next runs will skip this step.");
  return true;
};

export const runProvisionerWithRecreate = ({
  venvDir,
  allowedVenvDir,
  pythonBin,
  provisionerPath,
  createCommand,
  createArgs,
  run,
  rmSync,
  existsSync,
  directoryBytes,
  log,
}) => {
  const status = run(pythonBin, [provisionerPath]);
  if (status !== EXIT_RECREATE_REQUIRED) {
    return status;
  }

  const resolvedTarget = path.resolve(venvDir);
  if (
    typeof allowedVenvDir !== "string" ||
    allowedVenvDir.trim() === "" ||
    !path.isAbsolute(allowedVenvDir) ||
    resolvedTarget !== path.resolve(allowedVenvDir)
  ) {
    throw new Error(
      `Refusing to delete: the recreate target ${resolvedTarget} does not resolve to the ` +
        `allowed venv directory (${allowedVenvDir}). No deletion and no create were performed.`,
    );
  }

  const byteCount = directoryBytes(venvDir);
  log(
    `[mini:venv] The provisioner proved this environment unusable (exit ${EXIT_RECREATE_REQUIRED}): ` +
      "recreating it is this shell's rung, and it runs exactly once.",
  );
  log(`[mini:venv] Recreating ${venvDir} (${byteCount} bytes).`);
  rmSync(allowedVenvDir, { recursive: true, force: true });
  run(createCommand, createArgs);

  if (!existsSync(pythonBin)) {
    log(
      `[mini:venv] The recreated venv has no interpreter at ${pythonBin} — the create command ` +
        "did not produce one, so provisioning cannot be re-run. Check KOMA_PYTHON (or py/python3).",
    );
    return 1;
  }

  const retryStatus = run(pythonBin, [provisionerPath]);
  if (retryStatus === EXIT_RECREATE_REQUIRED) {
    log(
      "[mini:venv] recreate did not fix it — the provisioner still reports this environment " +
        "unusable. Its error line above names the stage, the exit code and the captured output.",
    );
    return 1;
  }
  return retryStatus;
};
