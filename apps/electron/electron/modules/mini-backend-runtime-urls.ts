/**
 * Mini-backend runtime artifact / manifest URL helpers.
 */
const normalizeRuntimeArtifactsBaseUrl = (rawUrl: string | null): string | null => {
  if (!rawUrl) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

/**
 * GitHub release assets are flat and per-platform manifests live side by side,
 * so each platform claims its own manifest filename under the feed base.
 */
const buildMiniBackendRuntimeManifestFileName = (
  platform: NodeJS.Platform,
  arch: string,
): string => `mini-backend-latest-${platform}-${arch}.json`;

const resolveMiniBackendRuntimeManifestUrl = (
  artifactsUrl: string | null,
  {
    platform = process.platform,
    arch = process.arch,
  }: { platform?: NodeJS.Platform; arch?: string } = {},
): string | null => {
  const configuredUrl = normalizeRuntimeArtifactsBaseUrl(artifactsUrl);
  if (!configuredUrl) {
    return null;
  }

  if (configuredUrl.toLowerCase().endsWith(".json")) {
    return configuredUrl;
  }

  return `${configuredUrl}${buildMiniBackendRuntimeManifestFileName(platform, arch)}`;
};

export {
  buildMiniBackendRuntimeManifestFileName,
  normalizeRuntimeArtifactsBaseUrl,
  resolveMiniBackendRuntimeManifestUrl,
};
