import { describe, expect, it } from "vitest";

import {
  clampGlossary,
  clampLlmRequestSettings,
  DEFAULT_LLM_REQUEST_SETTINGS,
  withSfxTranslationSettings,
  type GlossaryTerm,
} from "@/utils/customLlm";

const term = (source: string, target: string): GlossaryTerm => ({ source, target });

describe("DEFAULT_LLM_REQUEST_SETTINGS", () => {
  it("starts with an empty glossary", () => {
    expect(DEFAULT_LLM_REQUEST_SETTINGS.glossary).toEqual([]);
  });
});

describe("clampGlossary", () => {
  it("trims both sides and drops incomplete or non-string pairs", () => {
    expect(
      clampGlossary([
        term("  先輩  ", "  senpai  "),
        term("", "orphan-target"),
        term("orphan-source", ""),
        term("   ", "y"),
      ]),
    ).toEqual([term("先輩", "senpai")]);
  });

  it("keeps the first pair for a duplicated source", () => {
    expect(
      clampGlossary([
        term("先輩", "senpai"),
        term("先輩", "senior"),
        term("先輩", "elder"),
      ]),
    ).toEqual([term("先輩", "senpai")]);
  });

  it("matches sources case-sensitively", () => {
    expect(clampGlossary([term("GLOSSARY", "a"), term("glossary", "b")])).toEqual([
      term("GLOSSARY", "a"),
      term("glossary", "b"),
    ]);
  });

  it("caps the list at 200 terms", () => {
    const terms = Array.from({ length: 250 }, (_, index) =>
      term(`source-${index}`, `target-${index}`),
    );
    const clamped = clampGlossary(terms);
    expect(clamped).toHaveLength(200);
    expect(clamped[199]).toEqual(term("source-199", "target-199"));
  });

  it("truncates source at 120 and target at 240 characters", () => {
    const clamped = clampGlossary([term("s".repeat(500), "t".repeat(500))]);
    expect(clamped).toHaveLength(1);
    expect(clamped[0]?.source).toHaveLength(120);
    expect(clamped[0]?.target).toHaveLength(240);
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
