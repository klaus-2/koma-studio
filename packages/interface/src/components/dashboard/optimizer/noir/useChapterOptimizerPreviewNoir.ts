import { useEffect, useRef, useState } from 'react';

import type { OptimizationRecipe } from '../../../../types';
import { useI18n } from '../../../../i18n';
import type {
  OptimizerImageInput,
  OptimizerPreviewStats,
} from '../ChapterOptimizerWorkspace.types';
import { runOptimizerJob } from '../optimizerJob';

type TranslateFn = ReturnType<typeof useI18n>['t'];

interface UseChapterOptimizerPreviewNoirParams {
  activeImage: OptimizerImageInput | null;
  activeSourceBlob: Blob | null;
  recipe: OptimizationRecipe;
  setStatusMessage: (message: string) => void;
  t: TranslateFn;
  onSourceChange: () => void;
}

export const useChapterOptimizerPreviewNoir = ({
  activeImage,
  activeSourceBlob,
  recipe,
  setStatusMessage,
  t,
  onSourceChange,
}: UseChapterOptimizerPreviewNoirParams) => {
  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [originalPreviewUrl, setOriginalPreviewUrl] =
    useState<string | null>(null);

  const [previewStats, setPreviewStats] =
    useState<OptimizerPreviewStats | null>(null);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const previewTicketRef = useRef(0);

  const previewDebounceRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  useEffect(() => {
    if (!activeSourceBlob) {
      setOriginalPreviewUrl(null);
      return;
    }

    const nextUrl =
      URL.createObjectURL(activeSourceBlob);

    setOriginalPreviewUrl(nextUrl);
    setPreviewStats(null);
    onSourceChange();
  }, [activeSourceBlob, onSourceChange]);

  useEffect(
    () => () => {
      if (originalPreviewUrl) {
        URL.revokeObjectURL(
          originalPreviewUrl,
        );
      }
    },
    [originalPreviewUrl],
  );

  useEffect(() => {
    if (!activeImage || !activeSourceBlob) {
      setPreviewLoading(false);
      setPreviewUrl(null);
      return;
    }

    setPreviewLoading(true);

    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    const currentTicket =
      ++previewTicketRef.current;

    let jobCancelled = false;

    previewDebounceRef.current = setTimeout(() => {
      void activeSourceBlob
        .arrayBuffer()
        .then((buffer) =>
          runOptimizerJob(
            {
              sourceBuffer: buffer,
              sourceMimeType:
                activeSourceBlob.type ||
                activeImage.file.type ||
                'image/png',
              ...recipe,
            },
            t,
          ),
        )
        .then((result) => {
          if (
            jobCancelled ||
            currentTicket !==
            previewTicketRef.current
          ) {
            return;
          }

          const nextUrl =
            URL.createObjectURL(result.blob);

          setPreviewUrl(nextUrl);

          setPreviewStats({
            originalBytes:
              activeSourceBlob.size,
            optimizedBytes: result.blob.size,
            width: result.width,
            height: result.height,
          });

          setPreviewLoading(false);
        })
        .catch((error) => {
          if (jobCancelled) return;

          setPreviewLoading(false);

          setStatusMessage(
            error instanceof Error
              ? error.message
              : t('optimizer.error.preview'),
          );
        });
    }, 280);

    return () => {
      jobCancelled = true;

      if (previewDebounceRef.current) {
        clearTimeout(
          previewDebounceRef.current,
        );
        previewDebounceRef.current = null;
      }
    };
  }, [
    activeImage,
    activeSourceBlob,
    recipe,
    setStatusMessage,
    t,
  ]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  return {
    previewUrl,
    originalPreviewUrl,
    previewStats,
    previewLoading,
  };
};
