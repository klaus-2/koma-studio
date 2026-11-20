import { beforeEach, describe, expect, it } from "vitest";

import { useAioPipelineStore } from "../stores/aio-pipeline-store";
import { useExportStore } from "../stores/export-store";
import { useImageCollectionStore } from "../stores/image-collection-store";
import { useWorksStore } from "../stores/works-store";
import type { LoadedImage } from "../../../types/dashboard.types";
import type { DirectPageFile } from "../../../utils/page-source";
import {
  buildEntryNamingContext,
  resolveBundleFileName,
} from "./export-download";

const pageFile = (name: string): DirectPageFile => {
  const bytes = new Uint8Array([1, 2, 3]);
  const blob = new Blob([bytes], { type: "image/png" });
  return {
    kind: "direct",
    name,
    type: "image/png",
    size: bytes.byteLength,
    lastModified: 0,
    resident: new File([bytes], name, { type: "image/png" }),
    toBlob: async () => blob,
    dimensions: async () => ({ width: 10, height: 10 }),
    release: () => undefined,
  };
};

const image = (id: string, name: string, chapterLabel: string | null): LoadedImage => ({
  id,
  file: pageFile(name),
  url: `blob:${id}`,
  width: 0,
  height: 0,
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
  ...(chapterLabel === null ? {} : { chapterLabel }),
});

const entry = {
  fileName: "koma-studio-typesetter-render.png",
  blob: new Blob([]),
  sourceImageId: "img-1",
};

describe("export-download naming integration (I2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useExportStore.setState({ namingPattern: "", recentNamingPatterns: [] });
    useImageCollectionStore.setState({
      images: [image("img-1", "Página 01.png", "Cap 1")],
      activeId: "img-1",
    });
    useWorksStore.setState({
      works: [
        { id: "w1", name: "Minha Obra", chapterLabels: ["Cap 1"], terms: [] },
      ],
    });
    useAioPipelineStore.setState({ aioTgtLang: "pt-br" });
  });

  it("builds the naming context from the real dashboard stores", () => {
    expect(buildEntryNamingContext(entry, 0, "zip")).toEqual({
      obra: "Minha Obra",
      capitulo: "Cap 1",
      idioma: "pt-br",
      nome: "Página 01",
      pagina: 1,
      ext: "zip",
    });
  });

  it("resolves a custom pattern into the bundle name and records it as recent", () => {
    useExportStore.getState().setNamingPattern("{obra} - {capitulo} - p{pagina}");
    const name = resolveBundleFileName(
      useExportStore.getState().namingPattern,
      entry,
      "typesetter",
      "TIMESTAMP",
      "zip",
    );
    expect(name).toBe("minha-obra-cap-1-p001.zip");
    expect(useExportStore.getState().recentNamingPatterns).toEqual([
      "{obra} - {capitulo} - p{pagina}",
    ]);
  });

  it("keeps the exact legacy bundle name and records nothing for an empty pattern", () => {
    const name = resolveBundleFileName("", entry, "typesetter", "TIMESTAMP", "zip");
    expect(name).toBe("koma-studio-typesetter-TIMESTAMP.zip");
    expect(useExportStore.getState().recentNamingPatterns).toEqual([]);
  });

  it("resolves {idioma}/{nome} through the stores and flattens folders in the bundle", () => {
    useExportStore.getState().setNamingPattern("{obra}/{idioma}/{nome}");
    const name = resolveBundleFileName(
      useExportStore.getState().namingPattern,
      entry,
      "typesetter",
      "TIMESTAMP",
      "zip",
    );
    expect(name).toBe("minha-obra-pt-br-página-01.zip");
  });

  it("falls back to the deterministic token fallback when the page is unlinked", () => {
    useImageCollectionStore.setState({
      images: [image("img-1", "Página 01.png", null)],
    });
    useWorksStore.setState({ works: [] });
    useAioPipelineStore.setState({ aioTgtLang: undefined });
    const context = buildEntryNamingContext(entry, 2, "cbz");
    expect(context.obra).toBeNull();
    expect(context.capitulo).toBeNull();
    expect(context.idioma).toBeNull();
    expect(context.pagina).toBe(3);
    useExportStore.getState().setNamingPattern("{obra}-{capitulo}-{idioma}-{pagina}");
    const name = resolveBundleFileName(
      useExportStore.getState().namingPattern,
      entry,
      "typesetter",
      "TIMESTAMP",
      "cbz",
    );
    // The bundle name always renders the representative (first) page: 001.
    expect(name).toBe("koma-studio-chapter-default-001.cbz");
  });
});
