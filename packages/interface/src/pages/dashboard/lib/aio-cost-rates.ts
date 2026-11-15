
const RATES_STORAGE_KEY = 'koma.aio.costRates';

export interface AioCostRateSettings {
  ocrPerImage: number;
  translationPer1kTokens: number;
  threshold: number;
  maxOutputTokens: number;
}

export const DEFAULT_AIO_COST_RATES: AioCostRateSettings = {
  ocrPerImage: 0,
  translationPer1kTokens: 0,
  threshold: 0,
  maxOutputTokens: 4096,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonNegativeNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;

export function loadAioCostRates(): AioCostRateSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_AIO_COST_RATES;
  }
  const raw = localStorage.getItem(RATES_STORAGE_KEY);
  if (raw === null) {
    return DEFAULT_AIO_COST_RATES;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return DEFAULT_AIO_COST_RATES;
    }
    return {
      ocrPerImage: asNonNegativeNumber(
        parsed['ocrPerImage'],
        DEFAULT_AIO_COST_RATES.ocrPerImage,
      ),
      translationPer1kTokens: asNonNegativeNumber(
        parsed['translationPer1kTokens'],
        DEFAULT_AIO_COST_RATES.translationPer1kTokens,
      ),
      threshold: asNonNegativeNumber(
        parsed['threshold'],
        DEFAULT_AIO_COST_RATES.threshold,
      ),
      maxOutputTokens: asNonNegativeNumber(
        parsed['maxOutputTokens'],
        DEFAULT_AIO_COST_RATES.maxOutputTokens,
      ),
    };
  } catch (error) {
    console.error('[aio-cost-rates] stored settings unreadable', error);
    return DEFAULT_AIO_COST_RATES;
  }
}

export function saveAioCostRates(settings: AioCostRateSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(settings));
}
