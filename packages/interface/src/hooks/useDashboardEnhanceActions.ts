import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import { runConcurrentBatch } from '../utils/concurrentBatch';
import type { WebhookMetrics } from '../types/dashboard.types';

interface UseDashboardEnhanceActionsArgs {
  isDesktopRuntime: boolean;
  localApiUrl: string;
  selectedEnhanceModel: { id: string; name: string } | null;
  selectedEnhanceInstallState: { status: string } | null;
  images: Array<{ id: string; file: File }>;
  enhanceScale: number;
  enhanceProfile: string;
  enhanceOutputFormat: 'png' | 'webp';
  ensureVerifiedEmailOrNotify: () => boolean;
  emitProcessStartWebhook: (processMode: string, pages: number, metrics?: WebhookMetrics) => void;
  emitProcessCompleteWebhook: (processMode: string, pages: number, metrics?: WebhookMetrics) => void;
  emitProcessErrorWebhook: (processMode: string, pages: number, error: unknown, metrics?: WebhookMetrics) => void;
  registerDownloads: (items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>, scope: any) => void;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void>;
  discord: { setBatch: (fileCount: number, currentIndex: number, fileName?: string) => Promise<void> };
  effectiveBatchConcurrency: number;
  setProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  setStatusMessage: (message: string) => void;
  setEnhanceActionBusy: React.Dispatch<React.SetStateAction<boolean>>;
  importOnnxModelFromStorage: (model: any) => Promise<unknown>;
  refreshModelState: () => Promise<unknown>;
}

export function useDashboardEnhanceActions({
  isDesktopRuntime,
  localApiUrl,
  selectedEnhanceModel,
  selectedEnhanceInstallState,
  images,
  enhanceScale,
  enhanceProfile,
  enhanceOutputFormat,
  ensureVerifiedEmailOrNotify,
  emitProcessStartWebhook,
  emitProcessCompleteWebhook,
  emitProcessErrorWebhook,
  registerDownloads,
  recordProcessedPages,
  syncDiscordForTab,
  discord,
  effectiveBatchConcurrency,
  setProcessing,
  setProgress,
  setStatusMessage,
  setEnhanceActionBusy,
  importOnnxModelFromStorage,
  refreshModelState,
}: UseDashboardEnhanceActionsArgs) {
  const { t } = useI18n();

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
