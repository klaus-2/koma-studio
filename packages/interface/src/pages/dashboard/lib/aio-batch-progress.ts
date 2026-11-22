export interface AioBatchProgress {
  /** 1-based position of the chapter the queue is running. */
  readonly chapterIndex: number;
  readonly chapterCount: number;
  readonly chapterLabel: string;
  /** Localized display label of the in-flight stage, or null before one runs. */
  readonly stageLabel: string | null;
  /** Null until enough of the run has completed to estimate a rate. */
  readonly etaSeconds: number | null;
}

export interface EtaUnitLabels {
  readonly second: string;
  readonly minute: string;
}

interface EstimateRemainingInput {
  readonly elapsedMs: number;
  readonly completedImages: number;
  readonly totalImages: number;
}

/**
 * Projects the remaining wall-clock time from the run's observed image rate.
 * Returns null before any image completed (no rate to extrapolate yet).
 */
export function estimateRemainingSeconds({
  elapsedMs,
  completedImages,
  totalImages,
}: EstimateRemainingInput): number | null {
  if (
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0 ||
    !Number.isFinite(completedImages) ||
    completedImages <= 0 ||
    !Number.isFinite(totalImages) ||
    totalImages <= completedImages
  ) {
    return null;
  }

  const secondsPerImage = elapsedMs / completedImages / 1000;

  return Math.max(1, Math.round((totalImages - completedImages) * secondsPerImage));
}

export interface SingleBatchProgressInput {
  readonly runStartedAt: number;
  readonly nowMs: number;
  readonly startedUnits: number;
  readonly totalUnits: number;
  readonly totalImages: number;
  readonly stageLabel: string | null;
}

export function buildSingleBatchProgress(
  input: SingleBatchProgressInput,
): AioBatchProgress {
  const startedImages = input.totalUnits > 0
    ? (Math.max(0, input.startedUnits) / input.totalUnits) * input.totalImages
    : 0;
  return {
    chapterIndex: 1,
    chapterCount: 1,
    chapterLabel: '',
    stageLabel: input.stageLabel,
    etaSeconds: estimateRemainingSeconds({
      elapsedMs: input.nowMs - input.runStartedAt,
      completedImages: startedImages,
      totalImages: input.totalImages,
    }),
  };
}

export function formatEta(
  seconds: number | null,
  units: EtaUnitLabels,
): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))}${units.second}`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  return rest > 0
    ? `${minutes}${units.minute} ${rest}${units.second}`
    : `${minutes}${units.minute}`;
}
