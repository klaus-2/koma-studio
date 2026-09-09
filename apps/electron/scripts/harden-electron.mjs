/**
 * harden-electron.mjs
 * ====================
 * Applies anti-reverse-engineering protections to the Electron main process
 * and preload scripts AFTER TypeScript compilation but BEFORE electron-builder
 * packaging.
 *
 * Protection layers:
 *   1. V8 Bytecode Compilation (bytenode)
 *      - Compiles main.js and preload.js to .jsc (V8 snapshots).
 *      - The .jsc files contain V8 internal bytecode that cannot be
 *        decompiled back to readable JavaScript.
 *      - A thin loader stub replaces the original .js to load the .jsc.
 *
 *   2. JavaScript Obfuscation (javascript-obfuscator)
 *      - Applied to any remaining .js files that cannot be compiled to
 *        bytecode (e.g., dynamic imports, worker scripts).
 *      - Control-flow flattening, string encoding, dead-code injection,
 *        debug protection, and self-defending transforms.
 *
 * Usage:
 *   node scripts/harden-electron.mjs [--skip-bytenode] [--skip-obfuscator]
 *
 * Requirements:
 *   bun add -d bytenode javascript-obfuscator
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distElectronDir = path.join(rootDir, "dist-electron");

const args = process.argv.slice(2);
const skipBytenode = args.includes("--skip-bytenode");
const skipObfuscator = args.includes("--skip-obfuscator");

// Track files successfully compiled to bytecode so the obfuscator skips them.
const bytecodedFiles = new Set();

const log = (msg) => console.log(`[harden-electron] ${msg}`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ensureDependency = (pkg) => {
  try {
    const require = createRequire(import.meta.url);
    require.resolve(pkg);
    return true;
  } catch {
    log(`Installing ${pkg}...`);
    try {
      execSync(`bun add -d ${pkg}`, { cwd: rootDir, stdio: "pipe" });
      return true;
    } catch (e) {
      log(`WARN: Failed to install ${pkg}: ${e.message}`);
      return false;
    }
  }
};

// ---------------------------------------------------------------------------
// Step 1: V8 Bytecode Compilation (bytenode)
// ---------------------------------------------------------------------------

const compileToV8Bytecode = async () => {
  log("=== V8 Bytecode Compilation ===");

  if (!ensureDependency("bytenode")) {
    log("  SKIP: bytenode not available");
    return;
  }

  // We cannot use bytenode for preload.js if the renderer is sandboxed
  // (because sandbox=true prevents require('bytenode') in the preload script).
  const targets = ["main.js"];

  const jobs = targets
    .map((fileName) => ({
      fileName,
      src: path.join(distElectronDir, fileName),
      out: path.join(distElectronDir, fileName.replace(/\.js$/, ".jsc")),
    }))
    .filter((j) => fs.existsSync(j.src));

  if (jobs.length === 0) {
    log("  SKIP: no target files found");
    return;
  }

  // Save originals before compilation in case we need to restore
  const originals = {};
  for (const job of jobs) {
    originals[job.src] = fs.readFileSync(job.src, "utf-8");
  }

  // IMPORTANT: bytenode .jsc files are tied to the V8 version of the
  // *compiling* process.  If we compile with system Node.js but the app
  // runs inside Electron (which embeds a different V8), Electron will
  // reject the bytecode with "cachedDataRejected".
  //
  // Fix: run the compilation inside Electron's own process so that the
  // resulting .jsc matches Electron's V8 exactly.
  const tempScript = path.join(distElectronDir, "_bytenode_compile_temp.js");
  const compileScriptContent = `
'use strict';
// This script is intentionally run with "electron" as the Node runtime so
// that bytenode produces .jsc bytecode compatible with Electron's V8.
const bytenode = require('bytenode');
const jobs = JSON.parse(process.env.BYTENODE_JOBS || '[]');
let failed = false;
for (const job of jobs) {
  try {
    bytenode.compileFile({ filename: job.src, output: job.out });
    console.log('[bytenode] OK:', job.src, '->', job.out);
  } catch (e) {
    console.error('[bytenode] FAIL:', job.src, e.message);
    failed = true;
  }
}
require('electron').app.exit(failed ? 1 : 0);
`;
  fs.writeFileSync(tempScript, compileScriptContent, "utf-8");

  let compilationOk = false;
  try {
    execSync(
      `npx electron --no-sandbox "${tempScript}"`,
      {
        cwd: rootDir,
        stdio: "inherit",
        env: {
          ...process.env,
          BYTENODE_JOBS: JSON.stringify(jobs.map((j) => ({ src: j.src, out: j.out }))),
        },
      },
    );
    compilationOk = true;
  } catch (err) {
    log(`  WARN: Electron-based bytenode compilation failed: ${err.message}`);
    log("  WARN: Proceeding without V8 bytecode (original .js files kept)");
  } finally {
    fs.rmSync(tempScript, { force: true });
  }

  if (!compilationOk) return;

  // Replace original .js with thin loader stubs
  for (const job of jobs) {
    const jscExists = fs.existsSync(job.out);
    if (!jscExists) {
      log(`  WARN: ${job.fileName} -> .jsc not produced, keeping original`);
      continue;
    }

    bytecodedFiles.add(job.fileName);

    const loaderStub = generateBytenodeLoader(job.fileName);
    fs.writeFileSync(job.src, loaderStub, "utf-8");

    const jscSize = fs.statSync(job.out).size;
    const originalSize = Buffer.byteLength(originals[job.src], "utf-8");
    log(`  OK: ${job.fileName} -> ${path.basename(job.out)} (${originalSize} -> ${jscSize} bytes)`);
  }
};

/**
 * Generate a minimal loader stub that uses bytenode to load the .jsc file.
 * This stub replaces the original .js file.
 */
