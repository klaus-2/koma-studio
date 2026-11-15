
export const PROMPT_OVERHEAD_CHARS_PER_IMAGE = 800;

export const NEIGHBOR_MAX_CHARS_PER_PAGE = 2 * 800;

export const UNKNOWN_TEXT_CHARS_PER_PAGE_LOW = 600;
export const UNKNOWN_TEXT_CHARS_PER_PAGE_HIGH = 2400;

export const LLM_MAX_OUTPUT_TOKENS = 4096;

export interface CostEstimateRates {
  readonly ocrPerImage: number;
  readonly translationPer1kTokens: number;
}

export interface CostEstimateInput {
  readonly imageCount: number;
  readonly imagesWithKnownText: number;
  readonly knownTextChars: number;
  readonly rates: CostEstimateRates;
  readonly neighborContextEnabled: boolean;
  readonly maxOutputTokens: number;
  readonly cloudOcrSelected: boolean;
  readonly cloudTranslationSelected: boolean;
}

export interface CostEstimateResult {
  readonly ocrCost: number | null;
  readonly translationCost: number | null;
  readonly totalCost: number | null;
  readonly translationInputTokens: number;
  readonly translationOutputTokens: number;
  readonly textVolumeKnown: boolean;
  readonly knownTextCharsRange: readonly [number, number] | null;
}

const clampPositive = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

export function estimateAioBatchCost(
  input: CostEstimateInput,
): CostEstimateResult {
  const imageCount = clampPositive(input.imageCount);
  const knownImages = Math.min(
    clampPositive(input.imagesWithKnownText),
    imageCount,
  );
  const unknownImages = imageCount - knownImages;

  const knownChars = clampPositive(input.knownTextChars);
  const lowChars =
    knownChars +
    unknownImages * UNKNOWN_TEXT_CHARS_PER_PAGE_LOW +
    imageCount * PROMPT_OVERHEAD_CHARS_PER_IMAGE +
    (input.neighborContextEnabled
      ? imageCount * NEIGHBOR_MAX_CHARS_PER_PAGE
      : 0);
  const highChars =
    knownChars +
    unknownImages * UNKNOWN_TEXT_CHARS_PER_PAGE_HIGH +
    imageCount * PROMPT_OVERHEAD_CHARS_PER_IMAGE +
    (input.neighborContextEnabled
      ? imageCount * NEIGHBOR_MAX_CHARS_PER_PAGE
      : 0);

  const lowInputTokens = Math.ceil(lowChars / 4);
  const highInputTokens = Math.ceil(highChars / 4);
  const outputPerImage = Math.min(
    LLM_MAX_OUTPUT_TOKENS,
    Math.max(1, Math.round(clampPositive(input.maxOutputTokens) || LLM_MAX_OUTPUT_TOKENS)),
  );

  const ocrCost = input.cloudOcrSelected
    ? clampPositive(input.rates.ocrPerImage) * imageCount
    : null;
  const translationLow =
    (lowInputTokens + outputPerImage * imageCount) / 1000;
  const translationHigh =
    (highInputTokens + outputPerImage * imageCount) / 1000;
  const translationCost = input.cloudTranslationSelected
    ? clampPositive(input.rates.translationPer1kTokens) *
      ((translationLow + translationHigh) / 2)
    : null;
  const totalCost =
    ocrCost === null && translationCost === null
      ? null
      : (ocrCost ?? 0) + (translationCost ?? 0);

  return {
    ocrCost,
    translationCost,
    totalCost,
    translationInputTokens: Math.round((lowInputTokens + highInputTokens) / 2),
    translationOutputTokens: outputPerImage * imageCount,
    textVolumeKnown: unknownImages === 0,
    knownTextCharsRange:
      unknownImages === 0 ? null : ([lowChars, highChars] as const),
  };
}
