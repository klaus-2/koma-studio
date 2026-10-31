/**
 * Headless sequential chapter queue over the local AIO batch transport.
 *
 * One chapter runs at a time. A chapter that throws becomes a `failed` outcome
 * and the next chapter still runs; aborting the queue's signal stops the run
 * and records the in-flight chapter plus every remaining chapter as `skipped`.
 *
 * There is no UI and no persistence here: the caller owns the chapter list and
 * decides what to do with the outcomes.
 */
import type { BatchMappingImage } from '@/pages/dashboard/lib/batch-mapping';
import {
  resolveBatchCapacity,
  runLocalAioBatchChunks,
  type BatchChunkState,
  type LocalAioBatchChunksResult,
  type LocalAioBatchOptions,
  type ResolvedBatchCapacity,
} from '@/pages/dashboard/lib/local-aio-batch';
import type { AioBatchImageResult } from '@/types/dashboard.types';

export type ChapterRunStatus = 'done' | 'failed' | 'skipped';

export interface ChapterOutcome {
  chapterId: string;
  status: ChapterRunStatus;
  /** Batch ids the chapter's chunks used; empty for failed/skipped chapters. */
  batchIds: string[];
  results: AioBatchImageResult[];
  /** Failure reason; null for `done` and `skipped`. */
  error: Error | null;
}

export interface ChapterSource {
  /** Stable caller-owned id; also the stop marker for `stopAfterChapterId`. */
  id: string;
  /** Human label for status messages; never used for identity. */
  label: string;
  images: ReadonlyArray<BatchMappingImage>;
  /** Fully resolved per-chapter pipeline options. */
  options: LocalAioBatchOptions;
}

export type ChapterRunResult = LocalAioBatchChunksResult;

export type RunChapter = (
  chapter: ChapterSource,
  signal: AbortSignal,
  onProgress: (completedUnits: number, totalUnits: number) => void,
) => Promise<ChapterRunResult>;

export interface RunChapterQueueInput {
  chapters: ReadonlyArray<ChapterSource>;
  signal: AbortSignal;
  runChapter: RunChapter;
  /**
   * Stop after this chapter settles (done or failed). An unknown id never
   * matches and the whole queue runs.
   */
  stopAfterChapterId?: string;
  onChapterStart?: (chapter: ChapterSource, index: number) => void;
  /** Per-chapter progress, passed through from the transport (stage units). */
  onChapterProgress?: (
    chapterId: string,
    completedUnits: number,
    totalUnits: number,
  ) => void;
  onChapterSettled?: (outcome: ChapterOutcome, index: number) => void;
}

export interface ChapterQueueResult {
  /** One outcome per input chapter, in input order. */
  outcomes: ChapterOutcome[];
  /** True when the signal ended the run (not a chapter failure or a stop). */
  aborted: boolean;
}

const skippedOutcome = (chapterId: string): ChapterOutcome => ({
  chapterId,
  status: 'skipped',
  batchIds: [],
  results: [],
  error: null,
});

export async function runChapterQueue({
  chapters,
  signal,
  runChapter,
  stopAfterChapterId,
  onChapterStart,
  onChapterProgress,
  onChapterSettled,
}: RunChapterQueueInput): Promise<ChapterQueueResult> {
  const outcomes: ChapterOutcome[] = [];
  let aborted = false;
  let stopRequested = false;

  const settle = (outcome: ChapterOutcome, index: number): void => {
    outcomes.push(outcome);
    onChapterSettled?.(outcome, index);
  };

  for (const [index, chapter] of chapters.entries()) {
    if (stopRequested || signal.aborted) {
      aborted = aborted || signal.aborted;
      settle(skippedOutcome(chapter.id), index);
      continue;
    }

    onChapterStart?.(chapter, index);

    try {
      const run = await runChapter(chapter, signal, (completedUnits, totalUnits) => {
        onChapterProgress?.(chapter.id, completedUnits, totalUnits);
      });
      settle(
        {
          chapterId: chapter.id,
          status: 'done',
          batchIds: run.batchIds,
          results: run.results,
          error: null,
        },
        index,
      );
    } catch (cause) {
      // Abort is a queue-level stop, not a chapter failure. Checking the signal
      // (instead of the error type) also covers a transport abort that throws
      // before its own AbortError reaches us.
      aborted = aborted || signal.aborted;
      settle(
        signal.aborted
          ? skippedOutcome(chapter.id)
          : {
              chapterId: chapter.id,
              status: 'failed',
              batchIds: [],
              results: [],
              error: cause instanceof Error ? cause : new Error(String(cause)),
            },
        index,
      );
    }

    if (stopAfterChapterId !== undefined && chapter.id === stopAfterChapterId) {
      stopRequested = true;
    }
  }

  return { outcomes, aborted };
}

export interface LocalBatchChapterRunnerInput {
  localApiUrl: string;
  /** Requested concurrency; the preflight may lower it. */
  concurrency: number;
  /** Capacity already resolved for this run; skips the extra preflight. */
  capacity?: ResolvedBatchCapacity['capacity'];
  /** Per-chunk state, tagged with the chapter that produced it. */
  onChunkState?: (chapter: ChapterSource, state: BatchChunkState) => void;
}

/**
 * Binds the queue to the local batch transport.
 *
 * The capacity preflight runs once per runner (not once per chapter);
 * `resolveBatchCapacity` already falls back to the conservative defaults
 * instead of throwing, so a failed preflight never blocks the queue.
 */
export const createLocalBatchChapterRunner = ({
  localApiUrl,
  concurrency,
  capacity: resolvedCapacity,
  onChunkState,
}: LocalBatchChapterRunnerInput): RunChapter => {
  let pendingCapacity: Promise<ResolvedBatchCapacity> | null = null;
  const capacity = (): Promise<ResolvedBatchCapacity> => {
    if (resolvedCapacity) {
      return Promise.resolve({ capacity: resolvedCapacity, fallback: false });
    }
    pendingCapacity ??= resolveBatchCapacity({ localApiUrl, concurrency });
    return pendingCapacity;
  };

  return async (chapter, signal, onProgress) => {
    const { capacity: batchCapacity } = await capacity();
    return runLocalAioBatchChunks({
      localApiUrl,
      images: chapter.images,
      options: chapter.options,
      capacity: batchCapacity,
      signal,
      onProgress,
      onChunkState: onChunkState
        ? (state) => onChunkState(chapter, state)
        : undefined,
    });
  };
};
