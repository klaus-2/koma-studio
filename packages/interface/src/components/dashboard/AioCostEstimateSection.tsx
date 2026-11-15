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
  /** Images whose text is already known (typographer session present). */
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
      <div className="koma-aio-cloud-preview__estHead">
        <span>{t('dashboard.aio.costEstimate.title')}</span>
      </div>
      <p className="koma-aio-cloud-preview__estNote">
        {t('dashboard.aio.costEstimate.estimateLabel')}
      </p>
      {estimate.ocrCost !== null && (
        <div className="koma-aio-cloud-preview__costRow">
          <span>{t('dashboard.aio.costEstimate.ocrCost')}</span>
          <span className="koma-aio-cloud-preview__costValue">
            {formatNumber(estimate.ocrCost)}
          </span>
        </div>
      )}
      {estimate.translationCost !== null && (
        <div className="koma-aio-cloud-preview__costRow">
          <span>{t('dashboard.aio.costEstimate.translationCost')}</span>
          <span className="koma-aio-cloud-preview__costValue">
            {formatNumber(estimate.translationCost)}
          </span>
        </div>
      )}
      {estimate.totalCost !== null && (
        <div className="koma-aio-cloud-preview__costRow koma-aio-cloud-preview__costRow--total">
          <span>{t('dashboard.aio.costEstimate.total')}</span>
          <span className="koma-aio-cloud-preview__costValue">
            {formatNumber(estimate.totalCost)}
          </span>
        </div>
      )}
      {!estimate.textVolumeKnown && (
        <div className="koma-aio-cloud-preview__costRow">
          <span>{t('dashboard.aio.costEstimate.rangeLabel')}</span>
          <span className="koma-aio-cloud-preview__costValue">
            {formatNumber(estimate.knownTextCharsRange?.[0] ?? 0)} –{' '}
            {formatNumber(estimate.knownTextCharsRange?.[1] ?? 0)}
          </span>
        </div>
      )}
      <p className="koma-aio-cloud-preview__estNote">
        {t('dashboard.aio.costEstimate.cacheDiscountNote')}
      </p>
      <p className="koma-aio-cloud-preview__estNote">
        {t('dashboard.aio.costEstimate.assumptions')}
      </p>
      {rates.threshold > 0 &&
        estimate.totalCost !== null &&
        estimate.totalCost > rates.threshold && (
          <p role="alert" className="koma-aio-cloud-preview__alert">
            {t('dashboard.aio.costEstimate.thresholdWarning')}
          </p>
        )}
      <div className="koma-aio-cloud-preview__rates">
        <label className="koma-aio-cloud-preview__rateField">
          <span>{t('dashboard.aio.costEstimate.rateOcr')}</span>
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
        </label>
        <label className="koma-aio-cloud-preview__rateField">
          <span>{t('dashboard.aio.costEstimate.rateLlm')}</span>
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
        </label>
        <label className="koma-aio-cloud-preview__rateField">
          <span>{t('dashboard.aio.costEstimate.thresholdSetting')}</span>
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
      </div>
    </section>
  );
}

export const DEFAULT_RATES = DEFAULT_AIO_COST_RATES;
