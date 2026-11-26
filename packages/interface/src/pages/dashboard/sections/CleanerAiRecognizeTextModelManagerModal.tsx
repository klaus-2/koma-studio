import { useCallback, useMemo, type ReactNode } from 'react';

import { useI18n } from '../../../i18n';
import {
  useModelManagerGatedState,
  useModelManagerStatusSnapshot,
  type useModelManager,
} from '../../../hooks/useModelManager';
import { computeBatchProgress } from '../../../models/model-install-reconciliation';
import {
  estimateModelRequiredDiskBytes,
  summarizeInstalledModels,
} from '../../../models/model-storage';
import type { ModelInstallState } from '../../../models/types';
import {
  extractLocalImageEditModelId,
  formatLocalImageEditModelKey,
  getLocalImageEditSpec,
} from '../../../utils/imageEditLocalModels';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useStatusStore } from '../stores/status-store';
import CleanerAiRecognizeTextModelManagerModal from '../../../components/ModelManagerModal/CleanerAiRecognizeTextModelManagerModal';

type ModelManagerApi = ReturnType<typeof useModelManager>;

interface CleanerAiRecognizeTextModelManagerModalSectionProps {
  freeProviderSection: ReactNode;
  customProfilesSection: ReactNode;
  defaultLanguageFilter: string;

  selectCleanerAiModel: (modelKey: string) => void;
  onSetLanguageFilter?: ModelManagerApi['setModalLanguageFilter'];
  onInstallModel?: ModelManagerApi['installModel'];
  onUpdateModel?: ModelManagerApi['updateModel'];
  onUninstallModel?: ModelManagerApi['uninstallModel'];
  onRetryModel?: ModelManagerApi['retryModel'];
  onCancelModel?: ModelManagerApi['cancelModel'];
  onInstallAll?: ModelManagerApi['installAll'];
  onCancelAll?: ModelManagerApi['cancelAll'];
  onCheckUpdatesNow?: ModelManagerApi['refreshRemoteModelUpdates'];
}

