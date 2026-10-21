/**
 * Packaged mini-backend binary + launch manifest resolution.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  MiniBackendLaunchManifest,
  MiniBackendRuntimeSource,
} from "../mini-backend-runtime.ts";

interface CommandSpec {
  command: string;
  args: string[];
  cwd: string;
}

interface MiniBackendCommandSpec extends CommandSpec {
  dependencyCheck?: CommandSpec;
  dependencyInstall?: CommandSpec;
  env?: Record<string, string>;
  runtimeSource?: MiniBackendRuntimeSource;
  installDir?: string | null;
  version?: string | null;
}

const resolvePackagedMiniBackendBinary = (entryFileName?: string): string => {
  const miniBackendDir = path.join(process.resourcesPath, "mini-backend");
  if (entryFileName) {
    const explicitPath = path.join(miniBackendDir, entryFileName);
    if (fs.existsSync(explicitPath)) {
      return explicitPath;
    }
  }
  const candidateNames =
    process.platform === "win32"
      ? ["mini-backend.exe", "mini-backend"]
      : ["mini-backend", "mini-backend.exe"];

  for (const fileName of candidateNames) {
    const candidatePath = path.join(miniBackendDir, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `Mini backend binary not found in packaged resources. Looked for: ${candidateNames.join(", ")}`,
  );
};

const readPackagedMiniBackendManifest = (): MiniBackendLaunchManifest | null => {
  const manifestPath = path.join(process.resourcesPath, "mini-backend", "launch-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as MiniBackendLaunchManifest;
    return parsed;
  } catch {
    return null;
  }
};

const canRunCommand = (command: string, args: string[], cwd: string): boolean => {
  try {
    execFileSync(command, args, {
      cwd,
      stdio: "ignore",
      windowsHide: true,
      timeout: 8_000,
    });
    return true;
  } catch {
    return false;
  }
};

const runCommand = (spec: CommandSpec): boolean =>
  canRunCommand(spec.command, spec.args, spec.cwd);

export type { CommandSpec, MiniBackendCommandSpec };
export {
  canRunCommand,
  readPackagedMiniBackendManifest,
  resolvePackagedMiniBackendBinary,
  runCommand,
};
