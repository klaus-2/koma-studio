/**
 * Shared per-image AIO stage-loop mechanics: abort checks,
 * runtime-notice plumbing, blob-type validation and the clean-download
 * filename template (`koma-studio-*-clean-*.png`).
 * The stage SEQUENCES stay in the adapters (useAioSingleImageProcessor,
 * cleaner.assisted, cleaner.automatic) — only the duplicated mechanics live
 * here.
 */
import type { StageRunNotice, StageRuntime } from '../../../aio-stages';
import type { RuntimeExecutionNotice } from '../../../types/dashboard.types';

export interface AioStageRunSessionOptions {
  localApiUrl: string;
  signal: AbortSignal | null;
  /**
   * When false, success notices are dropped silently (the automatic cleaner
   * contract — assisted/single collect notices into `executionNotices`).
   */
  collectNotices: boolean;
  /** Runtime notice surface (omit when the adapter drops notices). */
  onRuntimeNotice?: (notice: RuntimeExecutionNotice) => void;
}

export interface AioStageRunSession {
  /** StageRuntime for the stage-run modules (`{ localApiUrl, signal }`). */
  readonly stageRuntime: StageRuntime;
  /** Collected notice details (empty when `collectNotices` is false). */
  readonly executionNotices: string[];
  assertNotAborted(): void;
  pushNotice(notice: StageRunNotice | null): void;
  /** Throws `invalidMessage` when the stage returned a non-image blob. */
  ensureStageImageBlob(blob: Blob, invalidMessage: string): Blob;
  /** `koma-studio-*-clean-*.png` download template (single source). */
  buildCleanDownloadName(prefix: string, fileName: string): string;
}

export function createAioStageRunSession(
  options: AioStageRunSessionOptions,
): AioStageRunSession {
  const { localApiUrl, signal, collectNotices, onRuntimeNotice } = options;
  const executionNotices: string[] = [];

  return {
    stageRuntime: { localApiUrl, signal },
    executionNotices,
    assertNotAborted: (): void => {
      if (!signal?.aborted) {
        return;
      }

      throw (
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted.', 'AbortError')
      );
    },
    pushNotice: (notice: StageRunNotice | null): void => {
      if (!notice) {
        return;
      }
      if (collectNotices) {
        executionNotices.push(notice.detail);
      }
      onRuntimeNotice?.(notice);
    },
    ensureStageImageBlob: (blob: Blob, invalidMessage: string): Blob => {
      if (!blob.type.startsWith('image/')) {
        throw new Error(invalidMessage);
      }
      return blob;
    },
    buildCleanDownloadName: (prefix: string, fileName: string): string =>
      `${prefix}-${fileName.replace(/\s+/g, '-')}.png`,
  };
}
