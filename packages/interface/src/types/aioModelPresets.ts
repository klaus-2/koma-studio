import { z } from 'zod';

export const aioStageKeySchema = z.enum([
  'detectText',
  'recognizeText',
  'getTranslations',
  'segmentText',
  'cleanImage',
]);

const nonEmptyStringSchema = z.string().trim().min(1);

export const aioStageSelectionSchema = z
  .object({
    detectText: nonEmptyStringSchema,
    recognizeText: nonEmptyStringSchema,
    getTranslations: nonEmptyStringSchema,
    segmentText: nonEmptyStringSchema,
    cleanImage: nonEmptyStringSchema,
  })
  .strict();

export const aioLanguageModelPresetSchema = z
  .object({
    id: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    description: z.string(),
    sourceLanguage: nonEmptyStringSchema,
    stageModels: aioStageSelectionSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

export const aioModelPresetStateV2Schema = z
  .object({
    version: z.literal(2),
    presets: z.array(aioLanguageModelPresetSchema),
    activePresetBySourceLanguage: z.record(
      nonEmptyStringSchema,
      nonEmptyStringSchema,
    ),
  })
  .strict()
  .superRefine((state, context) => {
    const presetsById = new Map(
      state.presets.map((preset) => [preset.id, preset]),
    );

    if (presetsById.size !== state.presets.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['presets'],
        message: 'Preset IDs must be unique.',
      });
    }

    for (const [language, presetId] of Object.entries(
      state.activePresetBySourceLanguage,
    )) {
      const preset = presetsById.get(presetId);

      if (!preset || preset.sourceLanguage !== language) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activePresetBySourceLanguage', language],
          message: 'The active preset must belong to the source language.',
        });
      }
    }
  });

export const createAioPresetInputSchema = z
  .object({
    name: nonEmptyStringSchema,
    description: z.string().optional(),
    sourceLanguage: nonEmptyStringSchema,
    stageModels: aioStageSelectionSchema,
  })
  .strict();

export const updateAioPresetInputSchema = z
  .object({
    name: nonEmptyStringSchema.optional(),
    description: z.string().optional(),
    sourceLanguage: nonEmptyStringSchema.optional(),
    stageModels: aioStageSelectionSchema.partial().optional(),
  })
  .strict();

export type AioStageKey = z.infer<typeof aioStageKeySchema>;
export type AioStageSelection = z.infer<typeof aioStageSelectionSchema>;

export type AioLanguageModelPreset = z.infer<
  typeof aioLanguageModelPresetSchema
>;

export type AioModelPresetStateV2 = z.infer<
  typeof aioModelPresetStateV2Schema
>;

export type CreateAioPresetInput = z.infer<
  typeof createAioPresetInputSchema
>;

export type UpdateAioPresetInput = z.infer<
  typeof updateAioPresetInputSchema
>;

export const AIO_MODEL_PRESET_STORAGE_KEY = 'koma-aio-model-presets-v2';
