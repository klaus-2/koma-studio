import "../types";

import { desktopBridge } from "@/lib/desktop-bridge";
export type CustomLlmStage = "translation" | "ocr" | "clean";
export type LlmProfilesPersistenceMode =
  | "desktop_secure"
  | "desktop_local"
  | "browser_local";

export interface LlmRequestSettings {
  extra_context: string;
  image_input_enabled: boolean;
  temperature: number;
  top_p: number;
  max_tokens: number;
  translation_notes_enabled: boolean;
  neighbor_image_context_enabled: boolean;
}

export interface LlmCapabilities {
  extra_context: boolean;
  image_input_enabled: boolean;
  temperature: boolean;
  top_p: boolean;
  max_tokens: boolean;
}

export interface CustomLlmProfile {
  id: string;
  stage: CustomLlmStage;
  label: string;
  apiBase: string;
  apiKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomLlmProfileDraft {
  id: string | null;
  label: string;
  apiBase: string;
  apiKey: string;
  model: string;
}

export type CustomLlmTransport =
  | "openai_compatible"
  | "gemini_native"
  | "nlp_cloud_chatbot"
  | "ollama_native";

interface DesktopProfileStorePayload {
  profiles?: CustomLlmProfile[];
  secureStorage?: boolean;
}

interface DesktopSavedProfilePayload extends DesktopProfileStorePayload {
  profile?: CustomLlmProfile;
}

const CUSTOM_LLM_PROFILES_STORAGE_KEY = "koma-studio.custom-llm-profiles.v1";
const LLM_SETTINGS_STORAGE_KEY = "koma-studio.llm-settings.v1";
const GUEST_CUSTOM_LLM_PROFILE_SCOPE = "__guest__";
const SHARED_CUSTOM_LLM_PROFILE_SCOPE = "__shared__";

const CLOUD_TRANSLATION_MODEL_SLUGS = new Set([
  "gpt_4o",
  "gpt_4o_mini",
  "gpt_4_1",
  "gpt_4_1_mini",
  "claude_3_opus",
  "claude_3_7_sonnet",
  "claude_3_5_haiku",
  "deepseek_v3",
  "gemini_2_0_flash",
  "gemini_2_0_pro",
  "gemini_2_5_flash",
  "gemini_2_5_pro",
  "grok_2_vision",
  "z_ai_glm_4_5v",
]);

const CLOUD_OCR_MODEL_SLUGS = new Set([
  "gpt_4o",
  "gpt_4_1_mini",
  "gpt_4_1_mini_ocr",
  "gemini_2_5_flash",
  "gemini_2_0_flash",
  "gemini_2_0_flash_ocr",
  "google_cloud_vision",
  "google_ocr",
  "microsoft_ocr",
  "microsoft_vision",
  "grok_2_vision",
  "grok_2_vision_ocr",
  "z_ai_glm_4_5v",
  "z_ai_glm_4_5v_ocr",
]);

const OCR_MODELS_WITH_LLM_SETTINGS = new Set([
  "gpt_4o",
  "gpt_4_1_mini",
  "gpt_4_1_mini_ocr",
  "gemini_2_5_flash",
  "gemini_2_0_flash",
  "gemini_2_0_flash_ocr",
  "grok_2_vision",
  "grok_2_vision_ocr",
  "z_ai_glm_4_5v",
  "z_ai_glm_4_5v_ocr",
]);

export const FULL_LLM_CAPABILITIES: LlmCapabilities = {
  extra_context: true,
  image_input_enabled: true,
  temperature: true,
  top_p: true,
  max_tokens: true,
};

export const DEFAULT_LLM_REQUEST_SETTINGS: LlmRequestSettings = {
  extra_context: "",
  image_input_enabled: true,
  temperature: 0.2,
  top_p: 0.95,
  max_tokens: 4096,
  translation_notes_enabled: true,
  neighbor_image_context_enabled: false,
};

export const hasAnyLlmCapability = (
  capabilities: Partial<LlmCapabilities> | null | undefined,
): boolean =>
  Boolean(
    capabilities?.extra_context
    || capabilities?.image_input_enabled
    || capabilities?.temperature
    || capabilities?.top_p
    || capabilities?.max_tokens,
  );

const slugifyModelKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\//g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const clampNumber = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const isBrowser = (): boolean => typeof window !== "undefined";

const sanitizeProfileText = (value: string, maxLength: number): string =>
  value.replace(/\s+/g, " ").trim().slice(0, maxLength);

const sanitizeUrlText = (value: string): string => value.trim().replace(/\s+/g, "");

const sanitizeApiKeyText = (value: string): string => value.trim();

const sanitizeModelText = (value: string): string => sanitizeProfileText(value, 200);

const HUGGINGFACE_ROUTER_API_BASE = "https://router.huggingface.co/v1";
export const OLLAMA_LOCAL_API_BASE = "http://127.0.0.1:11434/v1";

type KnownCustomLlmProvider =
  | "loopback_local"
  | "generic"
  | "groq"
  | "openrouter"
  | "cerebras"
  | "gemini"
  | "huggingface_router"
  | "huggingface_legacy"
  | "airforce"
  | "nlp_cloud"
  | "ollama_cloud"
  | "zhipu_ai"
  | "kluster_ai"
  | "llm7_io"
  | "siliconflow";

const isDesktopRuntime = (): boolean => isBrowser() && desktopBridge.isDesktopRuntime();

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
};

