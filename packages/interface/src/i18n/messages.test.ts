import { describe, expect, it } from "vitest";

import {
  defaultMessages,
  loadTranslationCatalog,
  translateDynamicMessage,
  translateMessage,
  translateOrFallback,
} from "@/i18n/messages";

describe("translateMessage", () => {
  it("uses the requested locale before English", () => {
    expect(
      translateMessage("pt", "shortcutModal.close", undefined, {
        pt: { "shortcutModal.close": "Fechar" },
      }),
    ).toBe("Fechar");
  });

  it("uses the related locale before English", () => {
    expect(
      translateMessage("pt-br", "shortcutModal.close", undefined, {
        pt: { "shortcutModal.close": "Fechar" },
      }),
    ).toBe("Fechar");
  });

  it("falls back to the default catalog", () => {
    expect(translateMessage("ja", "shortcutModal.close")).toBe(
      defaultMessages["shortcutModal.close"],
    );
  });

  it("preserves intentionally empty translations", () => {
    expect(
      translateMessage("pt", "shortcutModal.close", undefined, {
        pt: { "shortcutModal.close": "" },
      }),
    ).toBe("");
  });

  it("interpolates zero without treating it as missing", () => {
    expect(
      translateMessage("en", "shortcutModal.results_other", {
        count: 0,
      }),
    ).toBe("0 results");
  });

  it("does not interpret replacement tokens in variable values", () => {
    expect(
      translateMessage("en", "shortcutModal.noResults", {
        query: "$&",
      }),
    ).toBe('No shortcuts found for "$&".');
  });

  it("replaces explicitly missing values with empty strings", () => {
    expect(
      translateMessage("en", "shortcutModal.results_other", {
        count: null,
      }),
    ).toBe(" results");
  });

  it("does not resolve inherited object properties", () => {
    expect(translateDynamicMessage("en", "toString")).toBe("toString");
    expect(translateDynamicMessage("en", "__proto__")).toBe("__proto__");
  });

  it("returns unknown dynamic keys unchanged", () => {
    expect(
      translateDynamicMessage("en", "external.missing.message"),
    ).toBe("external.missing.message");
  });

  it("translateOrFallback reads the supplied non-English catalogs", () => {
    expect(
      translateOrFallback("pt", "custom.tooltip", "English text", {
        pt: { "custom.tooltip": "Texto em português" },
      }),
    ).toBe("Texto em português");
  });

  it("translateOrFallback sees catalogs loaded through loadTranslationCatalog", async () => {
    const ptBr = await loadTranslationCatalog("pt-br");
    const [key, value] = Object.entries(ptBr).find(
      ([entryKey, entryValue]) =>
        entryValue !== (defaultMessages as Record<string, string>)[entryKey],
    ) ?? ["", ""];

    expect(key).not.toBe("");
    expect(translateOrFallback("pt-br", key, "fallback")).toBe(value);
  });

  it("translateOrFallback returns the fallback for unknown keys", () => {
    expect(translateOrFallback("en", "does.not.exist", "Fallback copy")).toBe(
      "Fallback copy",
    );
  });

  it("returns the immutable default catalog", async () => {
    const catalog = await loadTranslationCatalog("en");

    expect(catalog).toBe(defaultMessages);
    expect(Object.isFrozen(catalog)).toBe(true);
  });
});
