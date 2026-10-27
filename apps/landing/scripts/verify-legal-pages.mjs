// Headless acceptance harness for the landing legal pages. Plain Node ESM with no repo
// dependency: Playwright is required by absolute bun store path because it does not resolve from
// any package.json in this workspace. If that path moves, re-measure it — never npm install.
// Chromium always runs headless.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLAYWRIGHT_PATH =
  "C:/Github/koma-studio/node_modules/.bun/playwright@1.62.1/node_modules/playwright";

const require = createRequire(import.meta.url);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(scriptDir, "..", "out");
const EVIDENCE_DIR = "C:/Github/koma-studio/.sisyphus/evidence/legal";
const HOST = "127.0.0.1";
const PORT = 4390;
const ORIGIN = `http://${HOST}:${PORT}`;

// Asserted against the published pages; keep byte-identical to src/content/legal.ts.
const EFFECTIVE_LINE = "Effective 2026-10-27";
const SCOPE_NOTE =
  "This page governs the website and the distributed artifacts. The legal text you accept inside the app is versioned in the app itself — this page does not replace it.";
const FOOTER_LEGAL_PATHS = ["/terms-of-service/", "/privacy-policy/"];

const DOCS = [
  {
    slug: "terms-of-service",
    path: "/terms-of-service/",
    otherPath: "/privacy-policy/",
    sectionCount: 10,
    lead: "These terms govern your use of the KOMA Studio website and of the application and artifacts we distribute from it.",
  },
  {
    slug: "privacy-policy",
    path: "/privacy-policy/",
    otherPath: "/terms-of-service/",
    sectionCount: 12,
    lead: "This policy says what data the KOMA Studio website, the software on your machine, and the optional services we host actually handle.",
  },
];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

let failures = 0;
let exemptedGithubConsoleEntries = 0;

