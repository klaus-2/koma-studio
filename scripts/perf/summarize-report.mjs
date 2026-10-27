import { readFileSync } from "node:fs";
import path from "node:path";

const reportPath = process.argv[2] ?? "apps/tauri/perf-bundle-report.json";
const htmlPath = process.argv[3] ?? "apps/tauri/dist/index.html";

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");

const chunkByFile = new Map(report.chunks.map((chunk) => [chunk.fileName, chunk]));
const assetByFile = new Map(report.assets.map((asset) => [asset.fileName, asset]));

const referenced = new Set();
for (const match of html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)) {
  referenced.add(match[1]);
}

const eager = new Set();
const queue = [...referenced];
while (queue.length > 0) {
  const fileName = queue.pop();
  if (eager.has(fileName)) continue;
  const chunk = chunkByFile.get(fileName);
  if (!chunk) continue;
  eager.add(fileName);
  for (const imported of chunk.imports) {
    if (!eager.has(imported)) queue.push(imported);
  }
}

const eagerChunks = report.chunks.filter((chunk) => eager.has(chunk.fileName));
const eagerAssets = report.assets.filter((asset) => eager.has(asset.fileName));

const kb = (value) => `${(value / 1024).toFixed(1)}kB`;
const br = (value) => `${(value / 1024).toFixed(1)}kB`;

let eagerRaw = 0;
let eagerGzip = 0;
let eagerBrotli = 0;
console.log("=== EAGER ASSETS (referenced by index.html + static closure) ===");
for (const chunk of [...eagerChunks].sort((a, b) => b.size - a.size)) {
  eagerRaw += chunk.size;
  eagerGzip += chunk.gzip;
  eagerBrotli += chunk.brotli;
  console.log(
    `${chunk.fileName.padEnd(44)} ${kb(chunk.size).padStart(10)} gz ${kb(chunk.gzip).padStart(9)} br ${br(chunk.brotli).padStart(9)} modules ${String(chunk.modules.length).padStart(4)}`,
  );
}
for (const asset of eagerAssets) {
  eagerRaw += asset.size;
  eagerGzip += asset.gzip;
  eagerBrotli += asset.brotli;
  console.log(
    `${asset.fileName.padEnd(44)} ${kb(asset.size).padStart(10)} gz ${kb(asset.gzip).padStart(9)} br ${br(asset.brotli).padStart(9)}`,
  );
}
const htmlSize = Buffer.byteLength(html);
console.log(`\nHTML ${kb(htmlSize)} raw (${kb(htmlSize)} uncompressed)`);
console.log(
  `EAGER TOTAL: raw ${kb(eagerRaw)} | gzip ${kb(eagerGzip)} | brotli ${kb(eagerBrotli)} (+html raw ${kb(htmlSize)})`,
);

console.log("\n=== PACKAGES IN EAGER STATIC CLOSURE ===");
const packageBytes = new Map();
for (const chunk of eagerChunks) {
  for (const module of chunk.modules) {
    packageBytes.set(module.package, (packageBytes.get(module.package) ?? 0) + module.rendered);
  }
}
for (const [name, bytes] of [...packageBytes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  console.log(`${name.padEnd(34)} ${kb(bytes).padStart(11)}`);
}

console.log("\n=== LARGEST MODULES IN EAGER STATIC CLOSURE ===");
const modules = [];
for (const chunk of eagerChunks) {
  for (const module of chunk.modules) {
    modules.push({ ...module, chunk: chunk.fileName });
  }
}
for (const module of modules.sort((a, b) => b.rendered - a.rendered).slice(0, 50)) {
  const short = module.id
    .replace(/^.*node_modules\/(\.bun\/[^/]+\/node_modules\/)?/, "")
    .replace(/^.*packages\//, "packages/");
  console.log(
    `${kb(module.rendered).padStart(10)}  ${short.slice(0, 130)}  [${module.chunk}]`,
  );
}

console.log("\n=== TOP DYNAMIC CHUNKS (not eager) ===");
const dynamic = report.chunks
  .filter((chunk) => !eager.has(chunk.fileName))
  .sort((a, b) => b.size - a.size)
  .slice(0, 30);
for (const chunk of dynamic) {
  const top = chunk.modules[0];
  const short = top
    ? top.id.replace(/^.*node_modules\/(\.bun\/[^/]+\/node_modules\/)?/, "").slice(0, 90)
    : "";
  console.log(
    `${chunk.fileName.padEnd(44)} ${kb(chunk.size).padStart(10)} gz ${kb(chunk.gzip).padStart(9)} dynamic=${chunk.isDynamicEntry} ${short}`,
  );
}
