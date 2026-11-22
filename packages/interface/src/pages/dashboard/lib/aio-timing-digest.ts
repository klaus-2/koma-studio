import type { AioStageTimingPage } from '../stores/aio-stage-timing-store';

export interface AioTimingDigestInput {
  readonly pages: readonly AioStageTimingPage[];
  readonly totals: Record<string, number>;
  readonly batchId: string | null;
  readonly capturedAt: string | null;
}

const DIGEST_STAGE_ORDER = [
  'detect',
  'ocr',
  'translation',
  'segment',
  'clean',
] as const;

export const formatDigestSeconds = (seconds: number): string =>
  `${Math.round(seconds * 10) / 10}s`;

const orderedStageEntries = (
  stageSeconds: Record<string, number>,
): Array<[string, number]> => {
  const known: Array<[string, number]> = [];
  const unknown: Array<[string, number]> = [];
  for (const entry of Object.entries(stageSeconds)) {
    const [stage, seconds] = entry;
    if (!(seconds > 0)) {
      continue;
    }
    const rank = DIGEST_STAGE_ORDER.indexOf(
      stage as (typeof DIGEST_STAGE_ORDER)[number],
    );
    if (rank >= 0) {
      known.push([stage, seconds]);
    } else {
      unknown.push([stage, seconds]);
    }
  }
  known.sort(
    (left, right) =>
      DIGEST_STAGE_ORDER.indexOf(left[0] as (typeof DIGEST_STAGE_ORDER)[number]) -
      DIGEST_STAGE_ORDER.indexOf(right[0] as (typeof DIGEST_STAGE_ORDER)[number]),
  );
  unknown.sort((left, right) => left[0].localeCompare(right[0]));
  return [...known, ...unknown];
};

export const buildAioTimingDigest = ({
  pages,
  totals,
  batchId,
  capturedAt,
}: AioTimingDigestInput): string => {
  const lines: string[] = ['AIO timing report'];
  if (batchId !== null && batchId.length > 0) {
    lines.push(`batch: ${batchId}`);
  }
  if (capturedAt !== null && capturedAt.length > 0) {
    lines.push(`captured: ${capturedAt}`);
  }
  const totalEntries = orderedStageEntries(totals);
  if (totalEntries.length > 0) {
    lines.push(
      `totals: ${totalEntries
        .map(([stage, seconds]) => `${stage} ${formatDigestSeconds(seconds)}`)
        .join('; ')}`,
    );
  }
  for (const page of pages) {
    const entries = orderedStageEntries(page.stageSeconds);
    const stagePart = entries
      .map(([stage, seconds]) => `${stage}: ${formatDigestSeconds(seconds)}`)
      .join('; ');
    const pageTotal = entries.reduce((sum, [, seconds]) => sum + seconds, 0);
    lines.push(
      stagePart.length > 0
        ? `${page.filename} — ${stagePart}; total: ${formatDigestSeconds(pageTotal)}`
        : `${page.filename} — total: ${formatDigestSeconds(pageTotal)}`,
    );
  }
  return lines.join('\n');
};
