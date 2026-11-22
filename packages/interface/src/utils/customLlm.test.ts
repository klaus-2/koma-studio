import { beforeAll, describe, expect, it } from "vitest";

import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import {
  clampLlmRequestSettings,
  DEFAULT_LLM_REQUEST_SETTINGS,
  inferCustomLlmTransport,
  loadCustomLlmProfiles,
  requiresCustomLlmApiKey,
  resolveCleanProtocolForApiBase,
  sanitizeCustomLlmDraft,
  toCustomLlmRequestPayload,
  withSfxTranslationSettings,
} from "@/utils/customLlm";
import type { GlossaryTerm } from "@/utils/glossary";

const term = (
  source: string,
  target: string,
  never_translate = false,
): GlossaryTerm => ({ source, target, never_translate });

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

describe("DEFAULT_LLM_REQUEST_SETTINGS", () => {
  it("starts with an empty glossary", () => {
    expect(DEFAULT_LLM_REQUEST_SETTINGS.glossary).toEqual([]);
  });

  it("starts with translation memory reads off", () => {
    expect(DEFAULT_LLM_REQUEST_SETTINGS.translation_memory_enabled).toBe(false);
  });

  it("keeps the never_translate flag through the settings clamp", () => {
    const settings = clampLlmRequestSettings({
      glossary: [
        { source: " 先輩 ", target: "senpai", never_translate: true },
        { source: "部長", target: "manager", never_translate: false },
      ],
    });
    expect(settings.glossary).toEqual([
      term("先輩", "senpai", true),
      term("部長", "manager", false),
    ]);
  });

  it("coerces translation_memory_enabled to a strict boolean", () => {
    expect(clampLlmRequestSettings({ translation_memory_enabled: true }).translation_memory_enabled).toBe(true);
    expect(clampLlmRequestSettings({ translation_memory_enabled: "yes" }).translation_memory_enabled).toBe(false);
    expect(clampLlmRequestSettings({}).translation_memory_enabled).toBe(false);
  });
});

describe("clampLlmRequestSettings", () => {
  it("preserves glossary terms passed through it", () => {
    const settings = clampLlmRequestSettings({
      ...DEFAULT_LLM_REQUEST_SETTINGS,
      glossary: [term(" 先輩 ", "senpai")],
    });
    expect(settings.glossary).toEqual([term("先輩", "senpai")]);
  });

  it("installs an empty glossary when the partial omits it", () => {
    const settings = clampLlmRequestSettings({ extra_context: "x" });
    expect(settings.glossary).toEqual([]);
  });

  it("rebuilds defaults from a non-object payload", () => {
    expect(clampLlmRequestSettings(null)).toEqual(DEFAULT_LLM_REQUEST_SETTINGS);
    expect(clampLlmRequestSettings("garbage")).toEqual(
      DEFAULT_LLM_REQUEST_SETTINGS,
    );
  });
});

describe("withSfxTranslationSettings", () => {
  it("preserves the glossary while rewriting context and notes", () => {
    const settings = withSfxTranslationSettings(
      {
        ...DEFAULT_LLM_REQUEST_SETTINGS,
        glossary: [term("先輩", "senpai")],
      },
      "sfx ctx",
    );
    expect(settings.glossary).toEqual([term("先輩", "senpai")]);
    expect(settings.extra_context).toBe("sfx ctx");
    expect(settings.translation_notes_enabled).toBe(false);
  });
});

describe("toCustomLlmRequestPayload protocol carrier", () => {
  it("emits the protocol when present and not auto", () => {
    expect(
      toCustomLlmRequestPayload({
        apiBase: "https://fal.run",
        apiKey: "key",
        model: "fal-ai/nano-banana/edit",
        protocol: "fal",
      }),
    ).toEqual({
      api_base: "https://fal.run",
      model: "fal-ai/nano-banana/edit",
      api_key: "key",
      protocol: "fal",
    });
  });

  it("omits the protocol for auto and absent values", () => {
    expect(
      toCustomLlmRequestPayload({
        apiBase: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o",
        protocol: "auto",
      }),
    ).toEqual({ api_base: "https://api.openai.com/v1", model: "gpt-4o" });
    expect(
      toCustomLlmRequestPayload({
        apiBase: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o",
      }),
    ).toEqual({ api_base: "https://api.openai.com/v1", model: "gpt-4o" });
    expect(toCustomLlmRequestPayload(null)).toBeNull();
  });
});

