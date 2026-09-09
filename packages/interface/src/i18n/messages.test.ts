import { describe, expect, it } from "vitest";

import {
  defaultTranslationCatalogs,
  loadTranslationCatalog,
  translateMessage,
} from "./messages";

describe("i18n message catalog loading", () => {
  it("keeps the default locale available synchronously", () => {
    expect(translateMessage("en", "settings.language.label")).toBe("Language");
  });

  it("falls back while a non-default locale catalog is still lazy", () => {
    expect(translateMessage("pt-br", "settings.language.label")).toBe("Language");
  });

  it("uses a loaded non-default locale catalog", async () => {
    const ptBrCatalog = await loadTranslationCatalog("pt-br");

    expect(
      translateMessage("pt-br", "settings.language.label", undefined, {
        ...defaultTranslationCatalogs,
        "pt-br": ptBrCatalog,
      }),
    ).toBe("Idioma");
  });
});
