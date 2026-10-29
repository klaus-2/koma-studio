import { TranslationModelManagerModal } from '../ModelManagerModal/TranslationModelManagerModal';
import { DetectTextModelManagerModal } from '../ModelManagerModal/DetectTextModelManagerModal';
import { RecognizeTextModelManagerModal } from '../ModelManagerModal/RecognizeTextModelManagerModal';
import { SegmentTextModelManagerModal } from '../ModelManagerModal/SegmentTextModelManagerModal';
import { CleanImageModelManagerModal } from '../ModelManagerModal/CleanImageModelManagerModal';
import { EnhanceImageModelManagerModal } from '../ModelManagerModal/EnhanceImageModelManagerModal';
import { useCallback, useMemo, useRef } from 'react';
import { useI18n } from '../../i18n';
import { getAioStageLabels } from '../../constants/dashboard.constants';
import {
  computeInstallAllSummary,
  useModelManagerGatedState,
  useModelManagerStatusSnapshot,
} from '../../hooks/useModelManager';
import { summarizeInstalledModels } from '../../models/model-storage';

import type { AioStageKey, AioStageSelection } from '../../types/aioModelPresets';
import type { AioStageOption, AioStageOptionMap } from '../../models/aioStageCatalog';

interface DashboardModelManagersProps {
  activeModelManagerStage: AioStageKey;
  aioSrcLang: string;
  aioStageSelection: AioStageSelection;
  aioStageOptions: AioStageOptionMap;
  aioOcrStageOptions: readonly AioStageOption[];
  translationFreeProviderManagerSection: React.ReactNode;
  ocrFreeProviderManagerSection: React.ReactNode;
  translationCustomProfilesManagerSection: React.ReactNode;
  ocrCustomProfilesManagerSection: React.ReactNode;
  closeModelManagerForStage: () => void;
  setModelModalLanguageFilter: (language: string) => void;
  installTranslationModel: (modelId: string) => Promise<unknown> | void;
  updateTranslationModel: (modelId: string) => Promise<unknown> | void;
  uninstallTranslationModel: (modelId: string) => Promise<unknown> | void;
  retryTranslationModel: (modelId: string) => Promise<unknown> | void;
  cancelTranslationModel: (modelId: string) => Promise<unknown> | void;
  installAllTranslationModels: (modelIds?: string[]) => Promise<unknown> | void;
  cancelAllTranslationModels: () => Promise<unknown> | void;
  checkModelUpdatesNow: () => Promise<unknown> | void;
  setAioStageSelection: React.Dispatch<React.SetStateAction<AioStageSelection>>;
  selectAioRecognizeTextModel: (modelKey: string) => void;
  setStatusMessage: (message: string) => void;
  enhanceModelManagerOpen: boolean;
  setEnhanceModelManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  enhanceModelId: string;
  setEnhanceModelId: React.Dispatch<React.SetStateAction<string>>;
  importOnnxModelFromStorage: (model: any) => Promise<unknown>;
  refreshModelState: () => Promise<unknown>;
}

const useModelManagerSummaries = (enhanceModelManagerOpen: boolean) => {
  // Status snapshot drives the summaries and the closed-modal render; the
  // gated subscription goes live (progress ticks) only while a modal is open.
  const snapshotState = useModelManagerStatusSnapshot();
  const modelManagerState = useModelManagerGatedState(
    snapshotState.modalOpen || enhanceModelManagerOpen,
  );
  const modelSummary = useMemo(
    () => summarizeInstalledModels(snapshotState.entries),
    [snapshotState.entries],
  );
  const installAllSummary = useMemo(
    () => computeInstallAllSummary(snapshotState.entries),
    [snapshotState.entries],
  );
  return { modelManagerState, modelSummary, installAllSummary };
};

