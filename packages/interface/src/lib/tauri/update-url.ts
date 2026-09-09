import type { UpdaterChannel } from "@/types";

const CHANNEL_PATH_RE = /\/(stable|beta)\/?$/i;
const MANIFEST_FILE_RE = /\/manifest\.json$/i;

const normalizeBasePath = (pathname: string): string => {
  const withoutManifest = pathname.replace(MANIFEST_FILE_RE, "/");
  return withoutManifest.endsWith("/") ? withoutManifest : `${withoutManifest}/`;
};

export const buildIncrementalManifestUrl = (
  runtimeArtifactsUrl: string | null | undefined,
  channel: UpdaterChannel,
): string | null => {
  const raw = runtimeArtifactsUrl?.trim();
  if (!raw) {
    return null;
  }

  const targetSegment = channel === "beta" ? "beta" : "stable";

  const buildFromPath = (pathname: string): string => {
    const normalizedBasePath = normalizeBasePath(pathname);
    const normalizedPath = CHANNEL_PATH_RE.test(normalizedBasePath)
      ? normalizedBasePath.replace(CHANNEL_PATH_RE, `/${targetSegment}/`)
      : `${normalizedBasePath}${targetSegment}/`;
    return `${normalizedPath}manifest.json`;
  };

  try {
    const parsed = new URL(raw);
    parsed.pathname = buildFromPath(parsed.pathname);
    return parsed.toString();
  } catch {
    const stripped = raw.replace(MANIFEST_FILE_RE, "");
    const normalizedBase = CHANNEL_PATH_RE.test(stripped)
      ? stripped.replace(CHANNEL_PATH_RE, `/${targetSegment}/`)
      : `${stripped.replace(/\/?$/, "")}/${targetSegment}/`;
    return `${normalizedBase}manifest.json`;
  }
};
