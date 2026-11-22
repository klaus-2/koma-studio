import { Copy, Scissors } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { resolveImagePreviewSrc } from '../../hooks/image-collection';
import {
  copyImageBlobToClipboard,
  cropImageBlob,
  hasClipboardImageBridge,
} from '../../lib/clipboard-image';
import { useImageCollectionStore } from '../../stores/image-collection-store';
import { useRegionEditorStore } from '../../stores/region-editor-store';
import { useStatusStore } from '../../stores/status-store';

export default function PageClipboardActions({
  imageId,
}: {
  imageId: string;
}) {
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === 'noir');
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const selectedRegionId = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage[imageId] ?? null,
  );

  if (!hasClipboardImageBridge()) {
    return null;
  }

  const readPageBlob = async (): Promise<Blob> => {
    const image = useImageCollectionStore
      .getState()
      .images.find((item) => item.id === imageId);
    if (!image) {
      throw new Error('The page is no longer in the collection.');
    }
    const src = resolveImagePreviewSrc(image, 'aio');
    if (!src) {
      throw new Error('The page has no rendered preview to copy.');
    }
    return fetch(src).then((response) => {
      if (!response.ok) {
        throw new Error(`Preview fetch failed (${String(response.status)}).`);
      }
      return response.blob();
    });
  };

  const copyPage = (): void => {
    void readPageBlob()
      .then((blob) => copyImageBlobToClipboard(blob))
      .then(() => {
        setTonedStatus(t('dashboard.clipboard.copiedPage'), 'success');
      })
      .catch(() => {
        setTonedStatus(t('dashboard.clipboard.copyFailed'), 'error');
      });
  };

  const copyRegion = (): void => {
    if (!selectedRegionId) {
      return;
    }
    void readPageBlob()
      .then((pageBlob) => {
        const regions =
          useRegionEditorStore.getState().aioDetectionsByImage[imageId] ?? [];
        const region = regions.find((item) => item.id === selectedRegionId);
        if (!region) {
          throw new Error('The selected region is no longer available.');
        }
        return cropImageBlob(pageBlob, region.bbox);
      })
      .then((regionBlob) => copyImageBlobToClipboard(regionBlob))
      .then(() => {
        setTonedStatus(t('dashboard.clipboard.copiedRegion'), 'success');
      })
      .catch(() => {
        setTonedStatus(t('dashboard.clipboard.copyFailed'), 'error');
      });
  };

  const pageLabel = t('dashboard.clipboard.copyPage');
  const regionLabel = t('dashboard.clipboard.copyRegion');

  if (noir) {
    return (
      <>
        <button
          type="button"
          onClick={copyPage}
          title={pageLabel}
          aria-label={pageLabel}
          className="panel-cut-sm grid h-6 w-6 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink"
        >
          <Copy size={11} aria-hidden="true" />
        </button>
        {selectedRegionId !== null && (
          <button
            type="button"
            onClick={copyRegion}
            title={regionLabel}
            aria-label={regionLabel}
            className="panel-cut-sm grid h-6 w-6 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink"
          >
            <Scissors size={11} aria-hidden="true" />
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={copyPage}
        title={pageLabel}
        aria-label={pageLabel}
        className="koma-iconbtn koma-iconbtn--xs koma-preview-card__historyBtn"
      >
        <Copy size={11} aria-hidden="true" />
      </button>
      {selectedRegionId !== null && (
        <button
          type="button"
          onClick={copyRegion}
          title={regionLabel}
          aria-label={regionLabel}
          className="koma-iconbtn koma-iconbtn--xs koma-preview-card__historyBtn"
        >
          <Scissors size={11} aria-hidden="true" />
        </button>
      )}
    </>
  );
}
