import { ACCESS_BADGE_LABELS, resolveProviderApiBase } from "./freeAiProviderCatalogBuilders";
import { FREE_AI_PROVIDER_CATALOG } from "./freeAiProviderCatalogData";
import { PROVIDER_METADATA, PROVIDER_STAGE_MODEL_METADATA } from "./freeAiProviderCatalogMetadata";
import type {
  FreeAiProviderCatalogEntry,
  FreeProviderAccessType,
  FreeProviderStage,
  FreeProviderStageDefinition,
} from "./freeAiProviderCatalog.types";
export {
  extractProviderParamsFromApiBase,
  resolveProviderApiBase,
} from "./freeAiProviderCatalogBuilders";
export type {
  FreeAiProviderCatalogEntry,
  FreeProviderAccessType,
  FreeProviderConfigField,
  FreeProviderModelDefinition,
  FreeProviderStage,
  FreeProviderStageDefinition,
  FreeProviderStatus,
  FreeProviderTransport,
  ImageEditCapability,
} from "./freeAiProviderCatalog.types";

const withAccessBadge = <T extends { accessType?: FreeProviderAccessType; accessBadgeLabel?: string }>(
  value: T,
): T => {
  const accessType = value.accessType;
  if (!accessType) {
    return value;
  }
  return {
    ...value,
    accessBadgeLabel: value.accessBadgeLabel ?? ACCESS_BADGE_LABELS[accessType],
  };
};

const enrichStageDefinition = (
  providerId: string,
  stage: FreeProviderStage,
  definition: FreeProviderStageDefinition,
): FreeProviderStageDefinition => {
  const providerMeta = PROVIDER_METADATA[providerId];
  const stageDefaults = providerMeta?.stageDefaults?.[stage];
  const modelMeta = PROVIDER_STAGE_MODEL_METADATA[providerId]?.[stage] ?? {};
  return {
    ...definition,
    models: definition.models.map((model) => {
      const merged = withAccessBadge({
        ...model,
        accessType: stageDefaults?.accessType,
        rateLimitSummary: stageDefaults?.rateLimitSummary,
        ...modelMeta[model.apiModel],
      });
      return merged;
    }),
  };
};

const enrichProviderEntry = (
  provider: FreeAiProviderCatalogEntry,
): FreeAiProviderCatalogEntry => {
  const providerMeta = PROVIDER_METADATA[provider.id];
  const stages = Object.fromEntries(
    (Object.entries(provider.stages) as Array<[FreeProviderStage, FreeProviderStageDefinition | undefined]>)
      .map(([stage, definition]) => [
        stage,
        definition ? enrichStageDefinition(provider.id, stage, definition) : definition,
      ]),
  ) as Partial<Record<FreeProviderStage, FreeProviderStageDefinition>>;

  return withAccessBadge({
    ...provider,
    accessType: providerMeta?.accessType,
    accessSummary: providerMeta?.accessSummary,
    dataPolicyNotice: providerMeta?.dataPolicyNotice,
    verificationNotice: providerMeta?.verificationNotice,
    sourceUrl: providerMeta?.sourceUrl,
    stages,
  });
};

export interface FreeProviderDraftValue {
  model: string;
  apiBase: string;
  apiKey: string;
  params: Record<string, string>;
}

export const FREE_AI_PROVIDER_CATALOG_ENTRIES = FREE_AI_PROVIDER_CATALOG.map(enrichProviderEntry);

export const FREE_AI_PROVIDERS_BY_ID = new Map(
  FREE_AI_PROVIDER_CATALOG_ENTRIES.map((provider) => [provider.id, provider]),
);

export const getFreeProviderStageDefinition = (
  providerId: string,
  stage: FreeProviderStage,
): FreeProviderStageDefinition | null => {
  const provider = FREE_AI_PROVIDERS_BY_ID.get(providerId);
  if (!provider) {
    return null;
  }
  return provider.stages[stage] ?? null;
};

export const getFreeProvidersForStage = (stage: FreeProviderStage): FreeAiProviderCatalogEntry[] =>
  FREE_AI_PROVIDER_CATALOG_ENTRIES.filter((provider) => Boolean(provider.stages[stage]));

export const getDefaultFreeProviderDraft = (
  providerId: string,
  stage: FreeProviderStage,
): FreeProviderDraftValue => {
  const definition = getFreeProviderStageDefinition(providerId, stage);
  const params = (definition?.configFields ?? []).reduce<Record<string, string>>((acc, field) => {
    acc[field.id] = "";
    return acc;
  }, {});
  return {
    model: definition?.defaultModel ?? "",
    apiBase: definition
      ? resolveProviderApiBase(definition.apiBaseTemplate, params)
      : "",
    apiKey: "",
    params,
  };
};
