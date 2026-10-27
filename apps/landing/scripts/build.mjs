import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
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

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// The homepage is static-first: the server-rendered HTML and CSS carry every
// section, and one small vanilla enhancer owns the interactive bits. Removing
// the Next/React hydration scripts here keeps the landing usable on weak
// links instead of shipping ~140 kB of framework JS for a marketing page.
// Other exported pages keep their normal hydration.
const indexHtmlPath = fileURLToPath(new URL("../out/index.html", import.meta.url));
const outDir = path.dirname(indexHtmlPath);
const before = readFileSync(indexHtmlPath, "utf8");
let html = before
  .replace(/<script\b(?![^>]*\btype="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<script\b[^>]*\/>/gi, "")
  .replace(/<link\b(?=[^>]*\bas="script")[^>]*>/gi, "")
  .replace(/<link\b(?=[^>]*\brel="modulepreload")[^>]*>/gi, "")
  .replace(/<\/body>/i, '<script src="/landing-enhance.js" defer></script></body>');

// Inline the (single) homepage stylesheet: it removes one render-blocking
// round trip on slow links. Relative font URLs are rewritten against the
// stylesheet's original location.
html = html.replace(
  /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi,
  (tag, href) => {
    if (!href.startsWith("/")) return tag;
    const cssPath = path.join(outDir, href.slice(1));
    if (!existsSync(cssPath)) return tag;
    const cssFolderUrl = href.slice(0, href.lastIndexOf("/") + 1);
    const css = readFileSync(cssPath, "utf8").replace(
      /url\((['"]?)(\.\.?\/[^)'"]*)\1\)/g,
      (_match, quote, relativeUrl) =>
        `url(${quote}${new URL(relativeUrl, `https://inline.local${cssFolderUrl}`).pathname}${quote})`,
    );
    return `<style data-koma-inline>${css}</style>`;
  },
);

if (!html.includes('src="/landing-enhance.js"')) {
  throw new Error("Landing build: failed to inject the static enhancer.");
}

writeFileSync(indexHtmlPath, html);
const removedKb = Math.max(0, Math.round((before.length - html.length) / 1024));
console.log(`Static-first homepage: removed ${removedKb} kB of hydration markup/scripts.`);
