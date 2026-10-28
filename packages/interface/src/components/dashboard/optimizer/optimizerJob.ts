import type { OptimizationRecipe } from '../../../types';
import { useI18n } from '../../../i18n';

type TranslateFn = ReturnType<typeof useI18n>['t'];

export type WorkerSuccess = {
  blob: Blob;
  width: number;
  height: number;
};

export const runOptimizerJob = (
  payload: {
    sourceBuffer: ArrayBuffer;
    sourceMimeType: string;
  } & OptimizationRecipe,
  t: TranslateFn,
): Promise<WorkerSuccess> => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(
      new Error(t('optimizer.error.worker')),
    );
  }

  const worker = new Worker(
    new URL('./optimizerWorker.ts', import.meta.url),
    {
      type: 'module',
    },
  );

  const requestId = `optimizer-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    worker.onmessage = (
      event: MessageEvent<{
        id: string;
        ok: boolean;
        blob?: Blob;
        width?: number;
        height?: number;
        error?: string;
      }>,
    ) => {
      if (event.data.id !== requestId) return;

      worker.terminate();

      if (
        !event.data.ok ||
        !event.data.blob ||
        !event.data.width ||
        !event.data.height
      ) {
        reject(
          new Error(
            event.data.error ||
            t('optimizer.error.failed'),
          ),
        );
        return;
      }

      resolve({
        blob: event.data.blob,
        width: event.data.width,
        height: event.data.height,
      });
    };

    worker.onerror = () => {
      worker.terminate();

      reject(
        new Error(t('optimizer.error.worker')),
      );
    };

    worker.postMessage({
      id: requestId,
      ...payload,
    });
  });
};
