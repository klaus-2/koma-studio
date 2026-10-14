import { describe, expect, it } from "vitest";

import {
  dedupeLocales,
  isRtlLocale,
  normalizeLocale,
  resolveLocaleChain,
  toHtmlLang,
} from "@/i18n/config";

describe("normalizeLocale", () => {
  it.each([
    [null, null],
    [undefined, null],
    ["", null],
    ["   ", null],
    ["en_US", "en"],
    [" EN-gb ", "en"],
    ["pt_BR", "pt-br"],
    ["pt-Latn-BR", "pt-br"],
    ["pt-PT", "pt"],
    ["zh-Hant-HK", "zh-tw"],
    ["zh-Hans-TW", "zh"],
    ["zh-HK", "zh-tw"],
    ["zh-MO", "zh-tw"],
    ["zh-SG", "zh"],
    ["de-AT", "de"],
    ["ar-SA", "ar"],
    ["xx-XX", null],
    ["pt-br!", null],
    ["en--US", null],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeLocale(input)).toBe(expected);
  });
});

describe("locale fallbacks", () => {
  it("deduplicates without changing preference order", () => {
    expect(
      dedupeLocales(["pt_BR", "pt-br", null, "en-US", "en", "fr"]),
    ).toEqual(["pt-br", "en", "fr"]);
  });

  it("preserves the Portuguese fallback chain", () => {
    expect(resolveLocaleChain("pt-br")).toEqual(["pt-br", "pt", "en"]);
    expect(resolveLocaleChain("pt")).toEqual(["pt", "pt-br", "en"]);
  });

  it("preserves the Chinese fallback chain", () => {
    expect(resolveLocaleChain("zh-tw")).toEqual(["zh-tw", "zh", "en"]);
    expect(resolveLocaleChain("zh")).toEqual(["zh", "zh-tw", "en"]);
  });

  it("does not expose shared mutable fallback arrays", () => {
    const chain = resolveLocaleChain("en");
    chain.push("fr");

    expect(resolveLocaleChain("en")).toEqual(["en"]);
  });

  it("provides HTML language tags and direction", () => {
    expect(toHtmlLang("pt-br")).toBe("pt-BR");
    expect(toHtmlLang("zh-tw")).toBe("zh-TW");
    expect(toHtmlLang("en")).toBe("en");

    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });
});
