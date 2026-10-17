import path from "node:path";

export const EXIT_UNUSABLE = 4;

const MAX_CHILD_OUTPUT_CHARS = 4096;
const NO_CHILD_OUTPUT = "<no output captured>";

const outputTail = (data) => {
  const text = (data ?? "").toString().replace(/\r\n/g, "\n").trim();
  if (text === "") return NO_CHILD_OUTPUT;
  return text.slice(-MAX_CHILD_OUTPUT_CHARS).replace(/\n/g, "⏎");
};

export const runImportQuery = ({ pythonPath, modules, spawnSync, timeout }) => {
  const result = spawnSync(pythonPath, ["-c", `import ${modules.join(", ")}`], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  return {
    ok: !result.error && result.status === 0,
    errored: Boolean(result.error),
    status: result.status ?? null,
    stderrTail: outputTail(result.stderr),
  };
};

export const classifyTauriVerdict = ({ readiness, query = null }) => {
  if (!readiness.ready) {
    return { verdict: "needs-provisioning", exitCode: 1, reason: readiness.reason };
  }
  if (query === null || !readiness.stampedMatch) {
    return { verdict: "ready", exitCode: 0, reason: readiness.reason };
  }
  if (query.errored) {
    return {
      verdict: "unclassified",
      exitCode: 1,
      reason: "the venv interpreter could not be launched at all — no verdict, nothing deleted",
    };
  }
  if (query.status === null) {
    return {
      verdict: "unclassified",
      exitCode: 1,
      reason: `the import query returned no exit code (${query.stderrTail}) — no verdict, nothing deleted`,
    };
  }
  if (query.ok) {
    return { verdict: "ready", exitCode: 0, reason: `${readiness.reason}; imports resolve` };
  }
  return {
    verdict: "unusable",
    exitCode: EXIT_UNUSABLE,
    reason: `the venv's own interpreter failed the import query (exit ${query.status}): ${query.stderrTail}`,
  };
};

export const runRecreateOnce = ({
  venvDir,
  allowedVenvDir,
  pythonPath,
  reason,
  rmSync,
  existsSync,
  sizeOf,
  createCommand,
  createArgs,
  run,
  install,
  log,
}) => {
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

  const byteCount = sizeOf(venvDir);
  log(
    `[mini:venv] An install that ran proved this environment unusable (${reason}) — ` +
      "recreating it is this shell's rung, and it runs exactly once.",
  );
  log(`[mini:venv] Recreating ${venvDir} (${byteCount} bytes).`);
  rmSync(allowedVenvDir, { recursive: true, force: true });
  run(createCommand, createArgs);

  if (!existsSync(pythonPath)) {
    log(
      `[mini:venv] The recreated venv has no interpreter at ${pythonPath} — the create command ` +
        "did not produce one, so the install cannot be re-run. Check MINI_BACKEND_PYTHON.",
    );
    return {
      verdict: "needs-provisioning",
      exitCode: 1,
      reason: `the recreated venv has no interpreter at ${pythonPath}`,
    };
  }

  const retry = install();
  if (retry.verdict === "unusable") {
    log(`[mini:venv] recreate did not fix it — ${retry.reason}`);
    return { verdict: "unusable", exitCode: 1, reason: retry.reason };
  }
  return retry;
};