export default function CleanerAiRecognizeTextModelManagerModalSection({
  freeProviderSection,
  customProfilesSection,
  defaultLanguageFilter,
  selectCleanerAiModel,
  onSetLanguageFilter,
  onInstallModel,
  onUpdateModel,
  onUninstallModel,
  onRetryModel,
  onCancelModel,
  onInstallAll,
  onCancelAll,
  onCheckUpdatesNow,
}: CleanerAiRecognizeTextModelManagerModalSectionProps) {
  const { t } = useI18n();
  const cleanerAiModelManagerOpen = useCleanerStore(
    (s) => s.cleanerAiModelManagerOpen,
  );
  const setCleanerAiModelManagerOpen = useCleanerStore(
    (s) => s.setCleanerAiModelManagerOpen,
  );
  const target = useCleanerStore((s) => s.imageEditModelManagerTarget);
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const aioCleanAiModelKey = useAioPipelineStore((s) => s.aioCleanAiModelKey);
  const aioAiModelKey = useAioPipelineStore((s) => s.aioAiModelKey);
  const setAioCleanAiModelKey = useAioPipelineStore(
    (s) => s.setAioCleanAiModelKey,
  );
  const setAioAiModelKey = useAioPipelineStore((s) => s.setAioAiModelKey);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const snapshotState = useModelManagerStatusSnapshot();
  const modelManagerState = useModelManagerGatedState(cleanerAiModelManagerOpen);

  const { imageEditSummary, imageEditInstalledSizeBytes } = useMemo(() => {
    const filtered: Record<string, ModelInstallState> = {};
    let installedBytes = 0;
    for (const [id, entry] of Object.entries(snapshotState.entries)) {
      if (entry.model.stage === 'imageEdit') {
        filtered[id] = entry;
        if (entry.status === 'installed' || entry.status === 'update_available') {
          installedBytes += estimateModelRequiredDiskBytes(entry.model);
        }
      }
    }
    return {
      imageEditSummary: summarizeInstalledModels(filtered),
      imageEditInstalledSizeBytes: installedBytes,
    };
  }, [snapshotState.entries]);

  const batchProgress = useMemo(
    () => computeBatchProgress(modelManagerState.batch, modelManagerState.entries),
    [modelManagerState.batch, modelManagerState.entries],
  );

  const rawSelectedModelKey =
    target === 'aio_ai'
      ? aioAiModelKey
      : target === 'aio_clean'
        ? aioCleanAiModelKey
        : cleanerAiModelKey;

  const selectedModelId =
    extractLocalImageEditModelId(rawSelectedModelKey) ?? rawSelectedModelKey;

  const selectionStageLabel =
    target === 'aio_ai'
      ? t('modelManager.stage.aioAi')
      : t('modelManager.stage.automaticAiClean');

  const handleInstallModel = useCallback(
    async (modelId: string) => { await onInstallModel?.(modelId); },
    [onInstallModel],
  );
  const handleUpdateModel = useCallback(
    async (modelId: string) => { await onUpdateModel?.(modelId); },
    [onUpdateModel],
  );
  const handleUninstallModel = useCallback(
    async (modelId: string) => { await onUninstallModel?.(modelId); },
    [onUninstallModel],
  );
  const handleRetryModel = useCallback(
    async (modelId: string) => { await onRetryModel?.(modelId); },
    [onRetryModel],
  );
  const handleCancelModel = useCallback(
    async (modelId: string) => { await onCancelModel?.(modelId); },
    [onCancelModel],
  );
  const handleInstallAll = useCallback(
    async (modelIds?: string[]) => { await onInstallAll?.(modelIds); },
    [onInstallAll],
  );
  const handleCancelAll = useCallback(
    async () => { await onCancelAll?.(); },
    [onCancelAll],
  );
  const handleCheckUpdatesNow = useCallback(
    async () => { await onCheckUpdatesNow?.(); },
    [onCheckUpdatesNow],
  );

  return (
    <CleanerAiRecognizeTextModelManagerModal
      open={cleanerAiModelManagerOpen}
      entries={modelManagerState.entries}
      selectionStageLabel={selectionStageLabel}
      freeProviderSection={freeProviderSection}
      customProfilesSection={customProfilesSection}
      diskSpace={modelManagerState.diskSpace}
      installedCount={imageEditSummary.installedCount}
      totalCount={imageEditSummary.totalCount}
      updatesCount={imageEditSummary.updateCount}
      installedSizeBytes={imageEditInstalledSizeBytes}
      checkingRemoteUpdates={modelManagerState.checkingRemoteUpdates}
      lastRemoteCheckAt={modelManagerState.lastRemoteCheckAt}
      defaultLanguageFilter={defaultLanguageFilter}
      focusedModelId={
        extractLocalImageEditModelId(rawSelectedModelKey) ??
        modelManagerState.focusedModelId
      }
      selectedModelId={selectedModelId}
      batch={batchProgress}
      onClose={() => setCleanerAiModelManagerOpen(false)}
      onSetLanguageFilter={(lang) => onSetLanguageFilter?.(lang)}
      onInstallModel={handleInstallModel}
      onUpdateModel={handleUpdateModel}
      onUninstallModel={handleUninstallModel}
      onRetryModel={handleRetryModel}
      onCancelModel={handleCancelModel}
      onSelectModel={(rawKey) => {
        const localId = extractLocalImageEditModelId(rawKey);
        const modelKey = localId ? formatLocalImageEditModelKey(localId) : rawKey;
        const label = localId ? (getLocalImageEditSpec(localId)?.name ?? modelKey) : modelKey;

        if (target === 'aio_ai') {
          setAioAiModelKey(modelKey);
        } else if (target === 'aio_clean') {
          setAioCleanAiModelKey(modelKey);
        } else {
          selectCleanerAiModel(modelKey);
        }
        setStatusMessage(
          t(
            target === 'aio_ai'
              ? 'dashboard.status.aioAiModelSelected'
              : 'dashboard.status.aiCleanModelSelected',
            { model: label },
          ),
        );
      }}
      onInstallAll={handleInstallAll}
      onCancelAll={handleCancelAll}
      onCheckUpdatesNow={handleCheckUpdatesNow}
    />
  );
}
