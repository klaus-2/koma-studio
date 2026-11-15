import type { JSX } from 'react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { Cloud, Languages, X } from 'lucide-react';

import { getApiConfig } from '@/config/api';
import { formatBytes } from '@/utils/formatBytes';
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
  readonly anchorEl?: HTMLElement | null;
}

const destinationLabel = (
  destination: RemoteStageDestination,
  listings: readonly ListingEntry[],
): { display: string; apiBase: string | null } => {
  if (destination.source === 'custom') {
    return { display: destination.providerLabel, apiBase: destination.apiBase };
  }
  const entry = listings.find(
    (candidate) => candidate.key === destination.modelKey,
  );
  return entry
    ? { display: entry.provider, apiBase: entry.defaultApiBase }
    : { display: destination.providerLabel, apiBase: null };
};

interface StageRowProps {
  readonly icon: JSX.Element;
  readonly title: string;
  readonly destination: RemoteStageDestination;
  readonly listings: readonly ListingEntry[];
  readonly facts: readonly string[];
  readonly destinationText: string;
  readonly fallbackText: string;
}

function StageRow({
  icon,
  title,
  destination,
  listings,
  facts,
  destinationText,
  fallbackText,
}: StageRowProps): JSX.Element {
  const label = destinationLabel(destination, listings);
  const isGenericCustom =
    destination.source === 'custom' &&
    (label.display === '' || /^[a-z_]+:[0-9a-f]{8}-[0-9a-f]/i.test(label.display));
  const display = isGenericCustom ? fallbackText : label.display;
  return (
    <section className="koma-aio-cloud-preview__stage">
      <div className="koma-aio-cloud-preview__stageHead">
        {icon}
        <span>{title}</span>
      </div>
      <div className="koma-aio-cloud-preview__dest">
        <span className="koma-aio-cloud-preview__destLabel">
          {destinationText}
        </span>
        <span className="koma-aio-cloud-preview__destValue">{display}</span>
      </div>
      {label.apiBase !== null && (
        <div className="koma-aio-cloud-preview__host">{label.apiBase}</div>
      )}
      <div className="koma-aio-cloud-preview__facts">
        {facts.map((fact) => (
          <span key={fact} className="koma-aio-cloud-preview__fact">
            {fact}
          </span>
        ))}
      </div>
    </section>
  );
}

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
  anchorEl = null,
}: AioCloudPreviewDialogProps): JSX.Element {
  const { t } = useI18n();
  const [ocrListings, setOcrListings] = useState<ListingEntry[]>([]);
  const [translationListings, setTranslationListings] = useState<ListingEntry[]>(
    [],
  );
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    bottom: number;
  } | null>(null);
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

  useLayoutEffect(() => {
    const update = (): void => {
      if (anchorEl === null) {
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      setPosition({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + 10,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorEl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const handleConfirm = (): void => {
    if (dontAskAgain) {
      for (const provider of providers) {
        skipCloudPreviewForProvider(provider);
      }
    }
    onConfirm();
  };

  const ocrFacts: string[] = [];
  if (gate.ocr !== null) {
    ocrFacts.push(
      t('dashboard.aio.cloudPreview.inventory.imageCount', {
        count: imageCount,
      }),
    );
    ocrFacts.push(
      t('dashboard.aio.cloudPreview.inventory.imageBytes', {
        bytes: formatBytes(imageBytes),
      }),
    );
  }
  const translationFacts: string[] = [];
  if (gate.translation !== null) {
    translationFacts.push(
      t('dashboard.aio.cloudPreview.inventory.regionCount', {
        count: textRegionCount,
      }),
    );
  }

  const popStyle: Record<string, string | number> =
    position !== null
      ? {
          left: position.left,
          width: position.width,
          bottom: position.bottom,
        }
      : {
          left: '50%',
          width: 'min(420px, 92vw)',
          bottom: 96,
          transform: 'translateX(-50%)',
        };

  return createPortal(
    <div
      className="koma-aio-cloud-preview"
      role="dialog"
      aria-modal="true"
      style={popStyle}
    >
      <div className="koma-aio-cloud-preview__head">
        <span className="koma-aio-cloud-preview__title">
          {t('dashboard.aio.cloudPreview.title')}
        </span>
        <button
          type="button"
          className="koma-aio-cloud-preview__close"
          aria-label={t('dashboard.aio.cloudPreview.close')}
          onClick={onCancel}
        >
          <X size={13} />
        </button>
      </div>
      <p className="koma-aio-cloud-preview__desc">
        {t('dashboard.aio.cloudPreview.description')}
      </p>

      {gate.ocr !== null && (
        <StageRow
          icon={<Cloud size={13} />}
          title={t('dashboard.aio.cloudPreview.inventory.ocr')}
          destination={gate.ocr}
          listings={ocrListings}
          facts={ocrFacts}
          destinationText={t('dashboard.aio.cloudPreview.destination')}
          fallbackText={t('dashboard.aio.cloudPreview.customProvider')}
        />
      )}

      {gate.translation !== null && (
        <StageRow
          icon={<Languages size={13} />}
          title={t('dashboard.aio.cloudPreview.inventory.translation')}
          destination={gate.translation}
          listings={translationListings}
          facts={translationFacts}
          destinationText={t('dashboard.aio.cloudPreview.destination')}
          fallbackText={t('dashboard.aio.cloudPreview.customProvider')}
        />
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
        <button
          type="button"
          className="koma-aio-cloud-preview__start"
          onClick={handleConfirm}
        >
          {t('dashboard.aio.cloudPreview.confirm')}
        </button>
        <button
          type="button"
          className="koma-aio-cloud-preview__cancel"
          onClick={onCancel}
        >
          {t('dashboard.aio.cloudPreview.cancel')}
        </button>
      </div>
    </div>,
    document.body,
  );

  function updateRates(next: AioCostRateSettings): void {
    setRates(next);
    saveAioCostRates(next);
  }
}

export default AioCloudPreviewDialog;
