import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_AIO_STAGE_OPTIONS } from "../models/aioStageCatalog";
import {
  AIO_MODEL_PRESET_STORAGE_KEY,
  aioModelPresetStateV2Schema,
  type AioStageKey,
} from "../types/aioModelPresets";
import {
  AIO_DEFAULT_PRESETS_SEEDED_STORAGE_KEY,
  DEFAULT_AIO_MODEL_PRESETS,
  aioDefaultPresetId,
  buildDefaultAioPresetState,
  seedDefaultAioPresets,
} from "./aioModelPresetDefaults";
import { deletePreset, loadPresetState } from "./aioModelPresets";

const MANAGED_MODEL_KEYS = new Set(["nllb-200-1.3b-int8-ct2"]);

const defaultIds = () => DEFAULT_AIO_MODEL_PRESETS.map((preset) => preset.id).sort();

describe("default AIO model presets", () => {
  beforeEach(() => window.localStorage.clear());

  it("passes the strict state schema", () => {
    expect(aioModelPresetStateV2Schema.safeParse(buildDefaultAioPresetState()).success).toBe(true);
  });

  it("ships exactly one active preset per language", () => {
    const state = buildDefaultAioPresetState();
    expect(new Set(state.presets.map((preset) => preset.sourceLanguage)).size).toBe(state.presets.length);
    for (const preset of state.presets) {
      expect(state.activePresetBySourceLanguage[preset.sourceLanguage]).toBe(preset.id);
    }
  });

  it("only references models known to the stage catalog", () => {
    for (const preset of DEFAULT_AIO_MODEL_PRESETS) {
      for (const [stage, model] of Object.entries(preset.stageModels)) {
        const keys = DEFAULT_AIO_STAGE_OPTIONS[stage as AioStageKey].map((option) => option.key);
        expect(keys.includes(model) || MANAGED_MODEL_KEYS.has(model), `${preset.id}.${stage} -> ${model}`).toBe(true);
      }
    }
  });

  it("seeds every default on a fresh install", () => {
    const state = loadPresetState();
    expect(state.presets.map((preset) => preset.id).sort()).toEqual(defaultIds());
    expect(window.localStorage.getItem(AIO_DEFAULT_PRESETS_SEEDED_STORAGE_KEY)).not.toBeNull();
  });

  it("keeps existing user presets and only fills missing languages", () => {
    const japanese = DEFAULT_AIO_MODEL_PRESETS.find((preset) => preset.sourceLanguage === "ja")!;
    const mine = {
      ...japanese,
      id: "user-ja",
      name: "Mine",
      stageModels: { ...japanese.stageModels, recognizeText: "paddleocr" },
      createdAt: 5,
      updatedAt: 5,
    };
    window.localStorage.setItem(
      AIO_MODEL_PRESET_STORAGE_KEY,
      JSON.stringify({ version: 2, presets: [mine], activePresetBySourceLanguage: { ja: "user-ja" } }),
    );
    const state = loadPresetState();
    expect(state.activePresetBySourceLanguage.ja).toBe("user-ja");
    expect(state.presets.some((preset) => preset.id === aioDefaultPresetId("ja"))).toBe(false);
    expect(state.activePresetBySourceLanguage.en).toBe(aioDefaultPresetId("en"));
  });

  it("does not bring back a default the user deleted", () => {
    loadPresetState();
    deletePreset(aioDefaultPresetId("fr"));
    expect(loadPresetState().presets.some((preset) => preset.id === aioDefaultPresetId("fr"))).toBe(false);
  });

  it("is a no-op when every language is already covered", () => {
    const state = buildDefaultAioPresetState();
    expect(seedDefaultAioPresets(state)).toBe(state);
  });
});
