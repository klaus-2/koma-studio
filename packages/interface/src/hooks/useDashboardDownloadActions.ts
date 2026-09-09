import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { buildRegionTextDump, removeFileExtension, sanitizeArchivePathToken } from '../utils/dashboard.utils';
import type { AioTextRegion, PreparedDownloadEntry, ProcessableMode } from '../types/dashboard.types';

interface DownloadImageRef {
  id: string;
  file: File;
}

interface UseDashboardDownloadActionsArgs {
  lastActionScope: ProcessableMode | null;
  downloadBundleFormat: string;
  translatorWorkspaceMode: 'text' | 'visual';
  translatorTranslatedText: string;
  images: DownloadImageRef[];
  translatorDetectionsByImage: Record<string, AioTextRegion[]>;
  prepareDownloadEntries: (scope: ProcessableMode) => Promise<PreparedDownloadEntry[]>;
  buildDownloadBundleBlob: (scope: ProcessableMode, entries: PreparedDownloadEntry[]) => Promise<{ blob: Blob; fileName: string }>;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  setDownloadMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusMessage: (message: string) => void;
}

export function useDashboardDownloadActions({
  lastActionScope,
  downloadBundleFormat,
  translatorWorkspaceMode,
  translatorTranslatedText,
  images,
  translatorDetectionsByImage,
  prepareDownloadEntries,
  buildDownloadBundleBlob,
  triggerBlobDownload,
  setDownloadMenuOpen,
  setStatusMessage,
}: UseDashboardDownloadActionsArgs) {
  const { t } = useI18n();

  const buildTranslatorDownloadBlob = useCallback(async (): Promise<{ blob: Blob; fileName: string }> => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (translatorWorkspaceMode === 'text') {
      const textBlob = new Blob([translatorTranslatedText], { type: 'text/plain;charset=utf-8' });
      return {
        blob: textBlob,
        fileName: `koma-studio-translator-text-${timestamp}.txt`,
      };
    }

    const { zipSync, strToU8 } = await import('fflate');
    const zipFiles: Record<string, Uint8Array> = {};
    images.forEach((imgData, index) => {
      const regions = translatorDetectionsByImage[imgData.id] ?? [];
      const baseName = sanitizeArchivePathToken(removeFileExtension(imgData.file.name));
      zipFiles[`texts/raw/${String(index + 1).padStart(3, '0')}-${baseName}.txt`] = strToU8(
        buildRegionTextDump(regions, 'recognized'),
      );
      zipFiles[`texts/translated/${String(index + 1).padStart(3, '0')}-${baseName}.txt`] = strToU8(
        buildRegionTextDump(regions, 'translated'),
      );
    });

    const zipped = zipSync(zipFiles, { level: 6 });
    const zippedCopy = new Uint8Array(zipped.byteLength);
    zippedCopy.set(zipped);
    return {
      blob: new Blob([zippedCopy.buffer], { type: 'application/zip' }),
      fileName: `koma-studio-translator-visual-${timestamp}.zip`,
    };
  }, [images, translatorDetectionsByImage, translatorTranslatedText, translatorWorkspaceMode]);

  const handleDownload = useCallback(async (scope: ProcessableMode | null = lastActionScope) => {
    try {
      if (!scope) {
        setStatusMessage('No results to download.');
        return;
      }

      if (scope === 'translator') {
        const translatorCanDownload = translatorWorkspaceMode === 'text'
          ? translatorTranslatedText.trim().length > 0
          : images.some((img) => {
            const regions = translatorDetectionsByImage[img.id] ?? [];
            return regions.some((region) => (
              (region.recognizedText ?? '').trim().length > 0
              || (region.translatedText ?? '').trim().length > 0
            ));
          });
        if (!translatorCanDownload) {
          setStatusMessage(t('downloadActions.noTranslatorResults'));
          return;
        }
        const { blob, fileName } = await buildTranslatorDownloadBlob();
        triggerBlobDownload(blob, fileName);
        setDownloadMenuOpen(false);
        setStatusMessage(`File ${fileName} generated successfully.`);
        return;
      }

      const entries = await prepareDownloadEntries(scope);
      if (entries.length === 0) {
        setStatusMessage('No results to download in this tab.');
        return;
      }

      const { blob, fileName } = await buildDownloadBundleBlob(scope, entries);
      triggerBlobDownload(blob, fileName);
      setDownloadMenuOpen(false);
      if (downloadBundleFormat === 'cb7') {
        setStatusMessage(`Pacote ${fileName} gerado (modo CB7 experimental com container ZIP).`);
        return;
      }
      setStatusMessage(`Package ${fileName} generated successfully.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to generate the download package.');
    }
  }, [
    buildDownloadBundleBlob,
    buildTranslatorDownloadBlob,
    downloadBundleFormat,
    images,
    lastActionScope,
    prepareDownloadEntries,
    setDownloadMenuOpen,
    setStatusMessage,
    t,
    translatorDetectionsByImage,
    translatorTranslatedText,
    translatorWorkspaceMode,
    triggerBlobDownload,
  ]);

  return {
    buildTranslatorDownloadBlob,
    handleDownload,
  };
}
