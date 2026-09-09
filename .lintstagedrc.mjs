// Monorepo lint-staged: groups files by app and runs that app's eslint, then
// a root oxlint pass over all staged JS/TS (error gate). Add an app to
// LINTED_APPS when it gets its own eslint config.
const LINTED_APPS = ["apps/tauri", "apps/electron"];

/**
 * @param {string[]} files staged files (paths relative to the repo root)
 * @returns {string[]} commands to execute
 */
export default async function lintStaged(files) {
  const { relative, join } = await import("node:path");
  const commands = [];

  for (const app of LINTED_APPS) {
    const owned = files.filter(
      (f) => f.startsWith(`${app}/`) && /\.(ts|tsx|js|mjs|cjs)$/.test(f),
    );
    if (owned.length === 0) continue;

    const rel = owned.map((f) => JSON.stringify(relative(app, f))).join(" ");
    commands.push(`cd ${join(app).replaceAll("\\", "/")} && bunx eslint --fix --no-warn-ignored ${rel}`);
  }

  const jsLike = files.filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
  if (jsLike.length > 0) {
    const relAll = jsLike.map((f) => JSON.stringify(f)).join(" ");
    commands.push(`bunx oxlint ${relAll}`);
  }

  return commands;
}