export const isLocalCustomLlmApiBase = (apiBase: string): boolean => {
  if (!apiBase) {
    return false;
  }

  try {
    const parsed = new URL(apiBase);
    return isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const getKnownCustomLlmProvider = (apiBase: string): KnownCustomLlmProvider => {
  if (!apiBase) {
    return "generic";
  }

  try {
    const parsed = new URL(apiBase);
    const host = parsed.hostname.trim().toLowerCase();
    if (isLoopbackHostname(host)) {
      return "loopback_local";
    }
    if (host === "api.groq.com") {
      return "groq";
    }
    if (host === "openrouter.ai") {
      return "openrouter";
    }
    if (host === "api.cerebras.ai") {
      return "cerebras";
    }
    if (host === "generativelanguage.googleapis.com" || host === "aiplatform.googleapis.com") {
      return "gemini";
    }
    if (host === "router.huggingface.co") {
      return "huggingface_router";
    }
    if (host === "api-inference.huggingface.co") {
      return "huggingface_legacy";
    }
    if (host === "api.airforce") {
      return "airforce";
    }
    if (host === "api.nlpcloud.io") {
      return "nlp_cloud";
    }
    if (host === "ollama.com" || host === "api.ollama.com") {
      return "ollama_cloud";
    }
    if (host === "open.bigmodel.cn") {
      return "zhipu_ai";
    }
    if (host === "api.kluster.ai") {
      return "kluster_ai";
    }
    if (host === "api.llm7.io") {
      return "llm7_io";
    }
    if (host === "api.siliconflow.cn") {
      return "siliconflow";
    }
  } catch {
    return "generic";
  }

  return "generic";
};

export const inferCustomLlmTransport = (
  apiBase: string,
  stage?: CustomLlmStage,
): CustomLlmTransport => {
  const provider = getKnownCustomLlmProvider(apiBase);
  if (provider === "gemini") {
    return "gemini_native";
  }
  if (provider === "nlp_cloud") {
    return "nlp_cloud_chatbot";
  }
  if (provider === "ollama_cloud" && stage !== "clean") {
    return "ollama_native";
  }
  return "openai_compatible";
};

export const extractHuggingFaceModelFromLegacyApiBase = (apiBase: string): string => {
  try {
    const parsed = new URL(apiBase);
    if (parsed.hostname.trim().toLowerCase() !== "api-inference.huggingface.co") {
      return "";
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 4 || parts[0] !== "models") {
      return "";
    }

    const v1Index = parts.indexOf("v1");
    if (v1Index < 2) {
      return "";
    }

    return parts.slice(1, v1Index).join("/");
  } catch {
    return "";
  }
};

export const normalizeKnownCustomLlmApiBase = (apiBase: string): string => {
  const sanitized = sanitizeUrlText(apiBase);
  if (!sanitized) {
    return "";
  }

  if (extractHuggingFaceModelFromLegacyApiBase(sanitized)) {
    return HUGGINGFACE_ROUTER_API_BASE;
  }

  return sanitized.replace(/\/+$/g, "");
};

export const requiresCustomLlmApiKey = (apiBase: string): boolean => {
  const provider = getKnownCustomLlmProvider(apiBase);
  return provider === "groq"
    || provider === "openrouter"
    || provider === "cerebras"
    || provider === "gemini"
    || provider === "huggingface_router"
    || provider === "huggingface_legacy"
    || provider === "airforce"
    || provider === "nlp_cloud"
    || provider === "ollama_cloud"
    || provider === "zhipu_ai"
    || provider === "kluster_ai"
    || provider === "llm7_io"
    || provider === "siliconflow";
};

export const getCustomLlmProviderNotice = (apiBase: string): string | null => {
  switch (getKnownCustomLlmProvider(apiBase)) {
    case "loopback_local":
      return isDesktopRuntime()
        ? "The local endpoint (Ollama/OpenAI-compatible) runs through the desktop mini-backend. Enter the model name manually."
        : "Local Ollama endpoints require the desktop app. In the browser, use only a public remote endpoint.";
    case "groq":
      return "Groq requires a valid API key for Custom AI.";
    case "openrouter":
      return "OpenRouter requires a valid API key for Custom AI.";
    case "cerebras":
      return "Cerebras requires a valid API key for Custom AI.";
    case "gemini":
      return "Google AI Studio/Gemini requires a valid API key for Custom AI.";
    case "huggingface_router":
      return "Hugging Face Router requires a valid bearer token.";
    case "huggingface_legacy":
      return "The URL will be normalized to the official Hugging Face router. Provide a valid Bearer token.";
    case "airforce":
      return "Airforce requires a valid Bearer token. Validate the model ID against the provider catalog; names ending in `:free` may not be accepted.";
    case "nlp_cloud":
      return "NLP Cloud uses its native chatbot endpoint. Provide a valid Bearer token and a supported model ID.";
    case "ollama_cloud":
      return "Ollama Cloud uses the native Ollama API. Provide a valid Bearer token and a model ID that exists in `/api/tags`.";
    case "zhipu_ai":
      return "Zhipu AI/BigModel requires a valid API key for Custom AI.";
    case "kluster_ai":
      return "Kluster AI requires a valid API key for Custom AI.";
    case "llm7_io":
      return "LLM7.io requires a valid API key for Custom AI.";
    case "siliconflow":
      return "SiliconFlow requires a valid API key for Custom AI.";
    default:
      return null;
  }
};

export const getCustomLlmNormalizationNotice = (
  originalApiBase: string,
  normalizedApiBase: string,
): string | null => {
  if (getKnownCustomLlmProvider(originalApiBase) === "huggingface_legacy"
    && normalizedApiBase === HUGGINGFACE_ROUTER_API_BASE) {
    return "The URL was normalized to the official Hugging Face router.";
  }

  return null;
};

export const getCustomLlmRuntimeRestriction = (apiBase: string): string | null => {
  if (!isLocalCustomLlmApiBase(apiBase)) {
    return null;
  }
  return isDesktopRuntime()
    ? null
    : "Local Ollama profiles require the desktop app. In the browser, use only a public remote endpoint.";
};

export const shouldUseLocalDesktopTranslationForCustomProfile = (
  profile: CustomLlmProfile | null | undefined,
): boolean => Boolean(profile && isLocalCustomLlmApiBase(profile.apiBase) && isDesktopRuntime());

const buildCustomLlmApiKeyError = (apiBase: string): string => {
  switch (getKnownCustomLlmProvider(apiBase)) {
    case "groq":
      return "Groq requires an API key for Custom AI.";
    case "openrouter":
      return "OpenRouter requires an API key for Custom AI.";
    case "cerebras":
      return "Cerebras requires an API key for Custom AI.";
    case "gemini":
      return "Google AI Studio/Gemini requires an API key for Custom AI.";
    case "huggingface_router":
    case "huggingface_legacy":
      return "Hugging Face Router requires an API key for Custom AI.";
    case "airforce":
      return "Airforce requires an API key for Custom AI.";
    case "nlp_cloud":
      return "NLP Cloud requires an API key for Custom AI.";
    case "ollama_cloud":
      return "Ollama Cloud requires an API key for Custom AI.";
    case "zhipu_ai":
      return "Zhipu AI requires an API key for Custom AI.";
    case "kluster_ai":
      return "Kluster AI requires an API key for Custom AI.";
    case "llm7_io":
      return "LLM7.io requires an API key for Custom AI.";
    case "siliconflow":
      return "SiliconFlow requires an API key for Custom AI.";
    default:
      return "An API key is required for this provider.";
  }
};

const normalizeProfiles = (value: unknown): CustomLlmProfile[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const payload = item as Record<string, unknown>;
    const stage = payload.stage === "ocr" ? "ocr" : payload.stage === "translation" ? "translation" : payload.stage === "clean" ? "clean" : null;
    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    const label = typeof payload.label === "string" ? sanitizeProfileText(payload.label, 80) : "";
    const rawApiBase = typeof payload.apiBase === "string" ? payload.apiBase : "";
    const apiBase = normalizeKnownCustomLlmApiBase(rawApiBase);
    const apiKey = typeof payload.apiKey === "string" ? sanitizeApiKeyText(payload.apiKey) : "";
    const inferredModel = extractHuggingFaceModelFromLegacyApiBase(rawApiBase);
    const model = typeof payload.model === "string"
      ? sanitizeModelText(payload.model || inferredModel)
      : sanitizeModelText(inferredModel);
    const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString();
    const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : createdAt;

    if (!stage || !id || !label || !apiBase || !model) {
      return [];
    }

    return [
      {
        id,
        stage,
        label,
        apiBase,
        apiKey,
        model,
        createdAt,
        updatedAt,
      },
    ];
  });
};

