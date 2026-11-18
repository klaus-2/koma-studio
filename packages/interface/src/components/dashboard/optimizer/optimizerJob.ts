import type { OptimizationRecipe } from '../../../types';
import { useI18n } from '../../../i18n';

type TranslateFn = ReturnType<typeof useI18n>['t'];

export type WorkerSuccess = {
  blob: Blob;
  width: number;
  height: number;
};

export const OPTIMIZER_JOB_TIMEOUT_MS = 120_000;

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
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (
      outcome:
        | { ok: true; value: WorkerSuccess }
        | { ok: false; error: Error },
    ): void => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      worker.terminate();
      if (outcome.ok) {
        resolve(outcome.value);
      } else {
        reject(outcome.error);
      }
    };

    timeoutId = setTimeout(() => {
      console.error('[optimizer] worker job timed out', {
        requestId,
        timeoutMs: OPTIMIZER_JOB_TIMEOUT_MS,
      });
      finish({
        ok: false,
        error: new Error(t('optimizer.error.worker')),
      });
    }, OPTIMIZER_JOB_TIMEOUT_MS);

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

      if (
        !event.data.ok ||
        !event.data.blob ||
        !event.data.width ||
        !event.data.height
      ) {
        finish({
          ok: false,
          error: new Error(
            event.data.error ||
            t('optimizer.error.failed'),
          ),
        });
        return;
      }

      finish({
        ok: true,
        value: {
          blob: event.data.blob,
          width: event.data.width,
          height: event.data.height,
        },
      });
    };

    worker.onerror = (event: ErrorEvent) => {
      console.error('[optimizer] worker error', {
        requestId,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
      finish({
        ok: false,
        error: new Error(t('optimizer.error.worker')),
      });
    };

    worker.onmessageerror = () => {
      console.error('[optimizer] worker response deserialization failed', {
        requestId,
      });
      finish({
        ok: false,
        error: new Error(t('optimizer.error.worker')),
      });
    };

    // Ownership: the caller allocates sourceBuffer fresh per call (all call
    // sites pass a fresh blob.arrayBuffer() result) and relinquishes it on
    // send, so the bytes transfer to the worker instead of structured-cloning.
    try {
      worker.postMessage(
        { id: requestId, ...payload },
        [payload.sourceBuffer],
      );
    } catch (error) {
      console.error('[optimizer] worker postMessage failed', { requestId }, error);
      finish({
        ok: false,
        error: new Error(t('optimizer.error.worker')),
      });
    }
  });
};
