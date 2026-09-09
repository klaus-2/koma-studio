import { TranslationModelManagerModal } from '../ModelManagerModal/TranslationModelManagerModal';
import { DetectTextModelManagerModal } from '../ModelManagerModal/DetectTextModelManagerModal';
import { RecognizeTextModelManagerModal } from '../ModelManagerModal/RecognizeTextModelManagerModal';
import { SegmentTextModelManagerModal } from '../ModelManagerModal/SegmentTextModelManagerModal';
import { CleanImageModelManagerModal } from '../ModelManagerModal/CleanImageModelManagerModal';
import { EnhanceImageModelManagerModal } from '../ModelManagerModal/EnhanceImageModelManagerModal';
import { useCallback, useMemo } from 'react';
import { useI18n } from '../../i18n';
import { getAioStageLabels } from '../../constants/dashboard.constants';

import type { AioStageKey, AioStageSelection } from '../../types/aioModelPresets';
import type { AioStageOption, AioStageOptionMap } from '../../models/aioStageCatalog';

interface DashboardModelManagersProps {
  activeModelManagerStage: AioStageKey;
  modelManagerState: {
    modalOpen: boolean;
    entries: Record<string, any>;
    diskSpace: any;
    installedSizeBytes: number;
    checkingRemoteUpdates: boolean;
    lastRemoteCheckAt: number | null;
    modalLanguageFilter: string | null;
    focusedModelId: string | null;
    batch: any;
  };
  modelSummary: {
    installedCount: number;
    totalCount: number;
    updateCount: number;
  };
  aioSrcLang: string;
  aioStageSelection: AioStageSelection;
  aioStageOptions: AioStageOptionMap;
  aioOcrStageOptions: readonly AioStageOption[];
  installAllSummary: any;
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

export default function DashboardModelManagers({
  activeModelManagerStage,
  modelManagerState,
  modelSummary,
  aioSrcLang,
  aioStageSelection,
  aioStageOptions,
  aioOcrStageOptions,
  installAllSummary,
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
  const aioStageLabels = useMemo(() => getAioStageLabels(t), [t]);
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
  return (
    <>
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
        onInstallModel={async (modelId) => { await installTranslationModel(modelId); }}
        onUpdateModel={async (modelId) => { await updateTranslationModel(modelId); }}
        onUninstallModel={async (modelId) => { await uninstallTranslationModel(modelId); }}
        onRetryModel={async (modelId) => { await retryTranslationModel(modelId); }}
        onCancelModel={async (modelId) => { await cancelTranslationModel(modelId); }}
        onSelectModel={(modelKey) => {
          setAioStageSelection((prev) => ({ ...prev, getTranslations: modelKey }));
          setStatusMessage(
            t('dashboard.status.modelSelected', {
              stage: aioStageLabels.getTranslations,
              model: modelLabelFor('getTranslations', modelKey),
            }),
          );
        }}
        onInstallAll={async (modelIds) => { await installAllTranslationModels(modelIds); }}
        onCancelAll={async () => { await cancelAllTranslationModels(); }}
        onCheckUpdatesNow={async () => { await checkModelUpdatesNow(); }}
      />

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
        onInstallModel={async (modelId) => { await installTranslationModel(modelId); }}
        onUpdateModel={async (modelId) => { await updateTranslationModel(modelId); }}
        onUninstallModel={async (modelId) => { await uninstallTranslationModel(modelId); }}
        onRetryModel={async (modelId) => { await retryTranslationModel(modelId); }}
        onCancelModel={async (modelId) => { await cancelTranslationModel(modelId); }}
        onSelectModel={(modelKey) => {
          setAioStageSelection((prev) => ({ ...prev, detectText: modelKey }));
          setStatusMessage(
            t('dashboard.status.modelSelected', {
              stage: aioStageLabels.detectText,
              model: modelLabelFor('detectText', modelKey),
            }),
          );
        }}
        onInstallAll={async (modelIds) => { await installAllTranslationModels(modelIds); }}
        onCancelAll={async () => { await cancelAllTranslationModels(); }}
        onCheckUpdatesNow={async () => { await checkModelUpdatesNow(); }}
      />

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
        onInstallModel={async (modelId) => { await installTranslationModel(modelId); }}
        onUpdateModel={async (modelId) => { await updateTranslationModel(modelId); }}
        onUninstallModel={async (modelId) => { await uninstallTranslationModel(modelId); }}
        onRetryModel={async (modelId) => { await retryTranslationModel(modelId); }}
        onCancelModel={async (modelId) => { await cancelTranslationModel(modelId); }}
        onSelectModel={(modelKey) => {
          selectAioRecognizeTextModel(modelKey);
          setStatusMessage(
            t('dashboard.status.modelSelected', {
              stage: aioStageLabels.recognizeText,
              model: modelLabelFor('recognizeText', modelKey),
            }),
          );
        }}
        onInstallAll={async (modelIds) => { await installAllTranslationModels(modelIds); }}
        onCancelAll={async () => { await cancelAllTranslationModels(); }}
        onCheckUpdatesNow={async () => { await checkModelUpdatesNow(); }}
      />

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
        onInstallModel={async (modelId) => { await installTranslationModel(modelId); }}
        onUpdateModel={async (modelId) => { await updateTranslationModel(modelId); }}
        onUninstallModel={async (modelId) => { await uninstallTranslationModel(modelId); }}
        onRetryModel={async (modelId) => { await retryTranslationModel(modelId); }}
        onCancelModel={async (modelId) => { await cancelTranslationModel(modelId); }}
        onSelectModel={(modelKey) => {
          setAioStageSelection((prev) => ({ ...prev, segmentText: modelKey }));
          setStatusMessage(
            t('dashboard.status.modelSelected', {
              stage: aioStageLabels.segmentText,
              model: modelLabelFor('segmentText', modelKey),
            }),
          );
        }}
        onInstallAll={async (modelIds) => { await installAllTranslationModels(modelIds); }}
        onCancelAll={async () => { await cancelAllTranslationModels(); }}
        onCheckUpdatesNow={async () => { await checkModelUpdatesNow(); }}
      />

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
        onInstallModel={async (modelId) => { await installTranslationModel(modelId); }}
        onUpdateModel={async (modelId) => { await updateTranslationModel(modelId); }}
        onUninstallModel={async (modelId) => { await uninstallTranslationModel(modelId); }}
        onRetryModel={async (modelId) => { await retryTranslationModel(modelId); }}
        onCancelModel={async (modelId) => { await cancelTranslationModel(modelId); }}
        onSelectModel={(modelKey) => {
          setAioStageSelection((prev) => ({ ...prev, cleanImage: modelKey }));
          setStatusMessage(
            t('dashboard.status.modelSelected', {
              stage: aioStageLabels.cleanImage,
              model: modelLabelFor('cleanImage', modelKey),
            }),
          );
        }}
        onInstallAll={async (modelIds) => { await installAllTranslationModels(modelIds); }}
        onCancelAll={async () => { await cancelAllTranslationModels(); }}
        onCheckUpdatesNow={async () => { await checkModelUpdatesNow(); }}
      />

      <EnhanceImageModelManagerModal
        open={enhanceModelManagerOpen}
        diskSpace={modelManagerState.diskSpace}
        entries={modelManagerState.entries}
        selectedModelId={enhanceModelId}
        onClose={() => setEnhanceModelManagerOpen(false)}
        onSelectModel={(modelId) => {
          setEnhanceModelId(modelId);
          setEnhanceModelManagerOpen(false);
        }}
        onInstallModel={async (modelId) => { await installTranslationModel(modelId); }}
        onUpdateModel={async (modelId) => { await updateTranslationModel(modelId); }}
        onUninstallModel={async (modelId) => { await uninstallTranslationModel(modelId); }}
        onRetryModel={async (modelId) => { await retryTranslationModel(modelId); }}
        onCancelModel={async (modelId) => { await cancelTranslationModel(modelId); }}
        onImportModel={async (model) => {
          await importOnnxModelFromStorage(model);
          await refreshModelState();
        }}
      />
    </>
  );
}
