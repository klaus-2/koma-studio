#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isDirectExecution } from "./lib/is-direct-execution.mjs";

const MAX_LINK_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(appRoot, "src-tauri", "Cargo.toml");

export const resolveDevFeatureArgs = (cargoTomlText) => {
  const match = cargoTomlText.match(/(?:^|\n)[ \t]*default\s*=\s*\[([^\]]*)\]/);
  if (!match) {
    return [];
  }
  const devFeatures = match[1]
    .split(",")
    .map((feature) => feature.trim().replace(/^["']|["']$/g, ""))
    .filter((feature) => feature !== "" && !feature.includes("custom-protocol"));
  return ["--no-default-features", ...(devFeatures.length > 0 ? ["--features", devFeatures.join(",")] : [])];
};

export const isTransientLinkerFailure = (output) => output.includes("LNK1104");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const warmUp = async () => {
  let featureArgs;
  try {
    featureArgs = resolveDevFeatureArgs(readFileSync(manifestPath, "utf8"));
  } catch {
    console.error(`✖ cannot read ${manifestPath} — the Tauri Rust crate is missing.`);
    return 1;
  }

  for (let attempt = 1; attempt <= MAX_LINK_ATTEMPTS; attempt += 1) {
    const result = spawnSync("cargo", ["build", "--manifest-path", manifestPath, ...featureArgs], {
      cwd: appRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    if (result.error) {
      console.error(
        `✖ could not run cargo (${result.error.message}). The Tauri desktop app needs the Rust toolchain: https://rustup.rs`,
      );
      return 1;
    }
    if (result.status === 0) {
      const recovered = attempt > 1 ? ` (recovered after ${attempt - 1} transient linker failure${attempt > 2 ? "s" : ""})` : "";
      console.log(`✓ rust artifacts ready${recovered}`);
      return 0;
    }

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (!isTransientLinkerFailure(output)) {
      console.error(output.trimEnd());
      console.error("✖ rust build failed.");
      return result.status ?? 1;
    }
    if (attempt < MAX_LINK_ATTEMPTS) {
      console.warn(
        `▸ transient MSVC linker failure (LNK1104) on attempt ${attempt}/${MAX_LINK_ATTEMPTS} — retrying in ${RETRY_DELAY_MS}ms...`,
      );
      await delay(RETRY_DELAY_MS);
    }
  }

  console.error(
    `✖ rust build kept failing with transient linker errors after ${MAX_LINK_ATTEMPTS} attempts. ` +
      "LNK1104 is contention on %TEMP% — run the dev command again and it should pass.",
  );
  return 1;
};

if (isDirectExecution(import.meta.url, process.argv[1])) {
  console.warn("▸ ensuring rust artifacts are built (the first build can take a few minutes)...");
  process.exit(await warmUp());
}
