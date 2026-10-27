import { existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  fileURLToPath(new URL("../../apps/tauri/package.json", import.meta.url)),
);
const { chromium } = require("playwright");

const root = path.resolve(process.argv[2] ?? "apps/landing/out");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};
const compressible = (extension) => [".html", ".js", ".css", ".json", ".svg", ".txt", ".xml", ".webmanifest"].includes(extension);

const resolveFile = (urlPath) => {
  let filePath = path.join(root, decodeURIComponent(urlPath.split("?")[0]));
  if (!filePath.startsWith(root)) return null;
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  } else if (!existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }
  return existsSync(filePath) && statSync(filePath).isFile() ? filePath : null;
};

const server = http.createServer((request, response) => {
  const filePath = resolveFile(new URL(request.url, "http://localhost").pathname);
  if (!filePath) {
    response.writeHead(404).end("not found");
    return;
  }
  const extension = path.extname(filePath);
  const raw = readFileSync(filePath);
  const accepts = request.headers["accept-encoding"] ?? "";
  const headers = { "content-type": MIME[extension] ?? "application/octet-stream", "cache-control": "no-store" };
  let body = raw;
  if (compressible(extension) && /\bbr\b/.test(accepts)) {
    headers["content-encoding"] = "br";
    body = zlib.brotliCompressSync(raw);
  } else if (compressible(extension) && /\bgzip\b/.test(accepts)) {
    headers["content-encoding"] = "gzip";
    body = zlib.gzipSync(raw);
  }
  response.writeHead(200, headers).end(body);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport, isMobile: label === "mobile", hasTouch: label === "mobile" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  page.on("console", (message) => {
    if (message.type() === "error" && !/api\.github|Failed to load resource|net::|fetch/i.test(message.text())) {
      errors.push(message.text().slice(0, 200));
    }
  });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(600);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${label}: no horizontal overflow`, overflow <= 1, `overflow=${overflow}px`);
  check(
    `${label}: hero headline rendered`,
    /raw chapter/i.test(await page.locator("h1").first().innerText()),
  );
  check(`${label}: rotating words present`, (await page.locator(".hero-word").count()) === 5);

  if (label === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.waitForTimeout(400);
    const menuState = await page.evaluate(() => {
      const aside = document.querySelector("header aside");
      if (!aside) return { found: false };
      const style = getComputedStyle(aside);
      const rect = aside.getBoundingClientRect();
      return {
        found: true,
        inert: aside.hasAttribute("inert"),
        transform: style.transform,
        translate: style.translate,
        left: Math.round(rect.left),
        viewport: window.innerWidth,
        ariaHidden: aside.getAttribute("aria-hidden"),
      };
    });
    check(
      "mobile: menu opens without JS framework",
      menuState.found && !menuState.inert && menuState.left < menuState.viewport - 50,
      JSON.stringify(menuState),
    );
    await page.getByRole("button", { name: "Close menu" }).click();
    await page.waitForTimeout(400);
  }

  const workflowButtons = page.locator("#workflow button[aria-expanded]");
  await workflowButtons.nth(1).click();
  await page.waitForTimeout(350);
  check(
    "workflow: step switch updates accordion + preview",
    (await workflowButtons.nth(1).getAttribute("aria-expanded")) === "true" &&
      (await page.locator("#workflow h3").last().innerText()).length > 0,
  );

  await page.locator("#faq details").nth(2).locator("summary").click();
  check("faq: native details toggles", await page.locator("#faq details").nth(2).evaluate((el) => el.open));

  const appPreviewTab = page.getByRole("tab", { name: /Clean/i });
  await appPreviewTab.click();
  await page.getByRole("button", { name: /Run Pipeline/i }).click();
  await page.waitForTimeout(1000);
  check(
    "app preview: run updates status",
    /Detect text|Mask bubbles|Inpaint|Denoise|Idle/i.test(await page.locator("#studio [role=status]").first().innerText()),
  );

  check(`${label}: no page/console errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await context.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\nLANDING SMOKE ${failed === 0 ? "PASS" : "FAIL"}: ${results.length - failed}/${results.length}`);
process.exit(failed === 0 ? 0 : 1);
