import { useMemo } from 'react';
import type { JSX } from 'react';

import { useI18n } from '../../i18n';
import {
  estimateAioBatchCost,
  LLM_MAX_OUTPUT_TOKENS,
} from '@/pages/dashboard/lib/aio-cost-estimate';
import {
  DEFAULT_AIO_COST_RATES,
  type AioCostRateSettings,
} from '@/pages/dashboard/lib/aio-cost-rates';
import type { CloudPreviewGate } from '@/pages/dashboard/lib/aio-cloud-preview';

interface AioCostEstimateSectionProps {
  readonly gate: CloudPreviewGate;
  readonly imageCount: number;
  readonly imagesWithKnownText: number;
  readonly knownTextChars: number;
  readonly neighborContextEnabled: boolean;
  readonly rates: AioCostRateSettings;
  readonly onRatesChange: (next: AioCostRateSettings) => void;
}

const formatNumber = (value: number): string =>
  String(Math.round(value * 100) / 100);

export function AioCostEstimateSection({
  gate,
  imageCount,
  imagesWithKnownText,
  knownTextChars,
  neighborContextEnabled,
  rates,
  onRatesChange,
}: AioCostEstimateSectionProps): JSX.Element {
  const { t } = useI18n();

  const estimate = useMemo(
    () =>
      estimateAioBatchCost({
        imageCount,
        imagesWithKnownText,
        knownTextChars,
        rates: {
          ocrPerImage: rates.ocrPerImage,
          translationPer1kTokens: rates.translationPer1kTokens,
        },
        neighborContextEnabled,
        maxOutputTokens: Math.min(rates.maxOutputTokens, LLM_MAX_OUTPUT_TOKENS),
        cloudOcrSelected: gate.ocr !== null,
        cloudTranslationSelected: gate.translation !== null,
      }),
    [
      gate.ocr,
      gate.translation,
      imageCount,
      imagesWithKnownText,
      knownTextChars,
      neighborContextEnabled,
      rates,
    ],
  );

  return (
    <section className="koma-aio-cloud-preview__estimate">
      <h4>{t('dashboard.aio.costEstimate.title')}</h4>
      <p>{t('dashboard.aio.costEstimate.estimateLabel')}</p>
      {estimate.ocrCost !== null && (
        <p>
          {t('dashboard.aio.costEstimate.ocrCost')}:{' '}
          {formatNumber(estimate.ocrCost)}
        </p>
      )}
      {estimate.translationCost !== null && (
        <p>
          {t('dashboard.aio.costEstimate.translationCost')}:{' '}
          {formatNumber(estimate.translationCost)}
        </p>
      )}
      {estimate.totalCost !== null && (
        <p>
          {t('dashboard.aio.costEstimate.total')}:{' '}
          {formatNumber(estimate.totalCost)}
        </p>
      )}
      {!estimate.textVolumeKnown && (
        <p>
          {t('dashboard.aio.costEstimate.rangeLabel')}:{' '}
          {formatNumber(estimate.knownTextCharsRange?.[0] ?? 0)} –{' '}
          {formatNumber(estimate.knownTextCharsRange?.[1] ?? 0)}
        </p>
      )}
      <p>{t('dashboard.aio.costEstimate.cacheDiscountNote')}</p>
      <p>{t('dashboard.aio.costEstimate.assumptions')}</p>
      {rates.threshold > 0 &&
        estimate.totalCost !== null &&
        estimate.totalCost > rates.threshold && (
          <p role="alert">{t('dashboard.aio.costEstimate.thresholdWarning')}</p>
        )}
      <label>
        {t('dashboard.aio.costEstimate.ratesSetting')} — OCR:{' '}
        <input
          type="number"
          min={0}
          step="any"
          value={rates.ocrPerImage}
          onChange={(event) =>
            onRatesChange({
              ...rates,
              ocrPerImage: Number(event.target.value) || 0,
            })
          }
        />
        {' · '}LLM:{' '}
        <input
          type="number"
          min={0}
          step="any"
          value={rates.translationPer1kTokens}
          onChange={(event) =>
            onRatesChange({
              ...rates,
              translationPer1kTokens: Number(event.target.value) || 0,
            })
          }
        />
        {' · '}
        {t('dashboard.aio.costEstimate.thresholdSetting')}:{' '}
        <input
          type="number"
          min={0}
          step="any"
          value={rates.threshold}
          onChange={(event) =>
            onRatesChange({
              ...rates,
              threshold: Number(event.target.value) || 0,
            })
          }
        />
      </label>
    </section>
  );
}

export const DEFAULT_RATES = DEFAULT_AIO_COST_RATES;
