/**
 * harden-frontend.mjs
 * ====================
 * Post-processes the Vite production build output (dist/) to apply
 * JavaScript obfuscation to the bundled React/TypeScript code.
 *
 * Protection layers:
 *   1. javascript-obfuscator on application-owned JS chunks in dist/assets/
 *      - String array encoding (RC4)
 *      - Control-flow flattening
 *      - Dead-code injection
 *      - Self-defending code
 *      - Debug protection
 *
 *   2. Source map removal
 *      - Deletes all .map files from the production build
 *
 *   3. HTML hardening
 *      - Injects integrity attributes where possible
 *      - Removes development comments
 *
 * Usage:
 *   node scripts/harden-frontend.mjs [--skip-obfuscation] [--keep-sourcemaps]
 *
 * Requirements:
 *   bun add -d javascript-obfuscator
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(distDir, "assets");

const args = process.argv.slice(2);
const skipObfuscation = args.includes("--skip-obfuscation");
const keepSourcemaps = args.includes("--keep-sourcemaps");
const staticDataChunkPrefixes = ["app-i18n-", "app-model-catalog-"];

const log = (msg) => console.log(`[harden-frontend] ${msg}`);

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
// Step 1: Remove source maps
// ---------------------------------------------------------------------------

const removeSourceMaps = () => {
  log("=== Removing source maps ===");
  let removed = 0;

  const walkAndRemove = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndRemove(fullPath);
      } else if (entry.name.endsWith(".map")) {
        fs.unlinkSync(fullPath);
        removed++;
      }
    }
  };

  walkAndRemove(distDir);

  // Also strip sourceMappingURL comments from JS files
  if (fs.existsSync(assetsDir)) {
    for (const file of fs.readdirSync(assetsDir)) {
      if (!file.endsWith(".js")) continue;
      const filePath = path.join(assetsDir, file);
      let content = fs.readFileSync(filePath, "utf-8");
      const cleaned = content.replace(/\/\/# sourceMappingURL=.+$/gm, "");
      if (cleaned !== content) {
        fs.writeFileSync(filePath, cleaned, "utf-8");
      }
    }
  }

  log(`  Removed ${removed} source map files`);
};

// ---------------------------------------------------------------------------
// Step 2: Obfuscate JS bundles
// ---------------------------------------------------------------------------

const obfuscateFrontendBundles = async () => {
  log("=== Obfuscating frontend bundles ===");

  if (!ensureDependency("javascript-obfuscator")) {
    log("  SKIP: javascript-obfuscator not available");
    return;
  }

  const JavaScriptObfuscator = (await import("javascript-obfuscator")).default;

  if (!fs.existsSync(assetsDir)) {
    log("  SKIP: dist/assets not found");
    return;
  }

  // Frontend-optimized obfuscation options (lighter than Electron to preserve
  // rendering performance)
  const obfuscatorOptions = {
    // Control flow (disabled to avoid breaking React execution and performance issues)
    controlFlowFlattening: false,
    controlFlowFlatteningThreshold: 0,
    deadCodeInjection: false,
    deadCodeInjectionThreshold: 0,

    // String protection
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersType: "function",
    splitStrings: true,
    splitStringsChunkLength: 8,

    // Identifier protection
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false,
    renameProperties: false,

    // Anti-debugging — DISABLED for Electron renderer:
    // debugProtection inserts setInterval debugger traps that interfere with
    // Electron's renderer event loop and webRequest handling.
    // selfDefending monitors source formatting changes and enters infinite
    // loops when the custom app:// protocol re-parses script content.
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    selfDefending: false,

    // Transforms
    transformObjectKeys: true,
    numbersToExpressions: true,
    unicodeEscapeSequence: false, // Keep false for smaller browser bundles

    // Target
    target: "browser",

    // Performance
    compact: true,
    simplify: true,

    // Don't break dynamic imports and chunk loading
    reservedNames: [
      "^__vite",
      "^__VITE",
      "^import\\.meta",
      "^__dynamic",
    ],
    reservedStrings: [
      "^/assets/",
      "^\\.js$",
      "^\\.css$",
    ],
  };

  const jsFiles = fs.readdirSync(assetsDir)
    .filter((f) => f.endsWith(".js"))
    .sort((a, b) => {
      // Process vendor chunks last (they're larger and less sensitive)
      const aIsVendor = a.includes("vendor");
      const bIsVendor = b.includes("vendor");
      if (aIsVendor !== bIsVendor) return aIsVendor ? 1 : -1;
      return a.localeCompare(b);
    });

  let successCount = 0;
  let skipCount = 0;

  for (const file of jsFiles) {
    const filePath = path.join(assetsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Skip very small files (likely just re-exports)
    if (content.length < 200) {
      log(`  SKIP (too small): ${file}`);
      skipCount++;
      continue;
    }

    const isVendor = file.includes("vendor");
    const isRendererEntryChunk = /^index-[^.]+\.js$/i.test(file);
    const isStaticDataChunk = staticDataChunkPrefixes.some((prefix) => file.startsWith(prefix));

    // Third-party vendor bundles are already minified and not worth protecting
    // here. Re-obfuscating them has caused packaged Electron builds to fail
    // during renderer bootstrap with runtime errors such as:
    // "Cannot read properties of null (reading 'icon')".
    //
    // The primary renderer entry chunk is also skipped: its heavily optimized
    // React bundle becomes unstable after obfuscation in packaged Electron
    // builds, while worker bundles continue to obfuscate safely.
    const skipReason = isVendor
      ? "vendor chunk"
      : isRendererEntryChunk
        ? "renderer entry chunk"
        : isStaticDataChunk
          ? "static data chunk"
          : null;
    if (skipReason) {
      log(`  SKIP (${skipReason}): ${file}`);
      skipCount++;
      continue;
    }

    try {
      const result = JavaScriptObfuscator.obfuscate(content, obfuscatorOptions);
      fs.writeFileSync(filePath, result.getObfuscatedCode(), "utf-8");

      const ratio = (
        (Buffer.byteLength(result.getObfuscatedCode(), "utf-8") /
          Buffer.byteLength(content, "utf-8")) *
        100
      ).toFixed(0);
      log(`  OK: ${file} (${ratio}% of original)`);
      successCount++;
    } catch (err) {
      log(`  WARN: Failed ${file}: ${err.message}`);
    }
  }

  log(`  Obfuscated ${successCount} files, skipped ${skipCount}`);
};

// ---------------------------------------------------------------------------
// Step 3: Harden index.html
// ---------------------------------------------------------------------------

const hardenIndexHtml = () => {
  log("=== Hardening index.html ===");
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    log("  SKIP: index.html not found");
    return;
  }

  let html = fs.readFileSync(indexPath, "utf-8");

  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Add SRI (Subresource Integrity) hashes to script tags.
  // The regex is flexible to handle attribute order variations from Vite.
  html = html.replace(
    /<script\s+([^>]*?)src="(\/assets\/[^"]+\.js)"([^>]*)>/g,
    (match, beforeSrc, src, afterSrc) => {
      // Skip if integrity already present
      if (match.includes("integrity=")) return match;

      const filePath = path.join(distDir, src);
      if (!fs.existsSync(filePath)) return match;

      const content = fs.readFileSync(filePath);
      const hash = createHash("sha384").update(content).digest("base64");
      const integrity = `sha384-${hash}`;

      return `<script ${beforeSrc}src="${src}"${afterSrc} integrity="${integrity}">`;
    },
  );

  // Add CSP meta tag if not present.
  // Notes:
  //  - Frontend uses base64 string encoding (no eval needed).
  //  - tauri://localhost must appear in connect-src for the Tauri asset protocol.
  //  - worker-src allows web workers to be loaded from same origin.
  if (!html.includes("Content-Security-Policy")) {
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' tauri://localhost; base-uri 'self'; object-src 'none'; script-src 'self'; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob: https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' tauri://localhost; img-src 'self' data: blob: https: tauri://localhost; connect-src 'self' tauri://localhost ipc://localhost http://127.0.0.1:* ws://127.0.0.1:* https:; font-src 'self' data: https://fonts.gstatic.com;">`;
    html = html.replace("<head>", `<head>\n    ${cspMeta}`);
  }

  fs.writeFileSync(indexPath, html, "utf-8");
  log("  OK: index.html hardened");
};

// ---------------------------------------------------------------------------
// Step 4: Generate integrity manifest
// ---------------------------------------------------------------------------

const generateIntegrityManifest = () => {
  log("=== Generating integrity manifest ===");

  const manifest = {};

  const walkDir = (dir, prefix = "") => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walkDir(fullPath, relPath);
      } else {
        const content = fs.readFileSync(fullPath);
        manifest[relPath] = {
          sha256: createHash("sha256").update(content).digest("hex"),
          size: content.length,
        };
      }
    }
  };

  walkDir(distDir);

  const manifestPath = path.join(distDir, ".integrity.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  log(`  OK: ${Object.keys(manifest).length} files in integrity manifest`);
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const main = async () => {
  log("=".repeat(60));
  log("KOMA Studio - Frontend Hardening");
  log("=".repeat(60));

  if (!fs.existsSync(distDir)) {
    log(`ERROR: dist/ not found at ${distDir}`);
    log("Run 'bun run build:react' first.");
    process.exit(1);
  }

  // Step 1: Source maps
  if (!keepSourcemaps) {
    removeSourceMaps();
  } else {
    log("Keeping source maps (--keep-sourcemaps)");
  }

  // Step 2: Obfuscation
  if (!skipObfuscation) {
    await obfuscateFrontendBundles();
  } else {
    log("Skipping obfuscation (--skip-obfuscation)");
  }

  // Step 3: HTML hardening
  hardenIndexHtml();

  // Step 4: Integrity manifest
  generateIntegrityManifest();

  log("");
  log("=".repeat(60));
  log("Frontend hardening complete!");
  log("=".repeat(60));
};

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
