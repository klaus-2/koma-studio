// Monorepo lint-staged: the per-app ESLint pass runs through a wrapper script
// (lint-staged executes tasks without a shell, so `cd <app> && eslint` can
// never work); then a root oxlint pass over all staged JS/TS (error gate).
// Apps are listed in scripts/lint-staged-eslint.mjs.

/**
 * @param {string[]} files staged files (absolute paths in lint-staged 15)
 * @returns {string[]} commands to execute
 */
export default async function lintStaged(files) {
  const commands = [];

  const jsLike = files.filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
  if (jsLike.length > 0) {
    const quoted = jsLike.map((f) => JSON.stringify(f)).join(" ");
    commands.push(`node scripts/lint-staged-eslint.mjs ${quoted}`);
    commands.push(`bunx oxlint ${quoted}`);
  }

  const auditable = files.filter((f) => /\.(ts|tsx|rs)$/.test(f));
  if (auditable.length > 0) {
    commands.push("node apps/tauri/scripts/audit-line-counts.mjs --staged");
  }

  return commands;
}
