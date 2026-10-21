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

const resolveMiniBackendRuntimeManifestUrl = (artifactsUrl: string | null): string | null => {
  const configuredUrl = normalizeRuntimeArtifactsBaseUrl(artifactsUrl);
  if (!configuredUrl) {
    return null;
  }

  if (configuredUrl.toLowerCase().endsWith(".json")) {
    return configuredUrl;
  }

  if (configuredUrl.toLowerCase().includes("/mini-backend-artifacts/")) {
    return `${configuredUrl}latest.json`;
  }

  return `${configuredUrl}mini-backend-artifacts/latest.json`;
};

const resolveMiniBackendRuntimeUrl = (manifestUrl: string, relativeUrl: string): string => {
  return new URL(relativeUrl, manifestUrl).toString();
};

export {
  normalizeRuntimeArtifactsBaseUrl,
  resolveMiniBackendRuntimeManifestUrl,
  resolveMiniBackendRuntimeUrl,
};
