import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const npmCommand = "bun";

const main = () => {
  // shell:false (matching dev-stack.mjs) keeps bun as the direct child of this
  // node process, so dev-stack's `taskkill /pid <bun.pid> /t /f` reaches the
  // whole tree. With shell:true Node spawns cmd.exe as an intermediate; once
  // cmd exits, the python tree is reparented and taskkill /T no longer walks
  // it, leaving the mini-backend alive to hold port 8001.
  const child = spawn(npmCommand, ["run", "dev:mini"], {
    cwd: rootDir,
    shell: false,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
};

main();
