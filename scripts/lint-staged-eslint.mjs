// lint-staged executes task strings without a shell, so `cd <app> && eslint`
// cannot run. This wrapper receives the staged paths, groups them by app and
// runs that app's ESLint from its own directory (flat config resolves from cwd).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lintedApps = ["apps/tauri", "apps/electron"];
const files = process.argv
  .slice(2)
  .map((file) => path.resolve(repoRoot, file))
  .filter((file) => existsSync(file));

let failed = false;

for (const app of lintedApps) {
  const appDir = path.join(repoRoot, app);
  const owned = files.filter((file) => file.startsWith(`${appDir}${path.sep}`));
  if (owned.length === 0) continue;

  const requireFromApp = createRequire(path.join(appDir, "package.json"));
  const eslintBin = path.join(path.dirname(requireFromApp.resolve("eslint/package.json")), "bin/eslint.js");
  const relativeFiles = owned.map((file) => path.relative(appDir, file));
  const result = spawnSync(
    process.execPath,
    [eslintBin, "--fix", "--no-warn-ignored", ...relativeFiles],
    { cwd: appDir, stdio: "inherit" },
  );
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