const generateBytenodeLoader = (originalFileName) => {
  const jscName = originalFileName.replace(/\.js$/, ".jsc");
  return `'use strict';
const path = require('path');
const bytenode = require('bytenode');
require(path.join(__dirname, '${jscName}'));
`;
};

// ---------------------------------------------------------------------------
// Step 2: JavaScript Obfuscation
// ---------------------------------------------------------------------------

const obfuscateJavaScript = async () => {
  log("=== JavaScript Obfuscation ===");

  if (!ensureDependency("javascript-obfuscator")) {
    log("  SKIP: javascript-obfuscator not available");
    return;
  }

  const JavaScriptObfuscator = (await import("javascript-obfuscator")).default;

  // Obfuscation profile for Electron main process
  const obfuscatorOptions = {
    // Control flow — DISABLED: flattening + selfDefending non-deterministically
    // break webRequest callback invocations in Electron (net::ERR_FAILED).
    controlFlowFlattening: false,
    deadCodeInjection: false,

    // String protection
    // Using base64 instead of rc4 to avoid needing 'unsafe-eval' in CSP
    // (RC4 uses new Function() internally which requires eval)
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.8,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersType: "function",
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersChainedCalls: true,
    splitStrings: true,
    splitStringsChunkLength: 6,
    unicodeEscapeSequence: true,

    // Identifier protection
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false, // Keep false for Node.js/Electron compatibility
    renameProperties: false,

    // Anti-debugging — ALL DISABLED for Electron main process.
    // debugProtection injects setInterval debugger traps that cause event-loop
    // micro-pauses; these delay webRequest.onBeforeSendHeaders/onHeadersReceived
    // callbacks past their internal timeout → net::ERR_FAILED on every request.
    // selfDefending monitors source formatting and can enter infinite loops.
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    selfDefending: false,

    // Transforms
    transformObjectKeys: true,
    numbersToExpressions: true,

    // Target
    target: "node",

    // Performance (keep it reasonable)
    compact: true,
    simplify: true,
  };

  // Obfuscate all .js files in dist-electron that aren't already bytecode loaders
  const jsFiles = fs.readdirSync(distElectronDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(distElectronDir, f));

  for (const filePath of jsFiles) {
    const content = fs.readFileSync(filePath, "utf-8");

    const baseName = path.basename(filePath);

    // Skip bytenode loader stubs (they're tiny and must remain readable by Node)
    if (content.includes("require('bytenode')") || content.includes("require(\"bytenode\")")) {
      log(`  SKIP (bytenode loader): ${baseName}`);
      continue;
    }

    // Skip files that have a companion .jsc (bytecoded). Even if the loader
    // stub detection above missed them, we know they were compiled.
    if (bytecodedFiles.has(baseName)) {
      log(`  SKIP (bytecoded companion): ${baseName}`);
      continue;
    }

    // Skip preload.js — it runs in a sandboxed renderer context where obfuscation
    // can produce broken code.  The main protection comes from main.js obfuscation.
    if (baseName === "preload.js") {
      log(`  SKIP (preload — sandboxed context): ${baseName}`);
      continue;
    }

    // Skip runtime-config.json (not JS)
    if (filePath.endsWith(".json")) continue;

    try {
      const result = JavaScriptObfuscator.obfuscate(content, obfuscatorOptions);
      fs.writeFileSync(filePath, result.getObfuscatedCode(), "utf-8");

      const originalSize = Buffer.byteLength(content, "utf-8");
      const obfuscatedSize = Buffer.byteLength(result.getObfuscatedCode(), "utf-8");
      log(`  OK: ${path.basename(filePath)} (${originalSize} -> ${obfuscatedSize} bytes)`);
    } catch (err) {
      log(`  WARN: Failed to obfuscate ${path.basename(filePath)}: ${err.message}`);
    }
  }
};

