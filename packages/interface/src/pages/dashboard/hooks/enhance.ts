import { useCallback, useEffect, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import type { useModelManager } from '../../../hooks/useModelManager';
import { ENHANCE_IMAGE_MODELS_REGISTRY } from '../../../models/translation-models-registry';
import type { WebhookMetrics } from '../../../types/dashboard.types';
import { runConcurrentBatch } from '../../../utils/concurrentBatch';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import { useEnhanceStore } from '../stores/enhance-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

/* ── Model catalog memos + selected-model reconciliation ── */

interface UseEnhanceModelSelectionArgs {
  modelManagerState: ReturnType<typeof useModelManager>['state'];
}

export function useEnhanceModelSelection({
  modelManagerState,
}: UseEnhanceModelSelectionArgs) {
  const enhanceScale = useEnhanceStore((s) => s.enhanceScale);
  const enhanceProfile = useEnhanceStore((s) => s.enhanceProfile);
  const enhanceModelId = useEnhanceStore((s) => s.enhanceModelId);
  const setEnhanceModelId = useEnhanceStore((s) => s.setEnhanceModelId);

  const enhanceModels = useMemo(() => ENHANCE_IMAGE_MODELS_REGISTRY, []);

  const filteredEnhanceModels = useMemo(() => {
    return enhanceModels.filter((model) => {
      const scaleMatches = model.id.includes('4x')
        ? enhanceScale === 4
        : enhanceScale === 2;
      if (!scaleMatches) return false;

      if (enhanceProfile === 'manga_scan') {
        return model.id.includes('art_scan');
      }
      if (enhanceProfile === 'anime_art') {
        return model.id.includes('art_2x') || model.id.includes('anifilm');
      }
      if (enhanceProfile === 'general') {
        return (
          model.id.includes('spankendata') || model.id.includes('realesrgan')
        );
      }
      return (
        model.id.includes('nomos2') ||
        model.id.includes('hfa2k') ||
        model.id.includes('swinir')
      );
    });
  }, [enhanceModels, enhanceProfile, enhanceScale]);

  const selectedEnhanceModel = useMemo(
    () =>
      filteredEnhanceModels.find((model) => model.id === enhanceModelId) ??
      filteredEnhanceModels[0] ??
      null,
    [enhanceModelId, filteredEnhanceModels],
  );

  const selectedEnhanceInstallState = useMemo(
    () =>
      selectedEnhanceModel
        ? (modelManagerState.entries[selectedEnhanceModel.id] ?? null)
        : null,
    [modelManagerState.entries, selectedEnhanceModel],
  );

  useEffect(() => {
    if (!selectedEnhanceModel) {
      return;
    }
    if (selectedEnhanceModel.id !== enhanceModelId) {
      setEnhanceModelId(selectedEnhanceModel.id);
    }
  }, [enhanceModelId, selectedEnhanceModel, setEnhanceModelId]);

  return {
    filteredEnhanceModels,
    selectedEnhanceModel,
    selectedEnhanceInstallState,
  };
}

/* ── Install action (model manager install flow) ── */

interface EnhanceModelLike {
  id: string;
  name: string;
}

interface UseEnhanceInstallActionArgs {
  selectedEnhanceModel: EnhanceModelLike | null;
  installTranslationModel: (modelId: string) => Promise<void>;
  refreshModelState: () => Promise<void>;
}

export function useEnhanceInstallAction({
  selectedEnhanceModel,
  installTranslationModel,
  refreshModelState,
}: UseEnhanceInstallActionArgs) {
  const setEnhanceActionBusy = useEnhanceStore((s) => s.setEnhanceActionBusy);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  return useCallback(async () => {
    if (!selectedEnhanceModel) return;
    setEnhanceActionBusy(true);
    try {
      await installTranslationModel(selectedEnhanceModel.id);
      await refreshModelState();
      setStatusMessage(`Model "${selectedEnhanceModel.name}" installed successfully.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to install the enhancement model.');
    } finally {
      setEnhanceActionBusy(false);
    }
  }, [
    installTranslationModel,
    refreshModelState,
    selectedEnhanceModel,
    setEnhanceActionBusy,
    setStatusMessage,
  ]);
}

/* ── ONNX import + enhance execution (desktop local API) ── */

interface UseDashboardEnhanceActionsArgs {
  isDesktopRuntime: boolean;
  localApiUrl: string;
  selectedEnhanceModel: { id: string; name: string } | null;
  selectedEnhanceInstallState: { status: string } | null;
  ensureVerifiedEmailOrNotify: () => boolean;
  emitProcessStartWebhook: (processMode: string, pages: number, metrics?: WebhookMetrics) => void;
  emitProcessCompleteWebhook: (processMode: string, pages: number, metrics?: WebhookMetrics) => void;
  emitProcessErrorWebhook: (processMode: string, pages: number, error: unknown, metrics?: WebhookMetrics) => void;
  registerDownloads: (items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>, scope: any) => void;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void>;
  discord: { setBatch: (fileCount: number, currentIndex: number, fileName?: string) => Promise<void> };
  effectiveBatchConcurrency: number;
  importOnnxModelFromStorage: (model: any) => Promise<unknown>;
  refreshModelState: () => Promise<unknown>;
}

export function useDashboardEnhanceActions({
  isDesktopRuntime,
  localApiUrl,
  selectedEnhanceModel,
  selectedEnhanceInstallState,
  ensureVerifiedEmailOrNotify,
  emitProcessStartWebhook,
  emitProcessCompleteWebhook,
  emitProcessErrorWebhook,
  registerDownloads,
  recordProcessedPages,
  syncDiscordForTab,
  discord,
  effectiveBatchConcurrency,
  importOnnxModelFromStorage,
  refreshModelState,
}: UseDashboardEnhanceActionsArgs) {
  const { t } = useI18n();
  const images = useImageCollectionStore((s) => s.images);
  const enhanceScale = useEnhanceStore((s) => s.enhanceScale);
  const enhanceProfile = useEnhanceStore((s) => s.enhanceProfile);
  const enhanceOutputFormat = useEnhanceStore((s) => s.enhanceOutputFormat);
  const setEnhanceActionBusy = useEnhanceStore((s) => s.setEnhanceActionBusy);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const importSelectedEnhanceModel = useCallback(async () => {
    if (!selectedEnhanceModel) return;
    setEnhanceActionBusy(true);
    try {
      await importOnnxModelFromStorage(selectedEnhanceModel);
      await refreshModelState();
      setStatusMessage(`ONNX model imported into "${selectedEnhanceModel.name}".`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to import the ONNX model.');
    } finally {
      setEnhanceActionBusy(false);
    }
  }, [importOnnxModelFromStorage, refreshModelState, selectedEnhanceModel, setEnhanceActionBusy, setStatusMessage]);

  const processEnhance = useCallback(async () => {
    if (!isDesktopRuntime) {
      setStatusMessage(t('enhanceActions.desktopOnly'));
      return;
    }
    if (!selectedEnhanceModel || !selectedEnhanceInstallState) {
      setStatusMessage(t('enhanceActions.selectModel'));
      return;
    }
    if (selectedEnhanceInstallState.status !== 'installed' && selectedEnhanceInstallState.status !== 'update_available') {
      setStatusMessage('Install or import the selected model before enhancing the images.');
      return;
    }
    if (!ensureVerifiedEmailOrNotify()) return;
    if (images.length === 0) return;

    setProcessing(true);
    setProgress(0);
    setStatusMessage(
      effectiveBatchConcurrency > 1
        ? `Executando melhoria em lote com ${effectiveBatchConcurrency} threads...`
        : 'Executando melhoria em lote...'
    );
    emitProcessStartWebhook('Enhance', images.length, {
      escala: enhanceScale,
      modelo: selectedEnhanceModel.id,
      perfil: enhanceProfile,
      formato_saida: enhanceOutputFormat,
      threads: effectiveBatchConcurrency,
    });

    try {
      const results = await runConcurrentBatch({
        items: images,
        concurrency: effectiveBatchConcurrency,
        worker: async ({ item: imgData, index }) => {
          await discord.setBatch(images.length, index + 1, imgData.file.name);
          const formData = new FormData();
          formData.append('file', imgData.file);
          formData.append('model_key', selectedEnhanceModel.id);
          formData.append('output_format', enhanceOutputFormat);

          const response = await fetchWithTimeoutAndRetry(
            `${localApiUrl}/enhance`,
            { method: 'POST', body: formData },
            { timeoutMs: 180_000, retryCount: 0 },
          );
          if (!response.ok) {
            const apiMessage = await response.text().catch(() => '');
            throw new Error(`Failed to enhance "${imgData.file.name}": ${apiMessage || response.status}`);
          }
          const blob = await response.blob();
          return {
            fileName: `koma-studio-melhorado-${imgData.file.name.replace(/\s+/g, '-')}.${enhanceOutputFormat}`,
            blob,
            sourceImageId: imgData.id,
          };
        },
        onProgress: ({ completed }) => {
          setProgress((completed / images.length) * 100);
        },
      });

      registerDownloads(results, 'enhance');
      recordProcessedPages(images.length);
      emitProcessCompleteWebhook('Enhance', images.length, {
        imagens_processadas: results.length,
        escala: enhanceScale,
        modelo: selectedEnhanceModel.id,
        perfil: enhanceProfile,
        threads: effectiveBatchConcurrency,
      });
      setStatusMessage(t('enhanceActions.done'));
    } catch (error) {
      emitProcessErrorWebhook('Enhance', images.length, error, {
        escala: enhanceScale,
        modelo: selectedEnhanceModel?.id,
        perfil: enhanceProfile,
        threads: effectiveBatchConcurrency,
      });
      if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
        setStatusMessage(
          t('enhanceActions.connectError', { url: localApiUrl }),
        );
      } else {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to enhance the images.');
      }
    } finally {
      setProcessing(false);
      setProgress(0);
      void syncDiscordForTab();
    }
  }, [
    discord,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    emitProcessStartWebhook,
    enhanceOutputFormat,
    enhanceProfile,
    enhanceScale,
    ensureVerifiedEmailOrNotify,
    images,
    isDesktopRuntime,
    localApiUrl,
    registerDownloads,
    selectedEnhanceInstallState,
    selectedEnhanceModel,
    setProcessing,
    setProgress,
    setStatusMessage,
    syncDiscordForTab,
    recordProcessedPages,
    t,
  ]);

  return {
    importSelectedEnhanceModel,
    processEnhance,
  };
}
