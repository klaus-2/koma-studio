import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Extracts every part of every profile in a per-platform runtime manifest and
 * smoke-runs the packaged entry binary until /health answers. Partitioning
 * bugs (a file missing or duplicated across parts) detonate here in CI,
 * not at sidecar launch on a user machine.
 *
 * Usage: node scripts/smoke-runtime-parts.mjs <artifacts-dir>
 */

const artifactsDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("runtime-artifacts", "mini-backend-artifacts");

const manifestFile = `mini-backend-latest-${process.platform}-${process.arch}.json`;
const manifestPath = path.join(artifactsDir, manifestFile);
if (!fs.existsSync(manifestPath)) {
  throw new Error(`manifest not found: ${manifestPath}`);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.schemaVersion !== 2) {
  throw new Error(`expected schemaVersion 2, found ${manifest.schemaVersion}`);
}

const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "koma-runtime-smoke-"));

const extractPart = (partFile, destinationDir) => {
  const result = spawnSync(
    process.platform === "win32" ? "py" : "python3",
    [
      ...(process.platform === "win32" ? ["-3.12"] : []),
      "-m",
      "zipfile",
      "-e",
      path.join(artifactsDir, partFile),
      destinationDir,
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    throw new Error(`extract failed for ${partFile}: ${result.stderr}`);
  }
};

const waitForHealth = async (baseUrl, child) => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`entry binary exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(1_500),
        headers: { "x-koma-local-session": "smoke-secret" },
      });
      if (response.ok || response.status === 401 || response.status === 403) {
        // Any of these proves the HTTP server is up and gated.
        return;
      }
    } catch {
      // still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`entry binary did not answer /health at ${baseUrl}`);
};

const run = async () => {
  const profiles = Object.values(manifest.profiles ?? {});
  if (profiles.length === 0) {
    throw new Error("manifest carries no profiles");
  }

  for (const profile of profiles) {
    const installDir = path.join(smokeRoot, `${profile.version}-${profile.profile}`);
    // One clean tree, parts extracted in order — the same shape the shells
    // install on a user machine.
    for (const part of profile.parts) {
      extractPart(part.file, installDir);
    }
    const entryPath = path.join(installDir, profile.entry);
    if (!fs.existsSync(entryPath)) {
      throw new Error(
        `union-completeness violation: entry ${profile.entry} missing after extracting ${profile.parts.length} part(s) of ${profile.profile}`,
      );
    }
    if (process.platform !== "win32") {
      // Python's zipfile extraction drops the executable bit; restore it
      // before spawning the packaged entry.
      fs.chmodSync(entryPath, 0o755);
    }

    const port = 18800 + Math.floor(Math.random() * 100);
    const stderrTail = [];
    const child = spawn(entryPath, [], {
      cwd: installDir,
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        PORT: String(port),
        KOMA_MODELS_ROOT: path.join(smokeRoot, "models"),
        KOMA_LOCAL_API_SESSION_SECRET: "smoke-secret",
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
        MINI_BACKEND_WARMUP_DETECTOR: "0",
        MINI_BACKEND_ACCELERATION_PROFILE: profile.profile,
      },
    });
    child.stderr.on("data", (chunk) => {
      if (stderrTail.length < 400) {
        stderrTail.push(String(chunk));
      }
    });
    try {
      await waitForHealth(`http://127.0.0.1:${port}`, child);
      console.log(`[smoke-runtime] ${profile.profile}: healthy after ${profile.parts.length} part(s)`);
    } catch (error) {
      if (stderrTail.length > 0) {
        console.error(
          `[smoke-runtime] ${profile.profile} stderr tail:\n${stderrTail.join("").split("\n").slice(-12).join("\n")}`,
        );
      }
      throw error;
    } finally {
      if (process.platform === "win32") {
        spawnSync(`taskkill /PID ${child.pid} /T /F`, { shell: true, stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    }
  }

  fs.rmSync(smokeRoot, { recursive: true, force: true });
  console.log(`[smoke-runtime] verified ${manifestFile}`);
};

run().catch((error) => {
  console.error(`[smoke-runtime] error: ${error.message}`);
  process.exit(1);
});
