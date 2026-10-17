import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const buildFakeProject = ({ envFileBodies }) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "koma-bootstrap-profile-"));
  const rootDir = path.join(base, "apps", "electron");
  fs.mkdirSync(path.join(rootDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(base, "packages", "mini-backend", "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "packages", "mini-backend", "scripts", "ensure-mini-deps.py"),
    "# installer v1\n",
    "utf-8",
  );
  fs.writeFileSync(
    path.join(base, "packages", "mini-backend", "requirements.txt"),
    "fastapi==1.0\n",
    "utf-8",
  );
  for (const [name, body] of Object.entries(envFileBodies)) {
    fs.writeFileSync(path.join(rootDir, name), body, "utf-8");
  }
  return rootDir;
};

test("a profile declared only in .env.development is the profile the dev bootstrap provisions", async () => {
  const rootDir = buildFakeProject({
    envFileBodies: {
      ".env.development": "MINI_BACKEND_ACCELERATION_PROFILE='nvidia-cuda-legacy'\n",
    },
  });

  const { readEnvFileValue } = await import("./mini-dev-env.mjs");
  assert.equal(
    readEnvFileValue(rootDir, "MINI_BACKEND_ACCELERATION_PROFILE"),
    "nvidia-cuda-legacy",
  );
});