function check(ok, label, detail) {
  if (ok) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` — got: ${detail}` : ""}`);
  }
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// Never resolves outside OUT_ROOT.
function resolveInside(pathname) {
  const rel = pathname.replace(/^\/+/, "");
  const abs = path.resolve(OUT_ROOT, rel);
  if (abs !== OUT_ROOT && !abs.startsWith(OUT_ROOT + path.sep)) return null;
  if (isFile(abs)) return abs;
  const indexFile = path.join(abs, "index.html");
  if (isFile(indexFile)) return indexFile;
  return null;
}

function contentTypeFor(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function hrefMatchesPath(raw, p) {
  if (!raw) return false;
  return raw === p || raw === p.slice(0, -1);
}

const server = createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, ORIGIN).pathname;
  } catch {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("bad request");
    return;
  }
  const file = pathname === null ? null : resolveInside(pathname);
  if (file === null) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404 not found");
    return;
  }
  let body;
  try {
    body = readFileSync(file);
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("500 unreadable file");
    return;
  }
  res.writeHead(200, { "content-type": contentTypeFor(file), "cache-control": "no-store" });
  res.end(body);
});

function startServer() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

function closeServer() {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
  });
}

// No Node closures are referenced inside, so the function serializes cleanly into the page.
function collectFacts() {
  const bodyText = document.body.textContent || "";
  const h2s = Array.from(document.querySelectorAll("h2"));
  const permPerH2 = h2s.map((h2) => h2.querySelectorAll('a[href^="#"]').length);
  const permHrefs = [];
  for (const h2 of h2s) {
    for (const a of h2.querySelectorAll('a[href^="#"]')) permHrefs.push(a.getAttribute("href") || "");
  }
  const permMissingTargets = permHrefs.filter((href) => {
    const target = document.getElementById(href.slice(1));
    return target === null || target.tagName !== "ARTICLE";
  });
  const navHrefs = (ariaLabel) => {
    const nav = document.querySelector(`nav[aria-label="${ariaLabel}"]`);
    return nav ? Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href") || "") : null;
  };
  return {
    bodyText,
    h1Count: document.querySelectorAll("h1").length,
    h2Count: h2s.length,
    h3Count: document.querySelectorAll("h3").length,
    permPerH2,
    permTotal: permHrefs.length,
    permMissingTargets,
    hasTocNav: document.querySelector('nav[aria-label="Document contents"]') !== null,
    hasMain: document.querySelector("main#legal-document") !== null,
    hasSkip: document.querySelector('a[href="#legal-document"]') !== null,
    relatedHrefs: navHrefs("Related legal documents"),
    legalNavHrefs: navHrefs("Legal"),
    scrollWidth: document.documentElement.scrollWidth,
  };
}

async function verifyLoad(browser, doc, viewport) {
  const label = `${doc.slug} @ ${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const consoleErrorTexts = [];
  const pageErrorTexts = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrorTexts.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrorTexts.push(err instanceof Error ? err.message : String(err)));
  try {
    await page.goto(`${ORIGIN}${doc.path}`, { waitUntil: "load" });
    // Let the page settle so StarButton's api.github.com fetch (403 or otherwise) has already
    // produced its browser-level console entry before this load's error tally runs.
    await page.waitForTimeout(2000);

    const facts = await page.evaluate(collectFacts);

    check(facts.h1Count === 1, `[${label}] exactly one <h1>`, `h1 count = ${facts.h1Count}`);
    check(facts.bodyText.includes(doc.lead), `[${label}] locked lead string in document.body.textContent`, `lead searched = ${doc.lead}`);
    check(facts.bodyText.includes(EFFECTIVE_LINE), `[${label}] '${EFFECTIVE_LINE}' rendered in document.body.textContent (body, not only <head>)`);
    check(facts.bodyText.includes(SCOPE_NOTE), `[${label}] scope-note literal present (starts 'This page governs the website and the distributed artifacts.')`);
    check(facts.h2Count === doc.sectionCount, `[${label}] <h2> count equals section count (${doc.sectionCount})`, `h2 count = ${facts.h2Count}`);
    check(facts.h3Count === 0, `[${label}] zero <h3> elements (no skipped heading level)`, `h3 count = ${facts.h3Count}`);
    check(facts.hasTocNav, `[${label}] <nav aria-label="Document contents"> exists`);
    check(facts.hasMain, `[${label}] <main id="legal-document"> exists`);
    check(facts.hasSkip, `[${label}] skip link a[href="#legal-document"] exists`);
    check(
      facts.permTotal === doc.sectionCount && facts.permPerH2.every((n) => n === 1),
      `[${label}] every <h2> contains an a[href^="#"] and the total equals the section count (${doc.sectionCount})`,
      `per-h2 anchor counts = [${facts.permPerH2.join(", ")}], total = ${facts.permTotal}`,
    );
    check(facts.permMissingTargets.length === 0, `[${label}] every permalink fragment resolves to an existing <article id=…>`, `missing targets = [${facts.permMissingTargets.join(", ")}]`);
    check(facts.relatedHrefs !== null, `[${label}] <nav aria-label="Related legal documents"> exists`);
    check((facts.relatedHrefs || []).some((h) => hrefMatchesPath(h, doc.otherPath)), `[${label}] Related-legal-documents nav links to the OTHER document (${doc.otherPath})`, `hrefs = [${(facts.relatedHrefs || []).join(", ")}]`);
    check(facts.legalNavHrefs !== null, `[${label}] footer <nav aria-label="Legal"> exists`);
    check(
      facts.legalNavHrefs !== null && FOOTER_LEGAL_PATHS.every((p) => facts.legalNavHrefs.some((h) => hrefMatchesPath(h, p))),
      `[${label}] footer <nav aria-label="Legal"> links to both /terms-of-service/ and /privacy-policy/`,
      `hrefs = [${(facts.legalNavHrefs || []).join(", ")}]`,
    );

    // Precondition: after a fresh goto, Chromium leaves focus on document.body, and the template
    // renders the skip link before <Navbar/> — Navbar.tsx:29's focusable logo would otherwise take
    // the first Tab stop.
    await page.keyboard.press("Tab");
    const activeHref = await page.evaluate(() =>
      document.activeElement ? document.activeElement.getAttribute("href") : null,
    );
    check(
      activeHref === "#legal-document",
      `[${label}] first Tab stop of the document is the skip link (activeElement href '#legal-document'; precondition: focus starts on document.body after goto, skip link precedes <Navbar/>)`,
      `activeElement href = ${activeHref}`,
    );

    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${doc.slug}-${viewport.width}.png`) });

    const tocLink = page.locator('nav[aria-label="Document contents"] a[href^="#"]').first();
    let tocHref = null;
    try {
      tocHref = await tocLink.getAttribute("href", { timeout: 5000 });
      if (tocHref === null) throw new Error("no a[href^=\"#\"] inside the TOC nav");
      await tocLink.click({ timeout: 5000 });
      const hash = await page.evaluate(() => location.hash);
      check(hash === tocHref, `[${label}] clicking the first TOC entry sets location.hash to that entry's fragment (${tocHref})`, `location.hash = ${hash}`);
    } catch (err) {
      check(false, `[${label}] clicking the first TOC entry sets location.hash to that entry's fragment`, String(err && err.message ? err.message : err));
    }

    check(facts.scrollWidth <= viewport.width, `[${label}] no horizontal overflow (documentElement.scrollWidth <= ${viewport.width})`, `scrollWidth = ${facts.scrollWidth}`);
  } finally {
    // Console/pageerror policy: every console error and every pageerror fails, except console
    // entries whose text contains api.github.com. StarButton's fetch is caught by
    // .catch(() => { }) (StarButton.tsx:16-25) so it never becomes a pageerror, but a 403 still
    // emits a browser-level "Failed to load resource" line that page code cannot suppress.
    // pageerror is never exempt, and exemptions are counted and printed, never silent.
    const unexempted = [];
    let exemptHere = 0;
    for (const text of consoleErrorTexts) {
      if (text.includes("api.github.com")) exemptHere += 1;
      else unexempted.push(`console: ${text}`);
    }
    exemptedGithubConsoleEntries += exemptHere;
    for (const text of pageErrorTexts) unexempted.push(`pageerror: ${text}`);
    check(
      unexempted.length === 0,
      `[${label}] zero unexempted console errors / pageerrors (exempted api.github.com entries this load: ${exemptHere}; reason: StarButton's caught GitHub-API fetch emits an unsuppressable browser-level resource-load console line; pageerror is never exempt)`,
      unexempted.join(" || "),
    );
    await context.close();
  }
}

