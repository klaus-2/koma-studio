import { describe, expect, test } from "vitest";

import {
  extractProviderParamsFromApiBase,
  FREE_AI_PROVIDER_CATALOG_ENTRIES,
  FREE_AI_PROVIDERS_BY_ID,
  getDefaultFreeProviderDraft,
  getFreeProviderStageDefinition,
  getFreeProvidersForStage,
  resolveProviderApiBase,
} from "./freeAiProviderCatalog";
import type { FreeProviderStageDefinition } from "./freeAiProviderCatalog";

describe("free AI provider catalog", () => {
  test("keeps provider entries and id map available after data split", () => {
    expect(FREE_AI_PROVIDER_CATALOG_ENTRIES.length).toBeGreaterThan(20);
    expect(FREE_AI_PROVIDERS_BY_ID.get("openrouter")?.name).toMatch(/OpenRouter/i);
    expect(getFreeProvidersForStage("translation").length).toBeGreaterThan(0);
  });

  test("keeps stage definitions and default drafts stable", () => {
    const stage = getFreeProviderStageDefinition("openrouter", "translation");
    expect(stage?.transport).toBe("openai_compatible");
    expect(stage?.models.length).toBeGreaterThan(0);

    const draft = getDefaultFreeProviderDraft("openrouter", "translation");
    expect(draft.model).toBe(stage?.defaultModel);
    expect(draft.apiBase).toContain("openrouter");
  });

  test("round-trips provider api base template params", () => {
    const template = "https://gateway.ai/{accountid}/{projectid}/v1";
    const params = { accountid: "acct", projectid: "proj" };
    const definition: FreeProviderStageDefinition = {
      stage: "translation",
      requiresUserApiKey: true,
      transport: "openai_compatible",
      apiBaseTemplate: template,
      defaultApiBase: "",
      defaultModel: "",
      configFields: [],
      models: [],
    };
    const resolved = resolveProviderApiBase(template, params);
    expect(resolved).toBe("https://gateway.ai/acct/proj/v1");
    expect(extractProviderParamsFromApiBase(definition, resolved)).toEqual(params);
  });
});
