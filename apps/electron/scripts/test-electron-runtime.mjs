import { execSync } from "node:child_process";

execSync("node --no-warnings --test electron/tests/*.test.ts", {
  stdio: "inherit",
  shell: true,
});
