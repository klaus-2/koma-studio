import { describe, expect, it } from "vitest";

import { DIRECT_IMAGES_CHAPTER_ID } from "@/pages/dashboard/lib/aio-chapters";
import {
  resolveWorkGlossaryForChapter,
  resolveWorkGlossarySettings,
} from "@/pages/dashboard/hooks/translator.execution";
import { useWorksStore } from "@/pages/dashboard/stores/works-store";
import type { LlmRequestSettings } from "@/utils/customLlm";
import { clampLlmRequestSettings } from "@/utils/customLlm";
import type { GlossaryTerm } from "@/utils/glossary";
import type { LoadedImage } from "@/types/dashboard.types";
import { createDirectPageFile } from "@/utils/page-source";

const term = (source: string, target: string): GlossaryTerm => ({
  source,
  target,
  never_translate: false,
});

const image = (chapterLabel?: string): LoadedImage => ({
  id: "img-1",
  file: createDirectPageFile(
    new File(["page"], "page-1.png", { type: "image/png" }),
  ),
  url: "blob:img-1",
  width: 100,
  height: 100,
  rotation: 0,
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
  ...(chapterLabel === undefined ? {} : { chapterLabel }),
});

const baseSettings = (): LlmRequestSettings =>
  clampLlmRequestSettings({
    glossary: [term("Senpai", "Upperclassman")],
  });

describe("resolveWorkGlossarySettings", () => {
  it("merges the chapter's work terms over the global glossary without touching the store", () => {
    const work = {
      id: "work-1",
      name: "Naruto",
      chapterLabels: ["Chapter 01"],
      terms: [term("Kunai", "Kunai knife")],
    };
    useWorksStore.setState({ works: [work] });
    const settings = baseSettings();

    const resolved = resolveWorkGlossarySettings(image("Chapter 01"), settings);

    // Work term joined over the global term, in one request-local copy.
    expect(resolved.glossary.map((entry) => entry.source)).toEqual([
      "Kunai",
      "Senpai",
    ]);
    // Persisted store untouched: same records, same identity, same terms.
    expect(useWorksStore.getState().works).toEqual([work]);
    expect(useWorksStore.getState().works[0]).toBe(work);
    // Input settings object not mutated either.
    expect(settings.glossary.map((entry) => entry.source)).toEqual(["Senpai"]);
  });

  it("resolves a chapterless image to the shared direct-images group", () => {
    useWorksStore.setState({
      works: [
        {
          id: "work-direct",
          name: "One-shots",
          chapterLabels: [DIRECT_IMAGES_CHAPTER_ID],
          terms: [term("SFX", "Sound effect")],
        },
      ],
    });

    const resolved = resolveWorkGlossarySettings(image(undefined), baseSettings());

    expect(resolved.glossary.map((entry) => entry.source)).toEqual([
      "SFX",
      "Senpai",
    ]);
  });

  it("returns the input settings untouched when no work matches the chapter", () => {
    useWorksStore.setState({
      works: [
        {
          id: "work-other",
          name: "Other title",
          chapterLabels: ["Chapter 99"],
          terms: [term("Kunai", "Kunai knife")],
        },
      ],
    });
    const settings = baseSettings();

    const resolved = resolveWorkGlossarySettings(image("Chapter 01"), settings);

    expect(resolved).toBe(settings);
  });
});

describe("resolveWorkGlossaryForChapter", () => {
  it("merges the matching work's terms for the chapter label", () => {
    useWorksStore.setState({
      works: [
        {
          id: "work-1",
          name: "Naruto",
          chapterLabels: ["Chapter 01"],
          terms: [term("Kunai", "Kunai knife")],
        },
      ],
    });
    const settings = baseSettings();

    const resolved = resolveWorkGlossaryForChapter("Chapter 01", settings);

    // Chapter-queue sidecar batches send one llm_settings blob per chapter,
    // so this single merge covers the chapter's whole batch.
    expect(resolved.glossary.map((entry) => entry.source)).toEqual([
      "Kunai",
      "Senpai",
    ]);
    // Store and input settings stay untouched (request-local merge).
    expect(useWorksStore.getState().works[0]?.terms).toHaveLength(1);
    expect(settings.glossary.map((entry) => entry.source)).toEqual(["Senpai"]);
  });

  it("falls back to the shared direct-images group for a blank label", () => {
    useWorksStore.setState({
      works: [
        {
          id: "work-direct",
          name: "One-shots",
          chapterLabels: [DIRECT_IMAGES_CHAPTER_ID],
          terms: [term("SFX", "Sound effect")],
        },
      ],
    });

    const resolved = resolveWorkGlossaryForChapter("", baseSettings());

    expect(resolved.glossary.map((entry) => entry.source)).toEqual([
      "SFX",
      "Senpai",
    ]);
  });

  it("returns the input identity for an unknown label", () => {
    useWorksStore.setState({
      works: [
        {
          id: "work-other",
          name: "Other title",
          chapterLabels: ["Chapter 99"],
          terms: [term("Kunai", "Kunai knife")],
        },
      ],
    });
    const settings = baseSettings();

    const resolved = resolveWorkGlossaryForChapter("Chapter 01", settings);

    expect(resolved).toBe(settings);
  });
});
