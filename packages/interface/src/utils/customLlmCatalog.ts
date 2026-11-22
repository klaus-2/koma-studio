export const CLEAN_PROTOCOL_OPTIONS = [
  "auto",
  "openai_chat",
  "openai_images_edits",
  "gemini",
  "replicate",
  "fal",
  "stability",
  "cloudflare",
] as const;

export type CleanProtocol = (typeof CLEAN_PROTOCOL_OPTIONS)[number];

export const isCleanProtocol = (value: unknown): value is CleanProtocol =>
  typeof value === "string"
  && CLEAN_PROTOCOL_OPTIONS.some((option) => option === value);

export const CLOUD_TRANSLATION_MODEL_SLUGS = new Set([
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

export const CLOUD_OCR_MODEL_SLUGS = new Set([
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

export const OCR_MODELS_WITH_LLM_SETTINGS = new Set([
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

export const isCloudflareNativeCleanApiBase = (apiBase: string): boolean => {
  if (!apiBase) {
    return false;
  }

  try {
    const parsed = new URL(apiBase);
    if (parsed.hostname.trim().toLowerCase() !== "api.cloudflare.com") {
      return false;
    }
    const path = parsed.pathname.toLowerCase();
    return path.includes("/accounts/") && /\/ai\/run(\/|$)/.test(path);
  } catch {
    return false;
  }
};

export const resolveCleanProtocolForApiBase = (apiBase: string): CleanProtocol => {
  if (!apiBase) {
    return "auto";
  }

  try {
    const parsed = new URL(apiBase);
    const host = parsed.hostname.trim().toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host === "api.replicate.com") {
      return "replicate";
    }
    if (host === "fal.run" || host === "queue.fal.run" || host === "falrun.com") {
      return "fal";
    }
    if (host === "api.stability.ai") {
      return "stability";
    }
    if (host === "api.cloudflare.com") {
      const isNativeRun =
        path.includes("/accounts/")
        && (path.includes("/ai/run/") || path.endsWith("/ai/run"));
      return isNativeRun ? "cloudflare" : "auto";
    }
    if (host === "generativelanguage.googleapis.com") {
      return "gemini";
    }
    if (host === "aiplatform.googleapis.com") {
      return path.includes("/endpoints/openapi") ? "auto" : "gemini";
    }
  } catch {
    return "auto";
  }

  return "auto";
};