export default function DashboardModelManagers({
  activeModelManagerStage,
  aioSrcLang,
  aioStageSelection,
  aioStageOptions,
  aioOcrStageOptions,
  translationFreeProviderManagerSection,
  ocrFreeProviderManagerSection,
  translationCustomProfilesManagerSection,
  ocrCustomProfilesManagerSection,
  closeModelManagerForStage,
  setModelModalLanguageFilter,
  installTranslationModel,
  updateTranslationModel,
  uninstallTranslationModel,
  retryTranslationModel,
  cancelTranslationModel,
  installAllTranslationModels,
  cancelAllTranslationModels,
  checkModelUpdatesNow,
  setAioStageSelection,
  selectAioRecognizeTextModel,
  setStatusMessage,
  enhanceModelManagerOpen,
  setEnhanceModelManagerOpen,
  enhanceModelId,
  setEnhanceModelId,
  importOnnxModelFromStorage,
  refreshModelState,
}: DashboardModelManagersProps) {
  const { t } = useI18n();
  const { modelManagerState, modelSummary, installAllSummary } =
    useModelManagerSummaries(enhanceModelManagerOpen);
  const aioStageLabels = useMemo(() => getAioStageLabels(t), [t]);

  const openedOnceRef = useRef({
    getTranslations: false,
    detectText: false,
    recognizeText: false,
    segmentText: false,
    cleanImage: false,
    enhance: false,
  });
  if (modelManagerState.modalOpen) {
    openedOnceRef.current[activeModelManagerStage] = true;
  }
  if (enhanceModelManagerOpen) {
    openedOnceRef.current.enhance = true;
  }
  const openedOnce = openedOnceRef.current;

  // Resolve the catalog option for a (stage, modelKey) pair so the status
  // message shows the human-readable model name (e.g. "GLM-OCR ONNX") instead
  // of the technical id (e.g. "glm_ocr_onnx").
  const getAioStageOption = useCallback(
    (stage: AioStageKey, modelKey: string): AioStageOption | null => {
      if (stage === 'recognizeText') {
        return (
          aioOcrStageOptions.find((option) => option.key === modelKey) ??
          aioStageOptions.recognizeText.find((option) => option.key === modelKey) ??
          null
        );
      }
      return aioStageOptions[stage].find((option) => option.key === modelKey) ?? null;
    },
    [aioOcrStageOptions, aioStageOptions],
  );
  const modelLabelFor = useCallback(
    (stage: AioStageKey, modelKey: string): string => {
      return getAioStageOption(stage, modelKey)?.name ?? modelKey;
    },
    [getAioStageOption],
  );

  // Stable modal handlers: memoized cards must see identical callback props
  // across download-progress re-renders to bail out.
  const handleInstallModel = useCallback(
    async (modelId: string) => { await installTranslationModel(modelId); },
    [installTranslationModel],
  );
  const handleUpdateModel = useCallback(
    async (modelId: string) => { await updateTranslationModel(modelId); },
    [updateTranslationModel],
  );
  const handleUninstallModel = useCallback(
    async (modelId: string) => { await uninstallTranslationModel(modelId); },
    [uninstallTranslationModel],
  );
  const handleRetryModel = useCallback(
    async (modelId: string) => { await retryTranslationModel(modelId); },
    [retryTranslationModel],
  );
  const handleCancelModel = useCallback(
    async (modelId: string) => { await cancelTranslationModel(modelId); },
    [cancelTranslationModel],
  );
  const handleInstallAll = useCallback(
    async (modelIds?: string[]) => { await installAllTranslationModels(modelIds); },
    [installAllTranslationModels],
  );
  const handleCancelAll = useCallback(
    async () => { await cancelAllTranslationModels(); },
    [cancelAllTranslationModels],
  );
  const handleCheckUpdatesNow = useCallback(
    async () => { await checkModelUpdatesNow(); },
    [checkModelUpdatesNow],
  );
  const handleSelectTranslationModel = useCallback(
    (modelKey: string) => {
      setAioStageSelection((prev) => ({ ...prev, getTranslations: modelKey }));
      setStatusMessage(
        t('dashboard.status.modelSelected', {
          stage: aioStageLabels.getTranslations,
          model: modelLabelFor('getTranslations', modelKey),
        }),
      );
    },
    [setAioStageSelection, setStatusMessage, t, aioStageLabels, modelLabelFor],
  );
  const handleSelectDetectModel = useCallback(
    (modelKey: string) => {
      setAioStageSelection((prev) => ({ ...prev, detectText: modelKey }));
      setStatusMessage(
        t('dashboard.status.modelSelected', {
          stage: aioStageLabels.detectText,
          model: modelLabelFor('detectText', modelKey),
        }),
      );
    },
    [setAioStageSelection, setStatusMessage, t, aioStageLabels, modelLabelFor],
  );
  const handleSelectRecognizeModel = useCallback(
    (modelKey: string) => {
      selectAioRecognizeTextModel(modelKey);
      setStatusMessage(
        t('dashboard.status.modelSelected', {
          stage: aioStageLabels.recognizeText,
          model: modelLabelFor('recognizeText', modelKey),
        }),
      );
    },
    [selectAioRecognizeTextModel, setStatusMessage, t, aioStageLabels, modelLabelFor],
  );
  const handleSelectSegmentModel = useCallback(
    (modelKey: string) => {
      setAioStageSelection((prev) => ({ ...prev, segmentText: modelKey }));
      setStatusMessage(
        t('dashboard.status.modelSelected', {
          stage: aioStageLabels.segmentText,
          model: modelLabelFor('segmentText', modelKey),
        }),
      );
    },
    [setAioStageSelection, setStatusMessage, t, aioStageLabels, modelLabelFor],
  );
  const handleSelectCleanModel = useCallback(
    (modelKey: string) => {
      setAioStageSelection((prev) => ({ ...prev, cleanImage: modelKey }));
      setStatusMessage(
        t('dashboard.status.modelSelected', {
          stage: aioStageLabels.cleanImage,
          model: modelLabelFor('cleanImage', modelKey),
        }),
      );
    },
    [setAioStageSelection, setStatusMessage, t, aioStageLabels, modelLabelFor],
  );
  const handleEnhanceClose = useCallback(
    () => { setEnhanceModelManagerOpen(false); },
    [setEnhanceModelManagerOpen],
  );
  const handleEnhanceSelect = useCallback(
    (modelId: string) => {
      setEnhanceModelId(modelId);
      setEnhanceModelManagerOpen(false);
    },
    [setEnhanceModelId, setEnhanceModelManagerOpen],
  );
  const handleEnhanceImport = useCallback(
    async (model: Parameters<typeof importOnnxModelFromStorage>[0]) => {
      await importOnnxModelFromStorage(model);
      await refreshModelState();
    },
    [importOnnxModelFromStorage, refreshModelState],
  );
  return (
    <>
      {openedOnce.getTranslations && (
        <TranslationModelManagerModal
          open={modelManagerState.modalOpen && activeModelManagerStage === 'getTranslations'}
          entries={modelManagerState.entries}
          freeProviderSection={translationFreeProviderManagerSection}
          customProfilesSection={translationCustomProfilesManagerSection}
          diskSpace={modelManagerState.diskSpace}
          installedCount={modelSummary.installedCount}
          totalCount={modelSummary.totalCount}
          updatesCount={modelSummary.updateCount}
          installedSizeBytes={modelManagerState.installedSizeBytes}
          checkingRemoteUpdates={modelManagerState.checkingRemoteUpdates}
          lastRemoteCheckAt={modelManagerState.lastRemoteCheckAt}
          defaultLanguageFilter={modelManagerState.modalLanguageFilter || aioSrcLang}
          focusedModelId={modelManagerState.focusedModelId}
          selectedModelId={aioStageSelection.getTranslations}
          batch={modelManagerState.batch}
          installAllSummary={installAllSummary}
          onClose={closeModelManagerForStage}
          onSetLanguageFilter={setModelModalLanguageFilter}
          onInstallModel={handleInstallModel}
          onUpdateModel={handleUpdateModel}
          onUninstallModel={handleUninstallModel}
          onRetryModel={handleRetryModel}
          onCancelModel={handleCancelModel}
          onSelectModel={handleSelectTranslationModel}
          onInstallAll={handleInstallAll}
          onCancelAll={handleCancelAll}
          onCheckUpdatesNow={handleCheckUpdatesNow}
        />
      )}

      {openedOnce.detectText && (
        <DetectTextModelManagerModal
          open={modelManagerState.modalOpen && activeModelManagerStage === 'detectText'}
          entries={modelManagerState.entries}
          diskSpace={modelManagerState.diskSpace}
          installedCount={modelSummary.installedCount}
          totalCount={modelSummary.totalCount}
          updatesCount={modelSummary.updateCount}
          installedSizeBytes={modelManagerState.installedSizeBytes}
          checkingRemoteUpdates={modelManagerState.checkingRemoteUpdates}
          lastRemoteCheckAt={modelManagerState.lastRemoteCheckAt}
          defaultLanguageFilter={modelManagerState.modalLanguageFilter || aioSrcLang}
          focusedModelId={modelManagerState.focusedModelId}
          selectedModelId={aioStageSelection.detectText}
          batch={modelManagerState.batch}
          installAllSummary={installAllSummary}
          onClose={closeModelManagerForStage}
          onSetLanguageFilter={setModelModalLanguageFilter}
          onInstallModel={handleInstallModel}
          onUpdateModel={handleUpdateModel}
          onUninstallModel={handleUninstallModel}
          onRetryModel={handleRetryModel}
          onCancelModel={handleCancelModel}
          onSelectModel={handleSelectDetectModel}
          onInstallAll={handleInstallAll}
          onCancelAll={handleCancelAll}
          onCheckUpdatesNow={handleCheckUpdatesNow}
        />
      )}

      {openedOnce.recognizeText && (
        <RecognizeTextModelManagerModal
          open={modelManagerState.modalOpen && activeModelManagerStage === 'recognizeText'}
          entries={modelManagerState.entries}
          freeProviderSection={ocrFreeProviderManagerSection}
          customProfilesSection={ocrCustomProfilesManagerSection}
          diskSpace={modelManagerState.diskSpace}
          installedCount={modelSummary.installedCount}
          totalCount={modelSummary.totalCount}
          updatesCount={modelSummary.updateCount}
          installedSizeBytes={modelManagerState.installedSizeBytes}
          checkingRemoteUpdates={modelManagerState.checkingRemoteUpdates}
          lastRemoteCheckAt={modelManagerState.lastRemoteCheckAt}
          defaultLanguageFilter={modelManagerState.modalLanguageFilter || aioSrcLang}
          focusedModelId={modelManagerState.focusedModelId}
          selectedModelId={aioStageSelection.recognizeText}
          batch={modelManagerState.batch}
          installAllSummary={installAllSummary}
          onClose={closeModelManagerForStage}
          onSetLanguageFilter={setModelModalLanguageFilter}
          onInstallModel={handleInstallModel}
          onUpdateModel={handleUpdateModel}
          onUninstallModel={handleUninstallModel}
          onRetryModel={handleRetryModel}
          onCancelModel={handleCancelModel}
          onSelectModel={handleSelectRecognizeModel}
          onInstallAll={handleInstallAll}
          onCancelAll={handleCancelAll}
          onCheckUpdatesNow={handleCheckUpdatesNow}
        />
      )}

      {openedOnce.segmentText && (
        <SegmentTextModelManagerModal
          open={modelManagerState.modalOpen && activeModelManagerStage === 'segmentText'}
          entries={modelManagerState.entries}
          diskSpace={modelManagerState.diskSpace}
          installedCount={modelSummary.installedCount}
          totalCount={modelSummary.totalCount}
          updatesCount={modelSummary.updateCount}
          installedSizeBytes={modelManagerState.installedSizeBytes}
          checkingRemoteUpdates={modelManagerState.checkingRemoteUpdates}
          lastRemoteCheckAt={modelManagerState.lastRemoteCheckAt}
          defaultLanguageFilter={modelManagerState.modalLanguageFilter || aioSrcLang}
          focusedModelId={modelManagerState.focusedModelId}
          selectedModelId={aioStageSelection.segmentText}
          batch={modelManagerState.batch}
          installAllSummary={installAllSummary}
          onClose={closeModelManagerForStage}
          onSetLanguageFilter={setModelModalLanguageFilter}
          onInstallModel={handleInstallModel}
          onUpdateModel={handleUpdateModel}
          onUninstallModel={handleUninstallModel}
          onRetryModel={handleRetryModel}
          onCancelModel={handleCancelModel}
          onSelectModel={handleSelectSegmentModel}
          onInstallAll={handleInstallAll}
          onCancelAll={handleCancelAll}
          onCheckUpdatesNow={handleCheckUpdatesNow}
        />
      )}

      {openedOnce.cleanImage && (
        <CleanImageModelManagerModal
          open={modelManagerState.modalOpen && activeModelManagerStage === 'cleanImage'}
          entries={modelManagerState.entries}
          diskSpace={modelManagerState.diskSpace}
          installedCount={modelSummary.installedCount}
          totalCount={modelSummary.totalCount}
          updatesCount={modelSummary.updateCount}
          installedSizeBytes={modelManagerState.installedSizeBytes}
          checkingRemoteUpdates={modelManagerState.checkingRemoteUpdates}
          lastRemoteCheckAt={modelManagerState.lastRemoteCheckAt}
          defaultLanguageFilter={modelManagerState.modalLanguageFilter || aioSrcLang}
          focusedModelId={modelManagerState.focusedModelId}
          selectedModelId={aioStageSelection.cleanImage}
          batch={modelManagerState.batch}
          installAllSummary={installAllSummary}
          onClose={closeModelManagerForStage}
          onSetLanguageFilter={setModelModalLanguageFilter}
          onInstallModel={handleInstallModel}
          onUpdateModel={handleUpdateModel}
          onUninstallModel={handleUninstallModel}
          onRetryModel={handleRetryModel}
          onCancelModel={handleCancelModel}
          onSelectModel={handleSelectCleanModel}
          onInstallAll={handleInstallAll}
          onCancelAll={handleCancelAll}
          onCheckUpdatesNow={handleCheckUpdatesNow}
        />
      )}

      {openedOnce.enhance && (
        <EnhanceImageModelManagerModal
          open={enhanceModelManagerOpen}
          diskSpace={modelManagerState.diskSpace}
          entries={modelManagerState.entries}
          selectedModelId={enhanceModelId}
          onClose={handleEnhanceClose}
          onSelectModel={handleEnhanceSelect}
          onInstallModel={handleInstallModel}
          onUpdateModel={handleUpdateModel}
          onUninstallModel={handleUninstallModel}
          onRetryModel={handleRetryModel}
          onCancelModel={handleCancelModel}
          onImportModel={handleEnhanceImport}
        />
      )}
    </>
  );
}
