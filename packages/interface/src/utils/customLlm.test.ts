import { describe, expect, it } from "vitest";

import {
  clampLlmRequestSettings,
  DEFAULT_LLM_REQUEST_SETTINGS,
  withSfxTranslationSettings,
} from "@/utils/customLlm";
import type { GlossaryTerm } from "@/utils/glossary";

const term = (source: string, target: string): GlossaryTerm => ({ source, target });

describe("DEFAULT_LLM_REQUEST_SETTINGS", () => {
  it("starts with an empty glossary", () => {
    expect(DEFAULT_LLM_REQUEST_SETTINGS.glossary).toEqual([]);
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
