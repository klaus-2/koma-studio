/**
 * Dev Python runtime resolution + PSD dependency bootstrap.
 */
import fs from "node:fs";
import { buildDevPythonRuntimePathCandidates } from "../dev-python-runtime.ts";
import type { MiniBackendAccelerationProfile } from "../mini-backend-runtime.ts";
import {
  canRunCommand,
  runCommand,
  type MiniBackendCommandSpec,
} from "./mini-backend-packaged.ts";

const resolveDevPythonRuntime = (
  profile: MiniBackendAccelerationProfile,
): { command: string; args: string[] } => {
  const override = (process.env.MINI_BACKEND_PYTHON ?? "").trim();
  if (override) {
    return { command: override, args: [] };
  }

  const localCandidatePaths = buildDevPythonRuntimePathCandidates(
    profile,
    process.cwd(),
    process.platform,
  );
  for (const candidatePath of localCandidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return { command: candidatePath, args: [] };
    }
  }

  const candidates =
    process.platform === "win32"
      ? [
          { command: "py", args: ["-3.12"] },
          { command: "python", args: [] },
        ]
      : [
          { command: "python3.12", args: [] },
          { command: "python3", args: [] },
          { command: "python", args: [] },
        ];

  const rootDir = process.cwd();
  for (const candidate of candidates) {
    if (canRunCommand(candidate.command, [...candidate.args, "-c", "import sys"], rootDir)) {
      return candidate;
    }
  }

  return candidates[0];
};

const ensureMiniBackendDevDependencies = (
  spec: MiniBackendCommandSpec,
  isDev: boolean,
): void => {
  if (!isDev || !spec.dependencyCheck || !spec.dependencyInstall) {
    return;
  }

  if (runCommand(spec.dependencyCheck)) {
    return;
  }

  console.warn(
    "[mini-backend] Dependencias de exportacao PSD ausentes. Instalando psd-tools e photoshop-python-api no runtime ativo...",
  );
  const installOk = runCommand(spec.dependencyInstall);
  if (!installOk) {
    console.error(
      `[mini-backend] Failed to install PSD dependencies automatically. Run manually: ${spec.dependencyInstall.command} ${spec.dependencyInstall.args.join(" ")}`,
    );
    return;
  }

  if (!runCommand(spec.dependencyCheck)) {
    console.error("[mini-backend] Dependencias PSD continuam indisponiveis apos instalacao automatica.");
  }
};

export { ensureMiniBackendDevDependencies, resolveDevPythonRuntime };
