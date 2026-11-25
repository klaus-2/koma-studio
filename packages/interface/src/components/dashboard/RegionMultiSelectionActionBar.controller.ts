import { useCallback } from 'react';

import { useI18n } from '../../i18n';
import type { useAioRegionSnapshotSync } from '../../pages/dashboard/hooks/region-editor.snapshot';
import type { useTranslatorRetranslate } from '../../pages/dashboard/hooks/translator.execution';
import {
  applyTypographyPresetToRegionIds,
  removeAioRegionsByIds,
} from '../../pages/dashboard/hooks/region-editor';
import { useImageCollectionStore } from '../../pages/dashboard/stores/image-collection-store';
import { useStatusStore } from '../../pages/dashboard/stores/status-store';
import { useTypographerStore } from '../../pages/dashboard/stores/typographer-store';
import { EMPTY_SELECTED_REGION_IDS } from '../../utils/dashboardRenderUtils';

type TranslatorRetranslateApi = ReturnType<typeof useTranslatorRetranslate>;
type AioSnapshotSyncApi = ReturnType<typeof useAioRegionSnapshotSync>;

export interface RegionMultiSelectionActionBarProps {
  retranslateTranslatorRegions: TranslatorRetranslateApi;
  updateAioRegionsForImage: AioSnapshotSyncApi['updateAioRegionsForImage'];
}

export interface RegionMultiSelectionActions {
  readonly activeImageId: string | null;
  readonly selectedRegionIds: readonly string[];
  readonly handleApplyStyle: () => void;
  readonly handleRetranslate: () => void;
  readonly handleClearSelection: () => void;
  readonly handleDelete: () => void;
}

export const useRegionMultiSelectionActions = ({
  retranslateTranslatorRegions,
  updateAioRegionsForImage,
}: RegionMultiSelectionActionBarProps): RegionMultiSelectionActions => {
  const { t } = useI18n();
  const activeId = useImageCollectionStore((s) => s.activeId);
  const selectedRegionIds = useTypographerStore((s) =>
    activeId === null
      ? EMPTY_SELECTED_REGION_IDS
      : (s.typographerMultiSelectedByImage[activeId] ??
        EMPTY_SELECTED_REGION_IDS),
  );
  const setTypographerMultiSelectedByImage = useTypographerStore(
    (s) => s.setTypographerMultiSelectedByImage,
  );
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);

  const handleClearSelection = useCallback((): void => {
    if (activeId === null) return;
    setTypographerMultiSelectedByImage((prev) => {
      const { [activeId]: _removed, ...rest } = prev;
      return rest;
    });
  }, [activeId, setTypographerMultiSelectedByImage]);

  const handleApplyStyle = useCallback((): void => {
    if (activeId === null) return;
    const result = applyTypographyPresetToRegionIds(
      activeId,
      selectedRegionIds,
      updateAioRegionsForImage,
    );
    if (result.kind === 'applied') {
      setTonedStatus(
        t('dashboard.status.presetAppliedToSelection', { name: result.presetName }),
        'success',
      );
    } else if (result.kind === 'no-preset') {
      setTonedStatus(t('typo.multiSelect.noPreset'), 'warning');
    }
  }, [activeId, selectedRegionIds, setTonedStatus, t, updateAioRegionsForImage]);

  const handleRetranslate = useCallback((): void => {
    if (activeId === null) return;
    void retranslateTranslatorRegions(activeId, selectedRegionIds);
  }, [activeId, retranslateTranslatorRegions, selectedRegionIds]);

  const handleDelete = useCallback((): void => {
    if (activeId === null) return;
    const result = removeAioRegionsByIds(
      activeId,
      selectedRegionIds,
      updateAioRegionsForImage,
    );
    if (result.kind === 'removed') {
      setTonedStatus(
        t('typo.multiSelect.regionsRemoved', { count: result.count }),
        'success',
      );
    }
    handleClearSelection();
  }, [activeId, handleClearSelection, selectedRegionIds, setTonedStatus, t, updateAioRegionsForImage]);

  return {
    activeImageId: activeId,
    selectedRegionIds,
    handleApplyStyle,
    handleRetranslate,
    handleClearSelection,
    handleDelete,
  };
};
