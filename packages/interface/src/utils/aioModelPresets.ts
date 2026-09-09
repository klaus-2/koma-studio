import {
  AIO_MODEL_PRESET_STORAGE_KEY,
  type AioLanguageModelPreset,
  type AioModelPresetStateV2,
  type AioStageKey,
  type AioStageSelection,
  type CreateAioPresetInput,
  type UpdateAioPresetInput,
} from "../types/aioModelPresets";

const AIO_STAGE_KEYS: AioStageKey[] = [
  "detectText",
  "recognizeText",
  "getTranslations",
  "segmentText",
  "cleanImage",
];

const EMPTY_STAGE_SELECTION: AioStageSelection = {
  detectText: "",
  recognizeText: "",
  getTranslations: "",
  segmentText: "",
  cleanImage: "",
};

const DEFAULT_STATE: AioModelPresetStateV2 = {
  version: 2,
  presets: [],
  activePresetBySourceLanguage: {},
};

const normalizeLanguage = (value: string | null | undefined): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const sanitizeText = (value: string | null | undefined, fallback = ""): string => {
  const nextValue = String(value ?? "").trim();
  return nextValue || fallback;
};

const sanitizeStageSelection = (
  stageModels: Partial<Record<AioStageKey, unknown>> | null | undefined,
): AioStageSelection => {
  const normalized = { ...EMPTY_STAGE_SELECTION };
  AIO_STAGE_KEYS.forEach((stage) => {
    const rawValue = stageModels?.[stage];
    normalized[stage] = sanitizeText(typeof rawValue === "string" ? rawValue : "");
  });
  return normalized;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const parsePreset = (value: unknown): AioLanguageModelPreset | null => {
  if (!isRecord(value)) return null;

  const id = sanitizeText(typeof value.id === "string" ? value.id : "");
  const name = sanitizeText(typeof value.name === "string" ? value.name : "");
  const sourceLanguage = normalizeLanguage(typeof value.sourceLanguage === "string" ? value.sourceLanguage : "");
  if (!id || !name || !sourceLanguage) {
    return null;
  }

  const description = sanitizeText(typeof value.description === "string" ? value.description : "");
  const createdAt = Number(value.createdAt);
  const updatedAt = Number(value.updatedAt);
  const now = Date.now();

  return {
    id,
    name,
    description,
    sourceLanguage,
    stageModels: sanitizeStageSelection(isRecord(value.stageModels) ? (value.stageModels as Partial<Record<AioStageKey, unknown>>) : undefined),
    createdAt: Number.isFinite(createdAt) ? createdAt : now,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : now,
  };
};

const sortPresets = (presets: AioLanguageModelPreset[]): AioLanguageModelPreset[] =>
  [...presets].sort((a, b) => {
    if (a.sourceLanguage !== b.sourceLanguage) {
      return a.sourceLanguage.localeCompare(b.sourceLanguage);
    }
    return a.name.localeCompare(b.name);
  });

const sanitizeState = (value: unknown): AioModelPresetStateV2 => {
  if (!isRecord(value) || Number(value.version) !== 2) {
    return { ...DEFAULT_STATE };
  }

  const presets = Array.isArray(value.presets)
    ? value.presets.map((preset) => parsePreset(preset)).filter((preset): preset is AioLanguageModelPreset => Boolean(preset))
    : [];
  const presetsById = new Set(presets.map((preset) => preset.id));

  const activeRaw = isRecord(value.activePresetBySourceLanguage)
    ? value.activePresetBySourceLanguage
    : {};
  const activePresetBySourceLanguage = Object.entries(activeRaw).reduce<Record<string, string>>((acc, [language, presetId]) => {
    const normalizedLanguage = normalizeLanguage(language);
    const normalizedPresetId = sanitizeText(typeof presetId === "string" ? presetId : "");
    if (!normalizedLanguage || !normalizedPresetId || !presetsById.has(normalizedPresetId)) {
      return acc;
    }
    acc[normalizedLanguage] = normalizedPresetId;
    return acc;
  }, {});

  return {
    version: 2,
    presets: sortPresets(presets),
    activePresetBySourceLanguage,
  };
};

const persistState = (state: AioModelPresetStateV2): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AIO_MODEL_PRESET_STORAGE_KEY, JSON.stringify(state));
};

const createId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const loadPresetState = (): AioModelPresetStateV2 => {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  return sanitizeState(parseJson<unknown>(window.localStorage.getItem(AIO_MODEL_PRESET_STORAGE_KEY), DEFAULT_STATE));
};

export const savePresetState = (state: AioModelPresetStateV2): AioModelPresetStateV2 => {
  const normalizedState = sanitizeState(state);
  persistState(normalizedState);
  return normalizedState;
};





export const createPreset = (
  input: CreateAioPresetInput,
  state: AioModelPresetStateV2 = loadPresetState(),
): { state: AioModelPresetStateV2; preset: AioLanguageModelPreset } => {
  const now = Date.now();
  const preset: AioLanguageModelPreset = {
    id: createId(),
    name: sanitizeText(input.name, "Preset"),
    description: sanitizeText(input.description ?? ""),
    sourceLanguage: normalizeLanguage(input.sourceLanguage),
    stageModels: sanitizeStageSelection(input.stageModels),
    createdAt: now,
    updatedAt: now,
  };
  const nextState = savePresetState({
    ...state,
    presets: sortPresets([...state.presets, preset]),
  });
  return { state: nextState, preset };
};