const generateProfileId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getDesktopMode = (secureStorage: boolean | undefined): LlmProfilesPersistenceMode =>
  secureStorage ? "desktop_secure" : "desktop_local";

const normalizeProfileStorageUserId = (userId: string | null | undefined): string =>
  typeof userId === "string" ? userId.trim() : "";

const resolveProfileStorageScope = (userId: string | null | undefined): string =>
  normalizeProfileStorageUserId(userId) || GUEST_CUSTOM_LLM_PROFILE_SCOPE;

const getScopedCustomLlmProfilesStorageKey = (userId: string): string =>
  `${CUSTOM_LLM_PROFILES_STORAGE_KEY}.${encodeURIComponent(userId)}`;

const mergeProfileCollections = (
  ...collections: CustomLlmProfile[][]
): CustomLlmProfile[] => {
  const byId = new Map<string, CustomLlmProfile>();
  for (const collection of collections) {
    for (const profile of collection) {
      const current = byId.get(profile.id);
      if (!current) {
        byId.set(profile.id, profile);
        continue;
      }
      const currentTime = Date.parse(current.updatedAt || current.createdAt || "");
      const nextTime = Date.parse(profile.updatedAt || profile.createdAt || "");
      if (Number.isNaN(currentTime) || (!Number.isNaN(nextTime) && nextTime >= currentTime)) {
        byId.set(profile.id, profile);
      }
    }
  }
  return Array.from(byId.values()).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
};

