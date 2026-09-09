#!/usr/bin/env node
// audit-line-counts.mjs — Fails the build if any TypeScript/TSX file in the
// curated source tree exceeds the line budget defined by the V2 plan.
//
// Modes:
//   default   — scan the full source tree (interface/, shared-models/, src-tauri/src/)
//   --staged  — only audit files staged in git (used by lint-staged pre-commit)
//   --json    — emit machine-readable output instead of human text
//
// Limits (matches AGENTS.md golden rules):
//   - 1000 lines per .ts/.tsx file (HARD)
//   - 300  lines per component file under interface/components/, interface/pages/, interface/domains/<x>/components/ (WARN by default; HARD with --enforce-component-limit)
//
// Baseline:
//   `scripts/line-count-baseline.json` grandfathers pre-existing god-files so the
//   pre-commit hook is usable on a repo that already violates the limit. A listed
//   file passes while it stays at or below its recorded `maxLines`, and fails as
//   soon as it grows — a ratchet, not an exemption.
//
// Exit codes:
//   node scripts/audit-line-counts.mjs --update-baseline   # after a refactor
//   0 — no violations of HARD limits
//   1 — at least one HARD violation OR usage error
//   2 — only WARN-level violations (use --enforce-component-limit to make this 1)
//
// Usage:
//   node scripts/audit-line-counts.mjs
//   node scripts/audit-line-counts.mjs --staged file1.ts file2.tsx
//   node scripts/audit-line-counts.mjs --json
//   node scripts/audit-line-counts.mjs --enforce-component-limit

import { execSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");

const HARD_FILE_LIMIT = 1000;
const COMPONENT_LIMIT = 300;
const BASELINE_PATH = resolve(SCRIPT_DIR, "line-count-baseline.json");

const SCAN_ROOTS = [
  "interface",
  "../../packages/types/src",
  "src-tauri/src",
];

const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  ".bun-cache",
  "dist",
  "release-desktop",
  "target",
  "gen",
  "test-results",
  "playwright-report",
  ".artifacts",
  "coverage",
  ".venv-mini",
  "__pycache__",
  ".pytest_cache",
  "i18n",
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".rs"]);

const COMPONENT_PATH_PATTERNS = [
  /[\\/]interface[\\/]components[\\/]/,
  /[\\/]interface[\\/]pages[\\/]/,
  /[\\/]interface[\\/]domains[\\/][^\\/]+[\\/]components[\\/]/,
];

const argv = process.argv.slice(2);
const mode = {
  staged: argv.includes("--staged"),
  json: argv.includes("--json"),
  enforceComponentLimit: argv.includes("--enforce-component-limit"),
  updateBaseline: argv.includes("--update-baseline"),
  files: argv.filter((a) => !a.startsWith("--")),
};

function isComponentPath(filePath) {
  return COMPONENT_PATH_PATTERNS.some((re) => re.test(filePath));
}

function isAuditableExtension(filePath) {
  const lower = filePath.toLowerCase();
  for (const ext of EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function isAuditablePath(absPath) {
  if (!isAuditableExtension(absPath)) return false;
  if (absPath.includes("\\node_modules\\") || absPath.includes("/node_modules/")) return false;
  if (/[\\/]i18n[\\/]langs[\\/]/.test(absPath)) return false;
  if (/\.test\.(ts|tsx)$/i.test(absPath)) return false;
  if (/\.spec\.(ts|tsx)$/i.test(absPath)) return false;
  if (/\.stories\.(ts|tsx)$/i.test(absPath)) return false;
  if (/\.d\.ts$/i.test(absPath)) return false;
  return true;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      yield* walk(resolve(dir, entry.name));
    } else if (entry.isFile()) {
      yield resolve(dir, entry.name);
    }
  }
}

function collectFiles() {
  if (mode.staged) {
    let stagedRaw;
    try {
      stagedRaw = execSync("git diff --cached --name-only --diff-filter=ACMR", {
        cwd: ROOT,
        encoding: "utf8",
      });
    } catch {
      return [];
    }
    const fromGit = stagedRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((rel) => resolve(ROOT, rel));
    const fromArgs = mode.files.map((f) => resolve(ROOT, f));
    const combined = [...new Set([...fromGit, ...fromArgs])];
    return combined.filter((p) => {
      if (!isAuditablePath(p)) return false;
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
  }

  const found = [];
  for (const root of SCAN_ROOTS) {
    const abs = resolve(ROOT, root);
    try {
      statSync(abs);
    } catch {
      continue;
    }
    for (const file of walk(abs)) {
      if (isAuditablePath(file)) found.push(file);
    }
  }
  return found;
}

function countLines(filePath) {
  const text = readFileSync(filePath, "utf8");
  if (text.length === 0) return 0;
  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) lines++;
  }
  return lines;
}

function loadBaseline() {
  let raw;
  try { raw = readFileSync(BASELINE_PATH, "utf8"); } catch { return new Map(); }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) {
    process.stderr.write(`audit-line-counts: ignoring malformed ${relative(ROOT, BASELINE_PATH)}: ${err.message}\n`);
    return new Map();
  }
  const entries = parsed && typeof parsed.files === "object" && parsed.files ? parsed.files : {};
  const map = new Map();
  for (const [path, entry] of Object.entries(entries)) {
    const maxLines = typeof entry === "number" ? entry : entry?.maxLines;
    if (Number.isInteger(maxLines) && maxLines > 0) map.set(path, maxLines);
  }
  return map;
}

