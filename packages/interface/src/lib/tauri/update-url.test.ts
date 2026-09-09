import { describe, expect, it } from "vitest";
import { buildIncrementalManifestUrl } from "./update-url";

describe("buildIncrementalManifestUrl", () => {
  it("builds the beta manifest URL from the update server root", () => {
    expect(
      buildIncrementalManifestUrl("https://api.koma-studio.site/updates/", "beta"),
    ).toBe("https://api.koma-studio.site/updates/beta/manifest.json");
  });

  it("replaces an existing stable segment when switching channel", () => {
    expect(
      buildIncrementalManifestUrl("https://api.koma-studio.site/updates/stable/", "beta"),
    ).toBe("https://api.koma-studio.site/updates/beta/manifest.json");
  });

  it("normalizes a manifest.json base path", () => {
    expect(
      buildIncrementalManifestUrl("https://api.koma-studio.site/updates/stable/manifest.json", "stable"),
    ).toBe("https://api.koma-studio.site/updates/stable/manifest.json");
  });

  it("returns null when no base URL is available", () => {
    expect(buildIncrementalManifestUrl(null, "stable")).toBeNull();
  });
});