const readBrowserProfiles = (userId: string): CustomLlmProfile[] => {
  if (!isBrowser()) {
    return [];
  }

  const scopedKey = getScopedCustomLlmProfilesStorageKey(userId);
  const sharedKey = getScopedCustomLlmProfilesStorageKey(SHARED_CUSTOM_LLM_PROFILE_SCOPE);
  const guestKey = getScopedCustomLlmProfilesStorageKey(GUEST_CUSTOM_LLM_PROFILE_SCOPE);
  const hasScopedKey = window.localStorage.getItem(scopedKey) !== null;
  if (hasScopedKey) {
    return mergeProfileCollections(
      normalizeProfiles(
        safeJsonParse<unknown>(
          window.localStorage.getItem(scopedKey),
          [],
        ),
      ),
      normalizeProfiles(
        safeJsonParse<unknown>(
          window.localStorage.getItem(sharedKey),
          [],
        ),
      ),
      userId !== GUEST_CUSTOM_LLM_PROFILE_SCOPE
        ? normalizeProfiles(
            safeJsonParse<unknown>(
              window.localStorage.getItem(guestKey),
              [],
            ),
          )
        : [],
    );
  }

  const legacyProfiles = normalizeProfiles(
    safeJsonParse<unknown>(
      window.localStorage.getItem(CUSTOM_LLM_PROFILES_STORAGE_KEY),
      [],
    ),
  );
  if (legacyProfiles.length === 0) {
    return mergeProfileCollections(
      normalizeProfiles(
        safeJsonParse<unknown>(
          window.localStorage.getItem(sharedKey),
          [],
        ),
      ),
      userId !== GUEST_CUSTOM_LLM_PROFILE_SCOPE
        ? normalizeProfiles(
            safeJsonParse<unknown>(
              window.localStorage.getItem(guestKey),
              [],
            ),
          )
        : [],
    );
  }

  window.localStorage.setItem(scopedKey, JSON.stringify(legacyProfiles));
  window.localStorage.removeItem(CUSTOM_LLM_PROFILES_STORAGE_KEY);
  return mergeProfileCollections(
    legacyProfiles,
    normalizeProfiles(
      safeJsonParse<unknown>(
        window.localStorage.getItem(sharedKey),
        [],
      ),
    ),
  );
};

