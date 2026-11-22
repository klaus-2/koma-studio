import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { AioDeviceInfo } from '@/models/aioStageCatalog';
import type { PipelineBatchItemResult } from '@/types/dashboard.types';
import type { BatchProgress } from '@/pages/dashboard/lib/batch-wire';

export interface AioStageTimingChapter {
  readonly label: string;
  stageSeconds: Record<string, number>;
}

export interface AioStageTimingPage {
  readonly key: string;
  readonly batchId: string;
  readonly index: number;
  readonly filename: string;
  readonly stageSeconds: Record<string, number>;
}

export type AioStageTimingProviderKind = 'local' | 'cloud' | null;

interface AioStageTimingState {
  chapters: Record<string, AioStageTimingChapter>;
  chapterOrder: string[];
  totals: Record<string, number>;
  bottleneck: string | null;
  providerLabel: string | null;
  providerKind: AioStageTimingProviderKind;
  cacheHitDetected: boolean;
  lastStageMs: number | null;
  pages: AioStageTimingPage[];
  reportBatchId: string | null;
  reportCapturedAt: string | null;
  resetForRun: () => void;
  setProviderLine: (
    label: string | null,
    kind: AioStageTimingProviderKind,
  ) => void;
  ingestWireProgress: (
    progress: BatchProgress,
    chapterKey: string,
    chapterLabel: string,
  ) => void;
  ingestReportItems: (
    batchId: string,
    items: readonly PipelineBatchItemResult[],
  ) => void;
}

const CACHE_HIT_TRANSLATION_SECONDS = 0.05;

export function deriveLocalProviderLabel(
  device: AioDeviceInfo | null,
): string | null {
  if (device === null) {
    return null;
  }
  return device.profile
    ? `${device.provider} · ${device.profile}`
    : device.provider;
}

interface IngestContext {
  lastBatchId: string | null;
  lastRaw: Record<string, number>;
}

const ingestContext: IngestContext = { lastBatchId: null, lastRaw: {} };

const readFinitePositive = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

type ReportItemWithTimings = PipelineBatchItemResult & {
  stage_timings: Record<string, number>;
};

const hasStageTimings = (
  item: PipelineBatchItemResult,
): item is ReportItemWithTimings =>
  item.stage_timings !== undefined &&
  Object.keys(item.stage_timings).length > 0;

export const useAioStageTimingStore = create<AioStageTimingState>()(
  devtools(
    (set, get) => ({
      chapters: {},
      chapterOrder: [],
      totals: {},
      bottleneck: null,
      providerLabel: null,
      providerKind: null,
      cacheHitDetected: false,
      lastStageMs: null,
      pages: [],
      reportBatchId: null,
      reportCapturedAt: null,

      resetForRun: () => {
        ingestContext.lastBatchId = null;
        ingestContext.lastRaw = {};
        set({
          chapters: {},
          chapterOrder: [],
          totals: {},
          bottleneck: null,
          providerLabel: null,
          providerKind: null,
          cacheHitDetected: false,
          lastStageMs: null,
          pages: [],
          reportBatchId: null,
          reportCapturedAt: null,
        });
      },

      setProviderLine: (label, kind) => {
        set({ providerLabel: label, providerKind: kind });
      },

      ingestWireProgress: (progress, chapterKey, chapterLabel) => {
        const raw = progress.stageSeconds;
        if (raw === null) {
          return;
        }

        if (ingestContext.lastBatchId !== progress.batchId) {
          ingestContext.lastBatchId = progress.batchId;
          ingestContext.lastRaw = {};
        }

        const delta: Record<string, number> = {};
        for (const [stage, seconds] of Object.entries(raw)) {
          const current = readFinitePositive(seconds);
          const previous = readFinitePositive(ingestContext.lastRaw[stage] ?? 0);
          const diff = current - previous;
          if (diff > 0) {
            delta[stage] = diff;
          }
        }
        ingestContext.lastRaw = { ...raw };
        if (Object.keys(delta).length === 0) {
          return;
        }

        const state = get();
        const existingChapter = state.chapters[chapterKey];
        const nextChapter: AioStageTimingChapter = existingChapter ?? {
          label: chapterLabel,
          stageSeconds: {},
        };

        const nextChapterSeconds: Record<string, number> = {
          ...nextChapter.stageSeconds,
        };
        const nextTotals: Record<string, number> = { ...state.totals };
        for (const [stage, seconds] of Object.entries(delta)) {
          nextChapterSeconds[stage] =
            (nextChapterSeconds[stage] ?? 0) + seconds;
          nextTotals[stage] = (nextTotals[stage] ?? 0) + seconds;
        }
        nextChapter.stageSeconds = nextChapterSeconds;

        const chapterOrder = existingChapter
          ? state.chapterOrder
          : [...state.chapterOrder, chapterKey];

        const bottleneckEntry = Object.entries(nextTotals)
          .filter(([, seconds]) => seconds > 0)
          .sort((left, right) => right[1] - left[1])[0];

        const translationTotal = nextChapterSeconds['translation'] ?? 0;
        const otherStageWork = Object.entries(nextChapterSeconds).some(
          ([stage, seconds]) => stage !== 'translation' && seconds > 0,
        );
        const cacheHitDetected =
          state.cacheHitDetected ||
          (otherStageWork &&
            progress.completed > 0 &&
            translationTotal < CACHE_HIT_TRANSLATION_SECONDS);

        set({
          chapters: {
            ...state.chapters,
            [chapterKey]: nextChapter,
          },
          chapterOrder,
          totals: nextTotals,
          bottleneck: bottleneckEntry ? bottleneckEntry[0] : null,
          cacheHitDetected,
          lastStageMs: progress.lastStageMs ?? state.lastStageMs,
        });
      },

      ingestReportItems: (batchId, items) => {
        const withTimings = items
          .filter(hasStageTimings)
          .sort((left, right) => left.index - right.index);
        if (withTimings.length === 0) {
          return;
        }
        const state = get();
        const pages = [...state.pages];
        for (const item of withTimings) {
          const key = `${batchId}:${item.index}`;
          const page: AioStageTimingPage = {
            key,
            batchId,
            index: item.index,
            filename: item.filename,
            stageSeconds: { ...item.stage_timings },
          };
          const existingIndex = pages.findIndex((entry) => entry.key === key);
          if (existingIndex >= 0) {
            pages[existingIndex] = page;
          } else {
            pages.push(page);
          }
        }
        set({
          pages,
          reportBatchId: batchId.length > 0 ? batchId : state.reportBatchId,
          reportCapturedAt: new Date().toISOString(),
        });
      },
    }),
    { name: 'aio-stage-timing-store' },
  ),
);