function writeBaseline(hardFiles) {
  let existing = { hardLimit: HARD_FILE_LIMIT, files: {} };
  try { existing = JSON.parse(readFileSync(BASELINE_PATH, "utf8")); } catch { /* start from scratch */ }
  const files = {};
  for (const { path, lines } of hardFiles) {
    const previous = existing.files?.[path];
    files[path] = {
      maxLines: lines,
      reason: (typeof previous === "object" && previous?.reason) ||
        "God-file inherited from V1. Split tracked as tech debt.",
    };
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ ...existing, hardLimit: HARD_FILE_LIMIT, files }, null, 2)}\n`, "utf8");
  process.stdout.write(`audit-line-counts: baseline updated with ${hardFiles.length} file(s)\n`);
}

function main() {
  const files = collectFiles();
  const baseline = loadBaseline();
  const violations = { hard: [], component: [], regressed: [] };
  const grandfathered = [];

  for (const filePath of files) {
    let lines;
    try {
      lines = countLines(filePath);
    } catch (err) {
      if (!mode.json) {
        process.stderr.write(`audit-line-counts: cannot read ${filePath}: ${err.message}\n`);
      }
      continue;
    }
    const rel = relative(ROOT, filePath).replace(/\\/g, "/");
    if (lines > HARD_FILE_LIMIT) {
      const allowance = baseline.get(rel);
      if (allowance === undefined) {
        violations.hard.push({ path: rel, lines, limit: HARD_FILE_LIMIT });
      } else if (lines > allowance) {
        // Grandfathered, but growing: the ratchet only turns one way.
        violations.regressed.push({ path: rel, lines, limit: allowance });
      } else {
        grandfathered.push({ path: rel, lines, limit: allowance });
      }
    } else if (rel.startsWith("interface/") && isComponentPath(filePath) && lines > COMPONENT_LIMIT) {
      violations.component.push({ path: rel, lines, limit: COMPONENT_LIMIT });
    }
  }

  if (mode.updateBaseline) {
    const all = [...violations.hard, ...violations.regressed, ...grandfathered].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    writeBaseline(all);
    process.exit(0);
  }

  if (mode.json) {
    process.stdout.write(
      JSON.stringify(
        {
          scanned: files.length,
          hardLimit: HARD_FILE_LIMIT,
          componentLimit: COMPONENT_LIMIT,
          enforceComponentLimit: mode.enforceComponentLimit,
          grandfathered,
          violations,
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(
      `audit-line-counts: scanned ${files.length} files (hard=${HARD_FILE_LIMIT}, component=${COMPONENT_LIMIT}${mode.enforceComponentLimit ? " enforced" : " warn-only"})\n`,
    );

    if (
      violations.hard.length === 0 &&
      violations.regressed.length === 0 &&
      violations.component.length === 0
    ) {
      process.stdout.write("audit-line-counts: PASS — no violations\n");
    }

    if (grandfathered.length > 0) {
      process.stdout.write(
        `\n[BASELINE] ${grandfathered.length} grandfathered file(s) over ${HARD_FILE_LIMIT} lines (not growing):\n`,
      );
      for (const v of grandfathered) {
        process.stdout.write(
          `  ${v.lines.toString().padStart(6, " ")}/${v.limit}  ${v.path}\n`,
        );
      }
    }

    if (violations.hard.length > 0) {
      process.stderr.write(`\n[HARD] ${violations.hard.length} file(s) exceed ${HARD_FILE_LIMIT} lines:\n`);
      for (const v of violations.hard) {
        process.stderr.write(`  ${v.lines.toString().padStart(6, " ")}  ${v.path}\n`);
      }
    }

    if (violations.regressed.length > 0) {
      process.stderr.write(
        `\n[REGRESSION] ${violations.regressed.length} grandfathered file(s) GREW past their baseline:\n`,
      );
      for (const v of violations.regressed) {
        process.stderr.write(
          `  ${v.lines.toString().padStart(6, " ")}/${v.limit}  ${v.path}  (+${v.lines - v.limit})\n`,
        );
      }
      process.stderr.write(
        "  These files are already over budget — shrink them, do not extend them.\n",
      );
    }

    if (violations.component.length > 0) {
      const stream = mode.enforceComponentLimit ? process.stderr : process.stdout;
      const label = mode.enforceComponentLimit ? "[HARD]" : "[WARN]";
      stream.write(
        `\n${label} ${violations.component.length} component file(s) exceed ${COMPONENT_LIMIT} lines:\n`,
      );
      for (const v of violations.component) {
        stream.write(`  ${v.lines.toString().padStart(6, " ")}  ${v.path}\n`);
      }
    }
  }

  // Blocking conditions: a brand-new file over the hard limit, or a
  // grandfathered file that grew past its baseline. These always fail.
  if (violations.hard.length > 0 || violations.regressed.length > 0) {
    process.exit(1);
  }
  if (violations.component.length > 0) {
    if (mode.enforceComponentLimit) process.exit(1);
    // Component warnings are advisory. Under --staged the caller is lint-staged,
    // which treats ANY non-zero exit as a hard failure and aborts the commit, so
    // the advisory signal must be reported as success there. The standalone
    // `audit:lines` run keeps exit 2 for scripts that want to distinguish it.
    process.exit(mode.staged ? 0 : 2);
  }
  process.exit(0);
}

main();