const writeBrowserProfiles = (userId: string, profiles: CustomLlmProfile[]): void => {
  if (!isBrowser()) {
    return;
  }

  const mergedProfiles = mergeProfileCollections(profiles);
  window.localStorage.setItem(
    getScopedCustomLlmProfilesStorageKey(userId),
    JSON.stringify(mergedProfiles),
  );
  window.localStorage.setItem(
    getScopedCustomLlmProfilesStorageKey(SHARED_CUSTOM_LLM_PROFILE_SCOPE),
    JSON.stringify(mergedProfiles),
  );
};

export const createEmptyCustomLlmDraft = (): CustomLlmProfileDraft => ({
  id: null,
  label: "",
  apiBase: "",
  apiKey: "",
  model: "",
});

export const sanitizeCustomLlmDraft = (
  stage: CustomLlmStage,
  draft: CustomLlmProfileDraft,
): CustomLlmProfile => {
  const timestamp = new Date().toISOString();
  const apiBase = normalizeKnownCustomLlmApiBase(draft.apiBase);
  const inferredModel = extractHuggingFaceModelFromLegacyApiBase(draft.apiBase);
  return {
    id: draft.id?.trim() || generateProfileId(),
    stage,
    label: sanitizeProfileText(draft.label, 80),
    apiBase,
    apiKey: sanitizeApiKeyText(draft.apiKey),
    model: sanitizeModelText(draft.model || inferredModel),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const toCustomModelSelectionKey = (profile: CustomLlmProfile): string =>
  profile.stage === "ocr" ? `custom_ocr:${profile.id}` : `custom:${profile.id}`;

export const toFreeProviderProfileId = (
  providerId: string,
  stage: CustomLlmStage,
): string => `free::${providerId.trim().toLowerCase()}::${stage}`;

export const parseFreeProviderProfileId = (
  profileId: string,
): { providerId: string; stage: CustomLlmStage } | null => {
  const normalized = profileId.trim();
  if (!normalized.startsWith("free::")) {
    return null;
  }
  const [, providerId, stage] = normalized.split("::");
  if (!providerId || (stage !== "translation" && stage !== "ocr" && stage !== "clean")) {
    return null;
  }
  return { providerId, stage };
};

export const isCustomModelSelectionKey = (value: string): boolean =>
  value.startsWith("custom:") || value.startsWith("custom_ocr:") || value.startsWith("custom_clean:");

export const isCloudTranslationModelKey = (value: string): boolean => {
  if (value.startsWith("custom:")) {
    return true;
  }
  return CLOUD_TRANSLATION_MODEL_SLUGS.has(slugifyModelKey(value));
};

export const isCloudOcrModelKey = (value: string): boolean => {
  if (value.startsWith("custom_ocr:")) {
    return true;
  }
  return CLOUD_OCR_MODEL_SLUGS.has(slugifyModelKey(value));
};

export const inferLlmCapabilitiesForModelSelection = (
  stage: CustomLlmStage,
  modelKey: string,
): LlmCapabilities | null => {
  if (stage === "translation") {
    if (modelKey.startsWith("custom:") || isCloudTranslationModelKey(modelKey)) {
      return FULL_LLM_CAPABILITIES;
    }
    return null;
  }

  if (stage === "clean") {
    if (modelKey.startsWith("custom_clean:")) {
      return FULL_LLM_CAPABILITIES;
    }
    return null;
  }

  if (modelKey.startsWith("custom_ocr:")) {
    return FULL_LLM_CAPABILITIES;
  }
  return OCR_MODELS_WITH_LLM_SETTINGS.has(slugifyModelKey(modelKey))
    ? FULL_LLM_CAPABILITIES
    : null;
};

export const toCustomLlmRequestPayload = (
  profile: CustomLlmProfile | null | undefined,
): Record<string, string> | null => {
  if (!profile) {
    return null;
  }

  return {
    api_base: profile.apiBase,
    model: profile.model,
    ...(profile.apiKey ? { api_key: profile.apiKey } : {}),
  };
};

export const findCustomProfileForSelection = (
  selectionKey: string,
  profiles: CustomLlmProfile[],
): CustomLlmProfile | null => {
  if (!isCustomModelSelectionKey(selectionKey)) {
    return null;
  }

  const rawId = selectionKey.startsWith("custom_ocr:")
    ? selectionKey.slice("custom_ocr:".length)
    : selectionKey.startsWith("custom_clean:")
      ? selectionKey.slice("custom_clean:".length)
    : selectionKey.startsWith("custom:")
      ? selectionKey.slice("custom:".length)
      : "";
  const normalizedId = rawId.trim();
  if (!normalizedId) {
    return null;
  }

  return profiles.find((profile) => profile.id === normalizedId) ?? null;
};

export const clampLlmRequestSettings = (
  partial: Partial<LlmRequestSettings>,
): LlmRequestSettings => ({
  extra_context: String(partial.extra_context ?? "").trim(),
  image_input_enabled: partial.image_input_enabled !== false,
  temperature: clampNumber(Number(partial.temperature ?? DEFAULT_LLM_REQUEST_SETTINGS.temperature), 0, 2),
  top_p: clampNumber(Number(partial.top_p ?? DEFAULT_LLM_REQUEST_SETTINGS.top_p), 0, 1),
  max_tokens: Math.round(
    clampNumber(Number(partial.max_tokens ?? DEFAULT_LLM_REQUEST_SETTINGS.max_tokens), 128, 8192),
  ),
  translation_notes_enabled: partial.translation_notes_enabled !== false,
  neighbor_image_context_enabled: partial.neighbor_image_context_enabled === true,
});

export const loadPersistedLlmSettings = (): LlmRequestSettings => {
  if (!isBrowser()) {
    return DEFAULT_LLM_REQUEST_SETTINGS;
  }

  return clampLlmRequestSettings(
    safeJsonParse<Partial<LlmRequestSettings>>(
      window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY),
      DEFAULT_LLM_REQUEST_SETTINGS,
    ),
  );
};

export const persistLlmSettings = (settings: LlmRequestSettings): void => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    LLM_SETTINGS_STORAGE_KEY,
    JSON.stringify(clampLlmRequestSettings(settings)),
  );
};