export const updatePreset = (
  presetId: string,
  patch: UpdateAioPresetInput,
  state: AioModelPresetStateV2 = loadPresetState(),
): { state: AioModelPresetStateV2; preset: AioLanguageModelPreset | null } => {
  const normalizedPresetId = sanitizeText(presetId);
  if (!normalizedPresetId) return { state, preset: null };

  let updatedPreset: AioLanguageModelPreset | null = null;
  const nextPresets = state.presets.map((preset) => {
    if (preset.id !== normalizedPresetId) {
      return preset;
    }
    const nextPreset: AioLanguageModelPreset = {
      ...preset,
      name: patch.name ? sanitizeText(patch.name, preset.name) : preset.name,
      description: patch.description !== undefined ? sanitizeText(patch.description) : preset.description,
      sourceLanguage: patch.sourceLanguage ? normalizeLanguage(patch.sourceLanguage) : preset.sourceLanguage,
      stageModels: patch.stageModels
        ? sanitizeStageSelection({ ...preset.stageModels, ...patch.stageModels })
        : preset.stageModels,
      updatedAt: Date.now(),
    };
    updatedPreset = nextPreset;
    return nextPreset;
  });

  if (!updatedPreset) return { state, preset: null };

  const nextActiveByLanguage = { ...state.activePresetBySourceLanguage };
  Object.keys(nextActiveByLanguage).forEach((language) => {
    if (nextActiveByLanguage[language] === normalizedPresetId && language !== updatedPreset!.sourceLanguage) {
      delete nextActiveByLanguage[language];
    }
  });

  const nextState = savePresetState({
    ...state,
    presets: sortPresets(nextPresets),
    activePresetBySourceLanguage: nextActiveByLanguage,
  });
  return { state: nextState, preset: updatedPreset };
};

export const deletePreset = (
  presetId: string,
  state: AioModelPresetStateV2 = loadPresetState(),
): AioModelPresetStateV2 => {
  const normalizedPresetId = sanitizeText(presetId);
  if (!normalizedPresetId) return state;

  const nextPresets = state.presets.filter((preset) => preset.id !== normalizedPresetId);
  const nextActiveByLanguage = Object.entries(state.activePresetBySourceLanguage).reduce<Record<string, string>>(
    (acc, [language, activePresetId]) => {
      if (activePresetId !== normalizedPresetId) {
        acc[language] = activePresetId;
      }
      return acc;
    },
    {},
  );

  return savePresetState({
    ...state,
    presets: sortPresets(nextPresets),
    activePresetBySourceLanguage: nextActiveByLanguage,
  });
};

export const setActivePresetForLanguage = (
  sourceLanguage: string,
  presetId: string | null,
  state: AioModelPresetStateV2 = loadPresetState(),
): AioModelPresetStateV2 => {
  const normalizedLanguage = normalizeLanguage(sourceLanguage);
  if (!normalizedLanguage) {
    return state;
  }

  const nextActiveByLanguage = { ...state.activePresetBySourceLanguage };
  if (!presetId) {
    delete nextActiveByLanguage[normalizedLanguage];
  } else {
    const normalizedPresetId = sanitizeText(presetId);
    if (!normalizedPresetId) {
      delete nextActiveByLanguage[normalizedLanguage];
    } else {
      const preset = state.presets.find((item) => item.id === normalizedPresetId);
      if (!preset || preset.sourceLanguage !== normalizedLanguage) {
        return state;
      }
      nextActiveByLanguage[normalizedLanguage] = normalizedPresetId;
    }
  }

  return savePresetState({
    ...state,
    activePresetBySourceLanguage: nextActiveByLanguage,
  });
};

export const getActivePresetForLanguage = (
  sourceLanguage: string,
  state: AioModelPresetStateV2 = loadPresetState(),
): AioLanguageModelPreset | null => {
  const normalizedLanguage = normalizeLanguage(sourceLanguage);
  if (!normalizedLanguage) return null;
  const activePresetId = state.activePresetBySourceLanguage[normalizedLanguage];
  if (!activePresetId) return null;
  return state.presets.find((preset) => preset.id === activePresetId) ?? null;
};

export interface PresetApplyResult {
  selection: AioStageSelection;
  unappliedStages: AioStageKey[];
}

type StageAvailabilityMap = Record<AioStageKey, readonly string[] | Set<string>>;

const isModelAvailableForStage = (
  stage: AioStageKey,
  modelId: string,
  stageAvailability: StageAvailabilityMap,
): boolean => {
  const availableForStage = stageAvailability[stage];
  if (availableForStage instanceof Set) {
    return availableForStage.has(modelId);
  }
  return availableForStage.includes(modelId);
};

export const applyPresetToStageSelection = (
  preset: AioLanguageModelPreset,
  currentSelection: AioStageSelection,
  stageAvailability: StageAvailabilityMap,
): PresetApplyResult => {
  const nextSelection: AioStageSelection = { ...currentSelection };
  const unappliedStages: AioStageKey[] = [];

  AIO_STAGE_KEYS.forEach((stage) => {
    const presetModel = sanitizeText(preset.stageModels[stage]);
    if (!presetModel) {
      unappliedStages.push(stage);
      return;
    }
    if (!isModelAvailableForStage(stage, presetModel, stageAvailability)) {
      unappliedStages.push(stage);
      return;
    }
    nextSelection[stage] = presetModel;
  });

  return {
    selection: nextSelection,
    unappliedStages,
  };
};
