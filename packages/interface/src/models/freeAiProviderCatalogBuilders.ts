import type {
  FreeProviderAccessType,
  FreeProviderConfigField,
  FreeProviderModelDefinition,
  FreeProviderStage,
  FreeProviderStageDefinition,
  FreeProviderTransport,
} from "./freeAiProviderCatalog";

export const LAST_VERIFIED_AT = "2026-04-06";
export const FREE_RESOURCES_SOURCE_URL = "https://github.com/cheahjs/free-llm-api-resources?tab=readme-ov-file";

export const ACCESS_BADGE_LABELS: Record<FreeProviderAccessType, string> = {
  free: "FREE",
  trial: "TRIAL",
  credit: "CREDIT",
  copilot: "COPILOT",
  paid: "PAID",
  mixed: "MIXED",
  unknown: "CHECK",
};

export interface FreeProviderStageMeta {
  accessType?: FreeProviderAccessType;
  rateLimitSummary?: string;
}

export interface FreeProviderMetadata {
  accessType?: FreeProviderAccessType;
  accessSummary?: string;
  dataPolicyNotice?: string;
  verificationNotice?: string;
  sourceUrl?: string;
  stageDefaults?: Partial<Record<FreeProviderStage, FreeProviderStageMeta>>;
}

export type FreeProviderStageModelMetadata = Partial<
  Record<FreeProviderStage, Record<string, Partial<FreeProviderModelDefinition>>>
>;

const PROVIDER_PARAM_PATTERN = /\{([a-z0-9_]+)\}/gi;

export const resolveProviderApiBase = (
  template: string,
  params: Record<string, string>,
): string =>
  template.replace(PROVIDER_PARAM_PATTERN, (_, rawParamId: string) => {
    const paramId = String(rawParamId || "").trim().toLowerCase();
    const value = String(params[paramId] ?? "").trim();
    return value ? encodeURIComponent(value) : `{${paramId}}`;
  });

const buildTemplateRegex = (
  template: string,
): { regex: RegExp; fieldIds: string[] } => {
  const fieldIds: string[] = [];
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\\\{([a-z0-9_]+)\\\}/gi, (_token, rawParamId: string) => {
    const paramId = String(rawParamId || "").trim().toLowerCase();
    fieldIds.push(paramId);
    return "([^/]+)";
  });
  return { regex: new RegExp(`^${pattern}$`, "i"), fieldIds };
};

export const extractProviderParamsFromApiBase = (
  definition: FreeProviderStageDefinition,
  apiBase: string,
): Record<string, string> => {
  const normalizedApiBase = String(apiBase || "").trim();
  if (!normalizedApiBase) {
    return {};
  }

  const { regex, fieldIds } = buildTemplateRegex(definition.apiBaseTemplate);
  const match = normalizedApiBase.match(regex);
  if (!match || fieldIds.length === 0) {
    return {};
  }

  const params: Record<string, string> = {};
  fieldIds.forEach((fieldId, index) => {
    const captured = match[index + 1];
    if (!captured) {
      return;
    }
    params[fieldId] = decodeURIComponent(captured);
  });
  return params;
};

const normalizeConfigFields = (
  configFields: FreeProviderConfigField[] | undefined,
): FreeProviderConfigField[] =>
  (configFields ?? []).map((field) => ({
    ...field,
    id: field.id.trim().toLowerCase(),
  }));

export const createTranslationStage = (
  apiBaseTemplate: string,
  defaultModel: string,
  models: FreeProviderModelDefinition[],
  requiresUserApiKey = true,
  options?: {
    transport?: FreeProviderTransport;
    configFields?: FreeProviderConfigField[];
    defaultParams?: Record<string, string>;
    allowCustomModelInput?: boolean;
    modelInputPlaceholder?: string;
  },
): FreeProviderStageDefinition => ({
  stage: "translation",
  requiresUserApiKey,
  transport: options?.transport ?? "openai_compatible",
  apiBaseTemplate,
  defaultApiBase: resolveProviderApiBase(
    apiBaseTemplate,
    options?.defaultParams ?? {},
  ),
  defaultModel,
  configFields: normalizeConfigFields(options?.configFields),
  models,
  allowCustomModelInput: options?.allowCustomModelInput ?? true,
  modelInputPlaceholder: options?.modelInputPlaceholder ?? defaultModel,
});

export const createOcrStage = (
  apiBaseTemplate: string,
  defaultModel: string,
  models: FreeProviderModelDefinition[],
  requiresUserApiKey = true,
  options?: {
    transport?: FreeProviderTransport;
    configFields?: FreeProviderConfigField[];
    defaultParams?: Record<string, string>;
    allowCustomModelInput?: boolean;
    modelInputPlaceholder?: string;
  },
): FreeProviderStageDefinition => ({
  stage: "ocr",
  requiresUserApiKey,
  transport: options?.transport ?? "openai_compatible",
  apiBaseTemplate,
  defaultApiBase: resolveProviderApiBase(
    apiBaseTemplate,
    options?.defaultParams ?? {},
  ),
  defaultModel,
  configFields: normalizeConfigFields(options?.configFields),
  models,
  allowCustomModelInput: options?.allowCustomModelInput ?? true,
  modelInputPlaceholder: options?.modelInputPlaceholder ?? defaultModel,
});

export const createCleanStage = (
  apiBaseTemplate: string,
  defaultModel: string,
  models: FreeProviderModelDefinition[],
  requiresUserApiKey = true,
  options?: {
    transport?: FreeProviderTransport;
    configFields?: FreeProviderConfigField[];
    defaultParams?: Record<string, string>;
    allowCustomModelInput?: boolean;
    modelInputPlaceholder?: string;
  },
): FreeProviderStageDefinition => ({
  stage: "clean",
  requiresUserApiKey,
  transport: options?.transport ?? "openai_compatible",
  apiBaseTemplate,
  defaultApiBase: resolveProviderApiBase(
    apiBaseTemplate,
    options?.defaultParams ?? {},
  ),
  defaultModel,
  configFields: normalizeConfigFields(options?.configFields),
  models,
  allowCustomModelInput: options?.allowCustomModelInput ?? true,
  modelInputPlaceholder: options?.modelInputPlaceholder ?? defaultModel,
});
