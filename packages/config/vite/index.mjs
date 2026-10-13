import { readFileSync } from "node:fs";

export const APP_VERSION_DEFINE_KEY = "__KOMA_APP_VERSION__";

export function readShellVersion(shellUrl, manifestName = "package.json") {
  const raw = JSON.parse(readFileSync(new URL(manifestName, shellUrl), "utf8"));
  const version = typeof raw.version === "string" ? raw.version.trim() : "";

  if (version.length === 0) {
    throw new Error(
      `${new URL(manifestName, shellUrl).href} has no non-empty "version". A shell without a version ` +
      "cannot compare itself against a release, so the build fails here instead of injecting a " +
      "placeholder the updater would treat as a real install.",
    );
  }

  return version;
}

export function appVersionDefine(shellUrl, manifestName = "package.json") {
  return { [APP_VERSION_DEFINE_KEY]: JSON.stringify(readShellVersion(shellUrl, manifestName)) };
}
