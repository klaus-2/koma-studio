import type { FreeAiProviderCatalogEntry } from "./freeAiProviderCatalog";
import { FREE_AI_PROVIDER_CATALOG_CORE } from "./freeAiProviderCatalogCoreData";
import { FREE_AI_PROVIDER_CATALOG_EXTENDED } from "./freeAiProviderCatalogExtendedData";

export const FREE_AI_PROVIDER_CATALOG: FreeAiProviderCatalogEntry[] = [
  ...FREE_AI_PROVIDER_CATALOG_CORE,
  ...FREE_AI_PROVIDER_CATALOG_EXTENDED,
];