describe("sanitizeCustomLlmDraft protocol", () => {
  it("carries the draft protocol into the sanitized profile", () => {
    const profile = sanitizeCustomLlmDraft("clean", {
      id: null,
      label: "Stability",
      apiBase: "https://api.stability.ai",
      apiKey: "k",
      model: "search-and-replace",
      protocol: "stability",
    });
    expect(profile.protocol).toBe("stability");
  });

  it("leaves the protocol absent when the draft omits it", () => {
    const profile = sanitizeCustomLlmDraft("clean", {
      id: null,
      label: "Plain",
      apiBase: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-4o",
    });
    expect(profile.protocol).toBeUndefined();
  });
});

describe("loadCustomLlmProfiles protocol round-trip", () => {
  it("keeps valid protocols and drops unknown ones on hydration", async () => {
    const now = "2026-01-01T00:00:00.000Z";
    window.localStorage.setItem(
      "koma-studio.custom-llm-profiles.v1.__guest__",
      JSON.stringify([
        {
          id: "p1",
          stage: "clean",
          label: "Replicate",
          apiBase: "https://api.replicate.com/v1",
          apiKey: "k",
          model: "dpakkk/image-object-removal",
          protocol: "replicate",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "p2",
          stage: "clean",
          label: "Bogus protocol",
          apiBase: "https://fal.run",
          apiKey: "k",
          model: "fal-ai/nano-banana/edit",
          protocol: "bogus",
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );

    const { profiles } = await loadCustomLlmProfiles(null);

    expect(profiles.find((profile) => profile.id === "p1")?.protocol).toBe("replicate");
    expect(profiles.find((profile) => profile.id === "p2")?.protocol).toBeUndefined();
  });
});

describe("resolveCleanProtocolForApiBase", () => {
  it.each([
    ["https://api.replicate.com/v1", "replicate"],
    ["https://fal.run/fal-ai/nano-banana/edit", "fal"],
    ["https://queue.fal.run/fal-ai/qwen-image-edit", "fal"],
    ["https://falrun.com/fal-ai/qwen-image-edit", "fal"],
    ["https://api.stability.ai", "stability"],
    ["https://api.cloudflare.com/client/v4/accounts/abc/ai/run", "cloudflare"],
    ["https://api.cloudflare.com/client/v4/accounts/abc/ai/run/", "cloudflare"],
    ["https://api.cloudflare.com/client/v4/accounts/abc/ai/v1", "auto"],
    ["https://generativelanguage.googleapis.com/v1beta/models", "gemini"],
    [
      "https://aiplatform.googleapis.com/v1/projects/p/locations/l/endpoints/openapi",
      "auto",
    ],
    ["https://aiplatform.googleapis.com/v1/projects/p/locations/l", "gemini"],
    ["https://api.openai.com/v1", "auto"],
    ["not-a-url", "auto"],
    ["", "auto"],
  ])("%s -> %s", (apiBase, expected) => {
    expect(resolveCleanProtocolForApiBase(apiBase)).toBe(expected);
  });
});

describe("requiresCustomLlmApiKey image-edit hosts", () => {
  it.each([
    "https://api.replicate.com/v1",
    "https://fal.run/fal-ai/nano-banana/edit",
    "https://queue.fal.run/fal-ai/qwen-image-edit",
    "https://falrun.com/fal-ai/qwen-image-edit",
    "https://api.stability.ai",
  ])("requires a key for %s", (apiBase) => {
    expect(requiresCustomLlmApiKey(apiBase)).toBe(true);
  });

  it("keeps unknown hosts keyless", () => {
    expect(requiresCustomLlmApiKey("https://example.com/v1")).toBe(false);
  });
});

describe("inferCustomLlmTransport image-edit hosts", () => {
  it("maps the new image-edit transports", () => {
    expect(inferCustomLlmTransport("https://api.replicate.com/v1", "clean")).toBe("replicate");
    expect(inferCustomLlmTransport("https://fal.run/x", "clean")).toBe("fal");
    expect(inferCustomLlmTransport("https://api.stability.ai", "clean")).toBe("stability");
    expect(
      inferCustomLlmTransport(
        "https://api.cloudflare.com/client/v4/accounts/a/ai/run",
        "clean",
      ),
    ).toBe("cloudflare_native");
    expect(
      inferCustomLlmTransport(
        "https://api.cloudflare.com/client/v4/accounts/a/ai/v1",
        "clean",
      ),
    ).toBe("openai_compatible");
    expect(inferCustomLlmTransport("https://api.openai.com/v1", "clean")).toBe("openai_compatible");
  });
});
