import { describe, expect, it } from "vitest";

import {
  APP_WEBFONT_FAMILIES,
  KOMA_FONT_STYLESHEET_URL,
  parseGoogleFontFamilies,
} from "./app-webfonts";

describe("parseGoogleFontFamilies", () => {
  it("reads the family names the app stylesheet actually loads", () => {
    expect(parseGoogleFontFamilies(KOMA_FONT_STYLESHEET_URL)).toEqual([
      "Archivo",
      "Cabin",
      "Instrument Serif",
      "JetBrains Mono",
      "Manrope",
    ]);
  });

  it("keeps the url order, turns '+' into spaces and drops the axis spec", () => {
    expect(
      parseGoogleFontFamilies(
        "https://fonts.googleapis.com/css2?family=Zen+Dots&family=Rowdies:wght@300;400&display=swap",
      ),
    ).toEqual(["Zen Dots", "Rowdies"]);
  });

  it("decodes percent-encoded spaces exactly as it decodes '+'", () => {
    expect(
      parseGoogleFontFamilies("https://fonts.googleapis.com/css2?family=Red%20Hat%20Display"),
    ).toEqual(["Red Hat Display"]);
    expect(
      parseGoogleFontFamilies("https://fonts.googleapis.com/css2?family=Red+Hat+Display"),
    ).toEqual(["Red Hat Display"]);
  });

  it("ignores non-family parameters and dedupes repeated families", () => {
    expect(
      parseGoogleFontFamilies("css2?family=Lora:wght@400&subset=latin&family=Lora:wght@700"),
    ).toEqual(["Lora"]);
  });

  it("returns an empty list for a url without any family parameter", () => {
    expect(parseGoogleFontFamilies("")).toEqual([]);
    expect(parseGoogleFontFamilies("https://fonts.googleapis.com/css2?display=swap")).toEqual([]);
  });
});

describe("APP_WEBFONT_FAMILIES", () => {
  it("is the single-sourced list of the five families main.tsx injects", () => {
    expect(APP_WEBFONT_FAMILIES).toEqual([
      "Archivo",
      "Cabin",
      "Instrument Serif",
      "JetBrains Mono",
      "Manrope",
    ]);
  });

  it("ships decoded names, with no '+' or %20 left over from the url", () => {
    expect(APP_WEBFONT_FAMILIES).toHaveLength(5);
    for (const family of APP_WEBFONT_FAMILIES) {
      expect(family).not.toMatch(/[+%]/);
    }
  });

  it("stays in sync with the stylesheet url it was parsed from", () => {
    expect(APP_WEBFONT_FAMILIES).toEqual(parseGoogleFontFamilies(KOMA_FONT_STYLESHEET_URL));
    for (const family of APP_WEBFONT_FAMILIES) {
      expect(KOMA_FONT_STYLESHEET_URL).toContain(`family=${family.replaceAll(" ", "+")}`);
    }
  });
});
