export type AioStageKey =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage';

export type AioStageSelection = {
  detectText: string;
  recognizeText: string;
  getTranslations: string;
  segmentText: string;
  cleanImage: string;
};

export interface AioLanguageModelPreset {
  id: string;
  name: string;
  description: string;
  sourceLanguage: string;
  stageModels: AioStageSelection;
  createdAt: number;
  updatedAt: number;
}

export interface AioModelPresetStateV2 {
  version: 2;
  presets: AioLanguageModelPreset[];
  activePresetBySourceLanguage: Record<string, string>;
}

export interface CreateAioPresetInput {
  name: string;
  description?: string;
  sourceLanguage: string;
  stageModels: AioStageSelection;
}

export interface UpdateAioPresetInput {
  name?: string;
  description?: string;
  sourceLanguage?: string;
  stageModels?: Partial<AioStageSelection>;
}

type SchemaResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

type Validator<T> = {
  parse(value: unknown): T;
  safeParse(value: unknown): SchemaResult<T>;
};

const STAGE_KEYS: readonly AioStageKey[] = [
  'detectText',
  'recognizeText',
  'getTranslations',
  'segmentText',
  'cleanImage',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const invalid = (message: string): never => {
  throw new Error(message);
};

const parseStageSelection = (value: unknown): AioStageSelection => {
  if (!isRecord(value) || !hasOnlyKeys(value, STAGE_KEYS)) {
    return invalid('Invalid AIO stage selection.');
  }

  const selection = {} as AioStageSelection;
  for (const key of STAGE_KEYS) {
    const stage = value[key];
    if (!isNonEmptyString(stage)) {
      return invalid('Every AIO stage needs a model.');
    }
    selection[key] = stage.trim();
  }
  return selection;
};

const parsePreset = (value: unknown): AioLanguageModelPreset => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'name',
      'description',
      'sourceLanguage',
      'stageModels',
      'createdAt',
      'updatedAt',
    ])
  ) {
    return invalid('Invalid AIO preset.');
  }

  const { id, name, description, sourceLanguage, createdAt, updatedAt } = value;
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(name) ||
    typeof description !== 'string' ||
    !isNonEmptyString(sourceLanguage) ||
    typeof createdAt !== 'number' ||
    !Number.isInteger(createdAt) ||
    createdAt < 0 ||
    typeof updatedAt !== 'number' ||
    !Number.isInteger(updatedAt) ||
    updatedAt < 0
  ) {
    return invalid('Invalid AIO preset.');
  }

  return {
    id: id.trim(),
    name: name.trim(),
    description,
    sourceLanguage: sourceLanguage.trim(),
    stageModels: parseStageSelection(value.stageModels),
    createdAt,
    updatedAt,
  };
};

const parsePresetState = (value: unknown): AioModelPresetStateV2 => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['version', 'presets', 'activePresetBySourceLanguage']) ||
    value.version !== 2 ||
    !Array.isArray(value.presets) ||
    !isRecord(value.activePresetBySourceLanguage)
  ) {
    return invalid('Invalid AIO preset state.');
  }

  const presets = value.presets.map(parsePreset);
  const presetsById = new Map<string, AioLanguageModelPreset>();
  for (const preset of presets) {
    if (presetsById.has(preset.id)) {
      return invalid('Preset IDs must be unique.');
    }
    presetsById.set(preset.id, preset);
  }

  const activePresetBySourceLanguage: Record<string, string> = {};
  for (const [language, presetId] of Object.entries(
    value.activePresetBySourceLanguage,
  )) {
    if (!isNonEmptyString(language) || !isNonEmptyString(presetId)) {
      return invalid('Invalid active preset entry.');
    }
    const preset = presetsById.get(presetId);
    if (!preset || preset.sourceLanguage !== language) {
      return invalid('The active preset must belong to the source language.');
    }
    activePresetBySourceLanguage[language] = presetId;
  }

  return { version: 2, presets, activePresetBySourceLanguage };
};

const parseCreateInput = (value: unknown): CreateAioPresetInput => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['name', 'description', 'sourceLanguage', 'stageModels'])
  ) {
    return invalid('Invalid preset input.');
  }

  if (!isNonEmptyString(value.name) || !isNonEmptyString(value.sourceLanguage)) {
    return invalid('A preset needs a name and a source language.');
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    return invalid('Invalid preset description.');
  }

  return {
    name: value.name.trim(),
    ...(typeof value.description === 'string'
      ? { description: value.description }
      : {}),
    sourceLanguage: value.sourceLanguage.trim(),
    stageModels: parseStageSelection(value.stageModels),
  };
};

const parseUpdateInput = (value: unknown): UpdateAioPresetInput => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['name', 'description', 'sourceLanguage', 'stageModels'])
  ) {
    return invalid('Invalid preset update.');
  }

  const update: UpdateAioPresetInput = {};
  if (value.name !== undefined) {
    if (!isNonEmptyString(value.name)) return invalid('Invalid preset name.');
    update.name = value.name.trim();
  }
  if (value.description !== undefined) {
    if (typeof value.description !== 'string') {
      return invalid('Invalid preset description.');
    }
    update.description = value.description;
  }
  if (value.sourceLanguage !== undefined) {
    if (!isNonEmptyString(value.sourceLanguage)) {
      return invalid('Invalid preset source language.');
    }
    update.sourceLanguage = value.sourceLanguage.trim();
  }
  if (value.stageModels !== undefined) {
    if (!isRecord(value.stageModels)) {
      return invalid('Invalid preset stage models.');
    }
    const partial: Partial<AioStageSelection> = {};
    for (const key of STAGE_KEYS) {
      const stage = value.stageModels[key];
      if (stage === undefined) continue;
      if (!isNonEmptyString(stage)) return invalid('Invalid stage model.');
      partial[key] = stage.trim();
    }
    update.stageModels = partial;
  }

  return update;
};

const createValidator = <T>(parse: (value: unknown) => T): Validator<T> => ({
  parse,
  safeParse(value: unknown): SchemaResult<T> {
    try {
      return { success: true, data: parse(value) };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Invalid value.',
        },
      };
    }
  },
});

export const aioModelPresetStateV2Schema = createValidator(parsePresetState);
export const createAioPresetInputSchema = createValidator(parseCreateInput);
export const updateAioPresetInputSchema = createValidator(parseUpdateInput);

export const AIO_MODEL_PRESET_STORAGE_KEY = 'koma-aio-model-presets-v2';
