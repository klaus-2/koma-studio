import { buildUrl } from "../config/api";
import { hydrateGuidesCatalog } from "../data/guides-data";
import { hydrateResourcesCatalog } from "../data/resources-data";
import { fetchWithTimeoutAndRetry } from "../utils/http";

type RemoteGuidesCatalogPayload = Parameters<typeof hydrateGuidesCatalog>[0];
type RemoteResourcesCatalogPayload = Parameters<typeof hydrateResourcesCatalog>[0];

const fetchJson = async <TPayload>(path: string): Promise<TPayload | null> => {
  try {
    const response = await fetchWithTimeoutAndRetry(
      buildUrl("authUrl", path),
      {
        method: "GET",
        cache: "no-store",
      },
      { timeoutMs: 1_000, retryCount: 0 },
    );
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as TPayload;
  } catch {
    return null;
  }
};

export const primeRemoteContentCatalog = async (): Promise<void> => {
  const [guides, resources] = await Promise.all([
    fetchJson<RemoteGuidesCatalogPayload>("/api/content/guides"),
    fetchJson<RemoteResourcesCatalogPayload>("/api/content/resources"),
  ]);

  if (guides) {
    hydrateGuidesCatalog(guides);
  }

  if (resources) {
    hydrateResourcesCatalog(resources);
  }
};
