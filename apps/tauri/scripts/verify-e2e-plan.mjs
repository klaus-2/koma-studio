import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const scenariosPath = path.join(rootDir, "tests", "e2e", "e2e-scenarios.json");
const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));

const requiredAreas = [
  "auth",
  "dashboard",
  "aio",
  "models",
  "autosave",
  "updater",
  "settings",
  "feed",
  "rankings",
  "bug-report",
];

if (!Array.isArray(scenarios)) {
  throw new Error("E2E scenarios must be an array.");
}
if (scenarios.length < 30) {
  throw new Error(`Expected at least 30 E2E scenarios, found ${scenarios.length}.`);
}

const ids = new Set();
const areas = new Set();
let visualCount = 0;

for (const scenario of scenarios) {
  for (const key of ["id", "area", "title", "route", "success"]) {
    if (typeof scenario[key] !== "string" || scenario[key].trim() === "") {
      throw new Error(`Scenario ${scenario.id ?? "<unknown>"} is missing ${key}.`);
    }
  }
  if (ids.has(scenario.id)) {
    throw new Error(`Duplicate scenario id: ${scenario.id}`);
  }
  ids.add(scenario.id);
  areas.add(scenario.area);
  if (scenario.visual === true) {
    visualCount += 1;
  }
}

const missingAreas = requiredAreas.filter((area) => !areas.has(area));
if (missingAreas.length > 0) {
  throw new Error(`Missing required E2E areas: ${missingAreas.join(", ")}`);
}
if (visualCount < scenarios.length) {
  throw new Error(
    `Every Phase 1.6 scenario must be visual-ready; ${visualCount}/${scenarios.length} marked visual.`,
  );
}

console.log(`E2E plan ok: ${scenarios.length} scenarios across ${areas.size} areas.`);
console.log(`Visual regression coverage: ${visualCount}/${scenarios.length} scenarios.`);
