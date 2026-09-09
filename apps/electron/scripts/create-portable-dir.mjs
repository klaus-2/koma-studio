import fs from "node:fs";
import path from "node:path";

const outputDir = process.argv[2];

if (!outputDir) {
  throw new Error("Usage: node scripts/create-portable-dir.mjs <release-output-dir>");
}

const releaseDir = path.resolve(outputDir);
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve("package.json"), "utf-8"),
);
const productName = packageJson?.build?.productName || packageJson?.productName || packageJson?.name || "App";
const version = packageJson?.version;

if (typeof version !== "string" || version.trim().length === 0) {
  throw new Error("package.json version not found");
}

const unpackedDir = path.join(releaseDir, "win-unpacked");
const portableDir = path.join(releaseDir, `${productName} Portable ${version}`);

if (!fs.existsSync(unpackedDir)) {
  throw new Error(`win-unpacked not found: ${unpackedDir}`);
}

fs.rmSync(portableDir, {
  recursive: true,
  force: true,
});
fs.cpSync(unpackedDir, portableDir, {
  recursive: true,
  force: true,
});

console.log(`[portable-dir] created ${portableDir}`);
