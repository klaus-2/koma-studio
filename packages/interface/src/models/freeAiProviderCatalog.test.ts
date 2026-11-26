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

  test("image-edit clean providers are integrated with complete metadata", () => {
    for (const providerId of ["fal_ai", "stability"]) {
      const provider = FREE_AI_PROVIDERS_BY_ID.get(providerId);
      expect(provider, providerId).toBeDefined();
      expect(provider?.status).toBe("integrated");
      expect(provider?.lastVerifiedAt).not.toBe("");
      expect(provider?.docsUrl).not.toBe("");
      expect(provider?.setupUrl).not.toBe("");
      expect(provider?.limitsUrl).not.toBe("");
      expect(provider?.rateLimitsUrl).not.toBe("");
      expect(provider?.setupSummary).not.toBe("");
      expect(provider?.limitsSummary).not.toBe("");
      expect(provider?.rateLimitSummary).not.toBe("");
    }
  });

  test("fal_ai and stability expose native clean stages", () => {
    const falClean = getFreeProviderStageDefinition("fal_ai", "clean");
    expect(falClean?.transport).toBe("fal");
    expect(falClean?.defaultApiBase).toBe("https://fal.run");
    expect(falClean?.defaultModel).toBe("fal-ai/nano-banana/edit");
    expect(falClean?.requiresUserApiKey).toBe(true);
    expect(
      falClean?.models.map((model) => model.apiModel),
    ).toEqual([
      "fal-ai/nano-banana/edit",
      "fal-ai/nano-banana-pro/edit",
      "fal-ai/flux-pro/kontext",
      "fal-ai/qwen-image-edit",
    ]);

    const stabilityClean = getFreeProviderStageDefinition("stability", "clean");
    expect(stabilityClean?.transport).toBe("stability");
    expect(stabilityClean?.defaultApiBase).toBe("https://api.stability.ai");
    expect(stabilityClean?.defaultModel).toBe("search-and-replace");
    expect(stabilityClean?.requiresUserApiKey).toBe(true);
  });

  test("replicate clean runs on the native replicate transport without version suffixes", () => {
    const replicateClean = getFreeProviderStageDefinition("replicate", "clean");
    expect(replicateClean?.transport).toBe("replicate");
    expect(replicateClean?.defaultModel).toBe("dpakkk/image-object-removal");
    expect(
      replicateClean?.models.every((model) => !model.apiModel.includes(":")),
    ).toBe(true);
    expect(
      replicateClean?.models.map((model) => model.apiModel),
    ).toContain("google/nano-banana");
    expect(
      replicateClean?.models.map((model) => model.apiModel),
    ).toContain("black-forest-labs/flux-kontext-pro");
  });

  test("cloudflare_workers_ai clean uses the native run base", () => {
    const cloudflareClean = getFreeProviderStageDefinition(
      "cloudflare_workers_ai",
      "clean",
    );
    expect(cloudflareClean?.transport).toBe("cloudflare_native");
    expect(cloudflareClean?.defaultModel).toBe(
      "@cf/black-forest-labs/flux-2-klein-9b",
    );
    expect(cloudflareClean?.apiBaseTemplate).toBe(
      "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run",
    );
    expect(cloudflareClean?.requiresUserApiKey).toBe(true);
  });

  test("clean catalog excludes text-only LLMs and tags image edit capabilities", () => {
    const blockedTextOnly = new Set([
      "gemini-2.5-flash",
      "google/gemini-2.5-flash",
      "gpt-4o",
      "gpt-4o-mini",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
    ]);
    for (const provider of FREE_AI_PROVIDER_CATALOG_ENTRIES) {
      const cleanStage = provider.stages.clean;
      if (!cleanStage) continue;
      for (const model of cleanStage.models) {
        expect(blockedTextOnly.has(model.apiModel)).toBe(false);
        expect(["clean_and_aio_ai", "clean_only"]).toContain(model.imageEditCapability);
      }
    }
  });
});
