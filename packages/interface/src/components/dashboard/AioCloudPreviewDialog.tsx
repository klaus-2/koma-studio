import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { getApiConfig } from '@/config/api';
import { useI18n } from '../../i18n';
import {
  DEFAULT_AIO_COST_RATES,
  loadAioCostRates,
  saveAioCostRates,
  type AioCostRateSettings,
} from '@/pages/dashboard/lib/aio-cost-rates';
import { AioCostEstimateSection } from './AioCostEstimateSection';
import {
  skipCloudPreviewForProvider,
  type CloudPreviewGate,
  type RemoteStageDestination,
} from '@/pages/dashboard/lib/aio-cloud-preview';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

interface ListingEntry {
  readonly key: string;
  readonly provider: string;
  readonly defaultApiBase: string | null;
}

const parseOcrListing = (payload: unknown): ListingEntry[] => {
  if (!isRecord(payload)) {
    return [];
  }
  const models = payload['models'];
  if (!Array.isArray(models)) {
    return [];
  }
  const entries: ListingEntry[] = [];
  for (const raw of models) {
    if (!isRecord(raw) || typeof raw['key'] !== 'string') {
      continue;
    }
    entries.push({
      key: raw['key'],
      provider:
        typeof raw['provider'] === 'string' ? raw['provider'] : raw['key'],
      defaultApiBase:
        typeof raw['default_api_base'] === 'string'
          ? raw['default_api_base']
          : null,
    });
  }
  return entries;
};

const parseTranslationListing = (payload: unknown): ListingEntry[] => {
  if (!isRecord(payload)) {
    return [];
  }
  const models = payload['models'];
  if (!Array.isArray(models)) {
    return [];
  }
  const entries: ListingEntry[] = [];
  for (const raw of models) {
    if (!isRecord(raw) || typeof raw['key'] !== 'string') {
      continue;
    }
    if (typeof raw['provider'] !== 'string') {
      continue;
    }
    entries.push({
      key: raw['key'],
      provider: raw['provider'],
      defaultApiBase:
        typeof raw['default_api_base'] === 'string'
          ? raw['default_api_base']
          : null,
    });
  }
  return entries;
};

interface AioCloudPreviewDialogProps {
  readonly gate: CloudPreviewGate;
  readonly imageCount: number;
  readonly imageBytes: number;
  readonly textRegionCount: number;
  readonly knownTextChars: number;
  readonly imagesWithKnownText: number;
  readonly neighborContextEnabled: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const destinationLabel = (
  destination: RemoteStageDestination,
  listings: readonly ListingEntry[],
): { display: string; apiBase: string | null } => {
  if (destination.source === 'custom') {
    return { display: destination.providerLabel, apiBase: destination.apiBase };
  }
  const entry = listings.find((candidate) => candidate.key === destination.modelKey);
  return entry
    ? { display: entry.provider, apiBase: entry.defaultApiBase }
    : { display: destination.providerLabel, apiBase: null };
};

export function AioCloudPreviewDialog({
  gate,
  imageCount,
  imageBytes,
  textRegionCount,
  knownTextChars,
  imagesWithKnownText,
  neighborContextEnabled,
  onConfirm,
  onCancel,
}: AioCloudPreviewDialogProps): JSX.Element {
  const { t } = useI18n();
  const [ocrListings, setOcrListings] = useState<ListingEntry[]>([]);
  const [translationListings, setTranslationListings] = useState<ListingEntry[]>(
    [],
  );
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [rates, setRates] = useState<AioCostRateSettings>(
    DEFAULT_AIO_COST_RATES,
  );

  useEffect(() => {
    setRates(loadAioCostRates());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const base = getApiConfig().localUrl;
      try {
        const ocrResponse = await fetch(`${base}/ocr/models`, { method: 'GET' });
        const translationResponse = await fetch(`${base}/translation/models`, {
          method: 'GET',
        });
        if (cancelled) {
          return;
        }
        if (ocrResponse.ok) {
          setOcrListings(parseOcrListing(await ocrResponse.json()));
        }
        if (translationResponse.ok) {
          setTranslationListings(
            parseTranslationListing(await translationResponse.json()),
          );
        }
      } catch (error) {
        console.error('[aio-cloud-preview] listing fetch failed', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const providers = useMemo(
    () =>
      [gate.ocr?.provider, gate.translation?.provider].filter(
        (provider): provider is string => typeof provider === 'string',
      ),
    [gate.ocr, gate.translation],
  );

  const handleConfirm = (): void => {
    if (dontAskAgain) {
      for (const provider of providers) {
        skipCloudPreviewForProvider(provider);
      }
    }
    onConfirm();
  };

  return (
    <div className="koma-aio-cloud-preview" role="dialog" aria-modal="true">
      <h3>{t('dashboard.aio.cloudPreview.title')}</h3>
      <p className="koma-aio-cloud-preview__desc">
        {t('dashboard.aio.cloudPreview.description')}
      </p>

      {gate.ocr !== null && (
        <section>
          <h4>{t('dashboard.aio.cloudPreview.inventory.ocr')}</h4>
          <p>
            {t('dashboard.aio.cloudPreview.destination')}:{' '}
            {destinationLabel(gate.ocr, ocrListings).display}
            {destinationLabel(gate.ocr, ocrListings).apiBase !== null
              ? ` (${destinationLabel(gate.ocr, ocrListings).apiBase})`
              : ''}
          </p>
          <p>
            {t('dashboard.aio.cloudPreview.inventory.imageCount', {
              count: imageCount,
            })}
          </p>
          <p>
            {t('dashboard.aio.cloudPreview.inventory.imageBytes', {
              bytes: formatNumber(imageBytes),
            })}
          </p>
        </section>
      )}

      {gate.translation !== null && (
        <section>
          <h4>{t('dashboard.aio.cloudPreview.inventory.translation')}</h4>
          <p>
            {t('dashboard.aio.cloudPreview.destination')}:{' '}
            {destinationLabel(gate.translation, translationListings).display}
            {destinationLabel(gate.translation, translationListings).apiBase !==
            null
              ? ` (${destinationLabel(gate.translation, translationListings).apiBase})`
              : ''}
          </p>
          <p>
            {t('dashboard.aio.costEstimate.rangeLabel')} ·{' '}
            {t('dashboard.aio.cloudPreview.inventory.translation')}:{' '}
            {formatNumber(textRegionCount)}
          </p>
        </section>
      )}

      <AioCostEstimateSection
        gate={gate}
        imageCount={imageCount}
        imagesWithKnownText={imagesWithKnownText}
        knownTextChars={knownTextChars}
        neighborContextEnabled={neighborContextEnabled}
        rates={rates}
        onRatesChange={updateRates}
      />

      <label className="koma-aio-cloud-preview__dontask">
        <input
          type="checkbox"
          checked={dontAskAgain}
          onChange={(event) => setDontAskAgain(event.target.checked)}
        />
        {t('dashboard.aio.cloudPreview.dontAskAgain')}
      </label>

      <div className="koma-aio-cloud-preview__actions">
        <button type="button" onClick={handleConfirm}>
          {t('dashboard.aio.cloudPreview.confirm')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('dashboard.aio.cloudPreview.cancel')}
        </button>
      </div>
    </div>
  );

  function updateRates(next: AioCostRateSettings): void {
    setRates(next);
    saveAioCostRates(next);
  }
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export default AioCloudPreviewDialog;
