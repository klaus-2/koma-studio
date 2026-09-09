import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// monorepo: dependencies may be hoisted to the root — resolve by module,
// not by path relative to cwd
const nextBin = fileURLToPath(import.meta.resolve("next/dist/bin/next"));

const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});

process.exit(result.status ?? 1);
