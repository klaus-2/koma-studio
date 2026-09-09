import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

// The CPU-fallback markers are matched against log output produced by another
// language, so nothing but reading those files can prove they still line up. A
// PT->EN translation pass previously changed the Python messages and silently
// disabled the Electron CPU-fallback banner.
const MAIN_TS = fileURLToPath(new URL("../electron/main.ts", import.meta.url));
const APP_PY = fileURLToPath(new URL("../../../packages/mini-backend/app.py", import.meta.url));

const MARKERS = [
  "Falling back to CPU automatically",
  "Detector warmup successfully redone on CPU",
];

for (const marker of MARKERS) {
  test(`mini-backend fallback marker survives on both sides: ${marker}`, () => {
    const appPy = readFileSync(APP_PY, "utf8");
    assert.ok(
      appPy.includes(marker),
      `packages/mini-backend/app.py no longer logs ${JSON.stringify(marker)}; the Electron CPU-fallback banner would never fire`,
    );

    const mainTs = readFileSync(MAIN_TS, "utf8");
    assert.ok(
      mainTs.includes(`"${marker}"`),
      `apps/electron/electron/main.ts no longer matches ${JSON.stringify(marker)}`,
    );
  });
}