export const loadCustomLlmProfiles = async (userId?: string | null): Promise<{
  profiles: CustomLlmProfile[];
  mode: LlmProfilesPersistenceMode;
}> => {
  const normalizedUserId = resolveProfileStorageScope(userId);

  const bridge = desktopBridge.desktop?.api?.llmProfiles;
  if (bridge) {
    const payload = (await bridge.list(normalizedUserId)) as DesktopProfileStorePayload | null;
    return {
      profiles: normalizeProfiles(payload?.profiles),
      mode: getDesktopMode(payload?.secureStorage),
    };
  }

  return {
    profiles: readBrowserProfiles(normalizedUserId),
    mode: "browser_local",
  };
};

export const saveCustomLlmProfile = async (
  userId: string | null | undefined,
  stage: CustomLlmStage,
  draft: CustomLlmProfileDraft,
): Promise<{
  profiles: CustomLlmProfile[];
  mode: LlmProfilesPersistenceMode;
  profile: CustomLlmProfile;
}> => {
  const normalizedUserId = resolveProfileStorageScope(userId);

  const sanitizedProfile = sanitizeCustomLlmDraft(stage, draft);
  if (!sanitizedProfile.label || !sanitizedProfile.apiBase || !sanitizedProfile.model) {
    throw new Error("Fill in the Custom LLM name, API base and model.");
  }
  const runtimeRestriction = getCustomLlmRuntimeRestriction(sanitizedProfile.apiBase);
  if (runtimeRestriction) {
    throw new Error(runtimeRestriction);
  }
  if (requiresCustomLlmApiKey(sanitizedProfile.apiBase) && !sanitizedProfile.apiKey) {
    throw new Error(buildCustomLlmApiKeyError(sanitizedProfile.apiBase));
  }

  const bridge = desktopBridge.desktop?.api?.llmProfiles;
  if (bridge) {
    const payload = (await bridge.save(normalizedUserId, sanitizedProfile)) as DesktopSavedProfilePayload | null;
    const normalizedProfile = normalizeProfiles(payload?.profile ? [payload.profile] : [sanitizedProfile])[0] ?? sanitizedProfile;
    return {
      profiles: normalizeProfiles(payload?.profiles),
      mode: getDesktopMode(payload?.secureStorage),
      profile: normalizedProfile,
    };
  }

  const existing = readBrowserProfiles(normalizedUserId);
  const now = new Date().toISOString();
  const previous = existing.find((profile) => profile.id === sanitizedProfile.id);
  const nextProfile: CustomLlmProfile = {
    ...sanitizedProfile,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  const nextProfiles = [
    ...existing.filter((profile) => profile.id !== nextProfile.id),
    nextProfile,
  ].sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  writeBrowserProfiles(normalizedUserId, nextProfiles);

  return {
    profiles: nextProfiles,
    mode: "browser_local",
    profile: nextProfile,
  };
};

export const removeCustomLlmProfile = async (
  userId: string | null | undefined,
  profileId: string,
): Promise<{
  profiles: CustomLlmProfile[];
  mode: LlmProfilesPersistenceMode;
}> => {
  const normalizedUserId = resolveProfileStorageScope(userId);

  const normalizedId = profileId.trim();
  if (!normalizedId) {
    throw new Error("Invalid custom profile.");
  }

  const bridge = desktopBridge.desktop?.api?.llmProfiles;
  if (bridge) {
    const payload = (await bridge.remove(normalizedUserId, normalizedId)) as DesktopProfileStorePayload | null;
    return {
      profiles: normalizeProfiles(payload?.profiles),
      mode: getDesktopMode(payload?.secureStorage),
    };
  }

  const nextProfiles = readBrowserProfiles(normalizedUserId).filter((profile) => profile.id !== normalizedId);
  writeBrowserProfiles(normalizedUserId, nextProfiles);
  return {
    profiles: nextProfiles,
    mode: "browser_local",
  };
};

export interface ModelDiscoveryResult {
  available: boolean;
  models: Array<{ id: string; object: string; created: number }>;
  count: number;
  error?: string;
}

export interface VisionProbeResult {
  vision_supported: boolean;
  model: string;
  error?: string;
}