async function main() {
  if (!existsSync(PLAYWRIGHT_PATH)) {
    check(false, "Playwright resolves from the bun store path", `${PLAYWRIGHT_PATH} is missing — re-measure the store path; never npm install`);
    process.exitCode = 1;
    return;
  }

  for (const doc of DOCS) {
    const built = path.join(OUT_ROOT, doc.slug, "index.html");
    if (!existsSync(built)) {
      check(false, `built page exists for ${doc.slug}`, `${built} is missing — run the production build first`);
      process.exitCode = 1;
      return;
    }
  }

  const { chromium } = require(PLAYWRIGHT_PATH);
  await startServer();
  console.log(`serving ${OUT_ROOT} at ${ORIGIN} (127.0.0.1 only)`);

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    // The evidence directory does not exist on a fresh checkout and page.screenshot() throws on
    // a missing parent — that would masquerade as a render failure. Create it BEFORE any shot.
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    for (const doc of DOCS) {
      for (const viewport of VIEWPORTS) {
        await verifyLoad(browser, doc, viewport);
      }
    }
  } finally {
    if (browser !== null) await browser.close();
    await closeServer();
  }

  const loads = DOCS.length * VIEWPORTS.length;
  console.log(`SUMMARY exempted console entries referencing api.github.com: ${exemptedGithubConsoleEntries} across ${loads} page-loads (expected 0-${loads}; a count above ${loads} means the whitelist is too wide — see the rationale at the per-load console check, do not tighten or widen it)`);
  if (failures === 0) {
    console.log(`PASS harness complete — ${failures} failing assertion(s), exit 0`);
  } else {
    console.log(`FAIL harness complete — ${failures} failing assertion(s), exit 1`);
  }
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.log(`FAIL harness crashed — ${err && err.stack ? err.stack : String(err)}`);
  closeServer();
  process.exitCode = 1;
});
