import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AUTH_DISABLED_KEY,
  readEnvFileValue,
  resolveAccelerationProfile,
  resolveAuthDisabled,
  withAccelerationProfile,
} from "./mini-dev-env.mjs";
import { computeMiniDepsMarkerHash } from "./mini-deps-marker.mjs";
import { isAuthDisabledFlag } from "@koma/types/auth-disabled";

const buildFakeProject = ({ envFileBodies }) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "koma-dev-env-"));
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

const PROFILE = "MINI_BACKEND_ACCELERATION_PROFILE";

test("nothing declares VITE_AUTH_DISABLED, so the dev stack runs local-only", () => {
  const rootDir = buildFakeProject({
    envFileBodies: { ".env.development": "VITE_API_BASE=http://localhost\n" },
  });

  assert.equal(resolveAuthDisabled(rootDir, {}), true);
});

test("an explicit false keeps the auth server in the dev stack", () => {
  const rootDir = buildFakeProject({
    envFileBodies: { ".env.development": "VITE_AUTH_DISABLED=false\n" },
  });

  assert.equal(resolveAuthDisabled(rootDir, {}), false);
  assert.equal(resolveAuthDisabled(rootDir, { VITE_AUTH_DISABLED: "true" }), true);
});

test("the process environment outranks the env files", () => {
  const rootDir = buildFakeProject({
    envFileBodies: { ".env.development": "VITE_AUTH_DISABLED=true\n" },
  });

  assert.equal(resolveAuthDisabled(rootDir, { VITE_AUTH_DISABLED: "false" }), false);
});

test("the highest-precedence env file decides the flag", () => {
  const rootDir = buildFakeProject({
    envFileBodies: {
      ".env.development.local": "VITE_AUTH_DISABLED=false\n",
      ".env.development": "VITE_AUTH_DISABLED=true\n",
    },
  });

  assert.equal(resolveAuthDisabled(rootDir, {}), false);
});

test("the dev stack keeps the renderer's tri-state, unreadable values included", () => {
  for (const value of ["true", "false", "1", "0", "yes", "no", "TRUE", "on", "maybe"]) {
    const rootDir = buildFakeProject({
      envFileBodies: { ".env.development": `${AUTH_DISABLED_KEY}=${value}\n` },
    });

    assert.equal(
      resolveAuthDisabled(rootDir, {}),
      isAuthDisabledFlag(value, true),
      `the dev stack diverged from the renderer on ${JSON.stringify(value)}`,
    );
  }
});


test("nothing declares the profile, so the dev bootstrap keeps the auto behavior", () => {
  const rootDir = buildFakeProject({
    envFileBodies: { ".env.development": "VITE_API_BASE=http://localhost\n" },
  });

  assert.deepEqual(resolveAccelerationProfile(rootDir, {}), {
    profile: "",
    source: "undeclared",
  });
});

test("the resolved profile is normalized and comes from the highest-precedence file", () => {
  const rootDir = buildFakeProject({
    envFileBodies: {
      ".env.development.local": `${PROFILE}=" NVIDIA-CUDA-Legacy "\n`,
      ".env.development": `${PROFILE}='cpu'\n`,
    },
  });

  assert.deepEqual(resolveAccelerationProfile(rootDir, {}), {
    profile: "nvidia-cuda-legacy",
    source: ".env.development.local",
  });
});

test("process.env outranks a conflicting .env.development", () => {
  const rootDir = buildFakeProject({
    envFileBodies: { ".env.development": `${PROFILE}='nvidia-cuda-legacy'\n` },
  });

  assert.deepEqual(
    resolveAccelerationProfile(rootDir, { [PROFILE]: "CPU" }),
    { profile: "cpu", source: "process.env" },
  );
});

test("an empty process.env value is not a declaration", () => {
  const rootDir = buildFakeProject({
    envFileBodies: { ".env.development": `${PROFILE}='nvidia-cuda-legacy'\n` },
  });

  assert.equal(
    resolveAccelerationProfile(rootDir, { [PROFILE]: "  " }).profile,
    "nvidia-cuda-legacy",
  );
});

test("the profile written into the marker hash is the profile the provisioner child receives", () => {
  const rootDir = buildFakeProject({
    envFileBodies: { ".env.development": `${PROFILE}='nvidia-cuda-legacy'\n` },
  });
  const { profile } = resolveAccelerationProfile(rootDir, {});
  const childEnv = withAccelerationProfile({ PATH: "/bin" }, profile);

  assert.equal(childEnv[PROFILE], profile);
  assert.equal(
    computeMiniDepsMarkerHash(rootDir, { profile }),
    computeMiniDepsMarkerHash(rootDir, { profile: childEnv[PROFILE] }),
  );
  assert.notEqual(
    computeMiniDepsMarkerHash(rootDir, { profile: childEnv[PROFILE] }),
    computeMiniDepsMarkerHash(rootDir, { profile: "" }),
  );
});

const legacyAuthDisabledGrep = (rootDir) => {
  for (const envPath of [
    path.join(rootDir, ".env.development.local"),
    path.join(rootDir, ".env.local"),
    path.join(rootDir, ".env.development"),
    path.join(rootDir, ".env"),
  ]) {
    if (!fs.existsSync(envPath)) {
      continue;
    }
    const match = fs
      .readFileSync(envPath, "utf8")
      .match(/^\s*VITE_AUTH_DISABLED\s*=\s*["']?([^"'\r\n#]+)["']?/m);
    if (match) {
      return match[1];
    }
  }
  return "";
};

test("readEnvFileValue returns what dev-stack.mjs's original regex returned", () => {
  const fixtures = [
    { ".env.development": "VITE_AUTH_DISABLED=true\n" },
    { ".env.development": 'VITE_AUTH_DISABLED = "true" # local-only\n' },
    { ".env": "VITE_AUTH_DISABLED=yes\n", ".env.development": "OTHER=1\n" },
    {
      ".env": "VITE_AUTH_DISABLED=true\n",
      ".env.development": "VITE_AUTH_DISABLED=false\n",
    },
    { ".env.local": "VITE_AUTH_DISABLED='1'\n" },
    { ".env.development": "UNRELATED=1\n" },
  ];

  for (const envFileBodies of fixtures) {
    const rootDir = buildFakeProject({ envFileBodies });
    assert.equal(
      readEnvFileValue(rootDir, "VITE_AUTH_DISABLED"),
      legacyAuthDisabledGrep(rootDir),
      JSON.stringify(envFileBodies),
    );
  }
});

test("the build flows keep their own argv-first resolution", () => {
  for (const script of [
    "./build-mini-backend.mjs",
    "../../tauri/scripts/build-hardened-release.mjs",
  ]) {
    const source = fs.readFileSync(new URL(script, import.meta.url), "utf-8");
    assert.equal(
      source.includes("mini-dev-env.mjs"),
      false,
      `${script} must not import the dev reader: its --profile/explicit-env answer already wins`,
    );
  }
});

test("only the provisioner spawn receives the resolved profile", () => {
  const source = fs.readFileSync(
    new URL("./ensure-mini-venv.mjs", import.meta.url),
    "utf-8",
  );
  const [bootstrap, runAndExec] = source.split('if (flag === "--run")');
  assert.equal(bootstrap.includes("env: provisionerChildEnv"), true);
  assert.equal(
    runAndExec.includes("env:"),
    false,
    "the --run/--exec children keep inheriting the shell environment unchanged",
  );
});

