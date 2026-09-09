import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';

import { DASHBOARD_UPLOAD_ACCEPT, DEFAULT_FILTERS, DIRECT_IMAGE_UPLOAD_EXTENSIONS } from '../constants/dashboard.constants';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import { getFileExtension, inferMimeTypeFromFileName, isContainerUploadFile, isDirectImageUploadFile, parseResponseErrorMessage } from '../utils/dashboard.utils';
import { createThumbnailFromUrl } from '../utils/imagePerformance';
import type { IngestArchiveManifest, IngestArchiveManifestEntry, LoadedImage } from '../types/dashboard.types';

interface UseDashboardUploadsArgs {
  localApiUrl: string;
  activeId: string | null;
  isExtractingUploads: boolean;
  setImages: React.Dispatch<React.SetStateAction<LoadedImage[]>>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsExtractingUploads: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusMessage: (message: string) => void;
  invalidateAioPipelineHistory: () => void;
}

export function useDashboardUploads({
  localApiUrl,
  activeId,
  isExtractingUploads,
  setImages,
  setActiveId,
  setIsExtractingUploads,
  setStatusMessage,
  invalidateAioPipelineHistory,
}: UseDashboardUploadsArgs) {
  const loadImageDetails = useCallback((file: File): Promise<LoadedImage> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;

        // Generate thumbnail for list/grid display to reduce memory
        createThumbnailFromUrl(url, 400, 600, 0.7).then((thumbUrl) => {
          resolve({
            id: uuidv4(),
            file,
            url,
            thumbnailUrl: thumbUrl,
            width,
            height,
            rotation: 0,
            filters: { ...DEFAULT_FILTERS },
          });
        }).catch(() => {
          // Thumbnail generation failed, still resolve without it
          resolve({
            id: uuidv4(),
            file,
            url,
            width,
            height,
            rotation: 0,
            filters: { ...DEFAULT_FILTERS },
          });
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load the image.'));
      };
      img.src = url;
    }), []);

  const extractImagesFromContainerFiles = useCallback(async (
    files: File[],
  ): Promise<{ extractedFiles: File[]; warnings: string[] }> => {
    if (files.length === 0) {
      return { extractedFiles: [], warnings: [] };
    }

    const ingestPayload = new FormData();
    files.forEach((file) => ingestPayload.append('files', file));

    const response = await fetchWithTimeoutAndRetry(
      `${localApiUrl}/ingest/images`,
      { method: 'POST', body: ingestPayload },
      { timeoutMs: 240_000, retryCount: 0 },
    );
    if (!response.ok) {
      const message = await parseResponseErrorMessage(response);
      throw new Error(`Failed to extract composite files: ${message}`);
    }

    const archiveBuffer = new Uint8Array(await response.arrayBuffer());
    const { unzipSync, strFromU8 } = await import('fflate');
    const unpacked = unzipSync(archiveBuffer);
    const manifestRaw = unpacked['manifest.json'];
    const warnings: string[] = [];
    const manifestByPath = new Map<string, IngestArchiveManifestEntry>();

    if (manifestRaw) {
      try {
        const manifest = JSON.parse(strFromU8(manifestRaw)) as Partial<IngestArchiveManifest>;
        if (Array.isArray(manifest.warnings)) {
          warnings.push(...manifest.warnings.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0));
        }
        if (Array.isArray(manifest.items)) {
          manifest.items.forEach((entry) => {
            if (!entry || typeof entry.path !== 'string') return;
            const normalizedPath = entry.path.replace(/\\/g, '/');
            manifestByPath.set(normalizedPath, entry);
          });
        }
      } catch {
        warnings.push('Could not parse the file extraction manifest.');
      }
    }

    const extractedFiles: File[] = [];
    Object.entries(unpacked).forEach(([archivePath, bytes]) => {
      if (archivePath === 'manifest.json' || archivePath.endsWith('/')) return;
      const normalizedPath = archivePath.replace(/\\/g, '/');
      const fileName = normalizedPath.split('/').pop()?.trim() || `image-${String(extractedFiles.length + 1).padStart(3, '0')}.png`;
      if (!DIRECT_IMAGE_UPLOAD_EXTENSIONS.has(getFileExtension(fileName))) return;
      const normalized = new Uint8Array(bytes.byteLength);
      normalized.set(bytes);
      const manifestEntry = manifestByPath.get(normalizedPath);
      extractedFiles.push(
        new File(
          [normalized],
          fileName,
          { type: manifestEntry?.mime_type || inferMimeTypeFromFileName(fileName) },
        ),
      );
    });

    if (extractedFiles.length === 0) {
      throw new Error('No valid image was extracted from the uploaded files.');
    }

    return { extractedFiles, warnings };
  }, [localApiUrl]);

  const onDrop = useCallback(async (files: File[]) => {
    const directImageFiles = files.filter(isDirectImageUploadFile);
    const containerFiles = files.filter(isContainerUploadFile);
    let extractedContainerFiles: File[] = [];
    const warnings: string[] = [];

    if (containerFiles.length > 0) {
      setIsExtractingUploads(true);
      setStatusMessage(
        containerFiles.length === 1
          ? 'Extracting images from the composite file, please wait...'
          : `Extracting images from ${containerFiles.length} composite files, please wait...`,
      );
      try {
        const ingestResult = await extractImagesFromContainerFiles(containerFiles);
        extractedContainerFiles = ingestResult.extractedFiles;
        warnings.push(...ingestResult.warnings);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : 'Failed to extract composite files.');
      } finally {
        setIsExtractingUploads(false);
      }
    }

    const candidateFiles = [...directImageFiles, ...extractedContainerFiles];
    if (candidateFiles.length === 0) {
      setStatusMessage(warnings[0] ?? 'No compatible file was found.');
      return;
    }

    try {
      const newImgs = await Promise.all(candidateFiles.map(loadImageDetails));
      setImages((prev) => [...prev, ...newImgs]);
      if (!activeId && newImgs.length > 0 && newImgs[0]) setActiveId(newImgs[0].id);
      invalidateAioPipelineHistory();

      let message = `${newImgs.length} image(s) added.`;
      if (containerFiles.length > 0 && extractedContainerFiles.length > 0) {
        message = `${newImgs.length} image(s) added (${extractedContainerFiles.length} extracted from ${containerFiles.length} container file(s)).`;
      }
      if (warnings.length > 0) {
        const excerpt = warnings.slice(0, 2).join(' | ');
        const suffix = warnings.length > 2 ? '...' : '';
        message = `${message} Warnings: ${excerpt}${suffix}`;
      }
      setStatusMessage(message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load the images.');
    }
  }, [
    activeId,
    extractImagesFromContainerFiles,
    invalidateAioPipelineHistory,
    loadImageDetails,
    setActiveId,
    setImages,
    setIsExtractingUploads,
    setStatusMessage,
  ]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: DASHBOARD_UPLOAD_ACCEPT,
    disabled: isExtractingUploads,
  });

  return {
    onDrop,
    getRootProps,
    getInputProps,
    isDragActive,
  };
}