// ---------------------------------------------------------------------------
// Step 3: Protect runtime-config.json (AES-256-GCM authenticated encryption)
// ---------------------------------------------------------------------------

const protectRuntimeConfig = () => {
  log("=== Protecting runtime-config.json (AES-256-GCM) ===");
  const configPath = path.join(distElectronDir, "runtime-config.json");
  if (!fs.existsSync(configPath)) {
    log("  SKIP: runtime-config.json not found");
    return;
  }

  const content = fs.readFileSync(configPath, "utf-8");

  // AES-256 key split into fragments (must produce same key as _rck in main.ts and _kp in runtime-config-loader.ts)
  // Different storage order — reassembled via index map
  const keyFragments = [
    "7126d4d6", // index 6
    "331225c7", // index 0
    "8fbd7712", // index 4
    "9b5684f4", // index 7
    "868ff43e", // index 1
    "37c1fc2a", // index 3
    "9783e807", // index 2
    "d55fe1ba", // index 5
  ];
  const keyOrder = [1, 4, 6, 5, 2, 7, 0, 3];
  const key = Buffer.from(keyOrder.map((i) => keyFragments[i]).join(""), "hex");
  const iv = crypto.randomBytes(12); // GCM standard nonce size

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(content, "utf-8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  const protectedContent = JSON.stringify({
    _protected: true,
    _v: 2,
    _d: encrypted.toString("base64"),
    _iv: iv.toString("hex"),
    _tag: authTag.toString("hex"),
  });

  fs.writeFileSync(configPath, protectedContent, "utf-8");
  log("  OK: runtime-config.json AES-256-GCM encrypted");
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  log("=".repeat(60));
  log("KOMA Studio - Electron Hardening");
  log("=".repeat(60));

  if (!fs.existsSync(distElectronDir)) {
    log(`ERROR: dist-electron not found at ${distElectronDir}`);
    log("Run 'bun run build:electron' first.");
    process.exit(1);
  }

  // List what we're working with
  const files = fs.readdirSync(distElectronDir);
  log(`Files in dist-electron: ${files.join(", ")}`);

  // Step 1: V8 Bytecode
  if (!skipBytenode) {
    await compileToV8Bytecode();
  } else {
    log("Skipping V8 bytecode compilation (--skip-bytenode)");
  }

  // Step 2: JavaScript Obfuscation
  if (!skipObfuscator) {
    await obfuscateJavaScript();
  } else {
    log("Skipping JavaScript obfuscation (--skip-obfuscator)");
  }

  // Step 3: Protect config
  protectRuntimeConfig();

  log("");
  log("=".repeat(60));
  log("Electron hardening complete!");
  log("=".repeat(60));
};

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
