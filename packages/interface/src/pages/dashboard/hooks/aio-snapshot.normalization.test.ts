import { describe, expect, it } from 'vitest';

import { AIO_MANUAL_STAGE_ORDER } from '@/constants/dashboard.constants';
import {
  initializeManualProgress,
  normalizeSnapshotsForManualMode,
} from '@/pages/dashboard/hooks/aio-snapshot.normalization';
import type { SnapshotLabels } from '@/pages/dashboard/hooks/aio-snapshot.normalization';
import type {
  AioDownloadEntry,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
} from '@/types/dashboard.types';

const labels: SnapshotLabels = {
  detectText: 'Detect',
  recognizeText: 'OCR',
  getTranslations: 'Translate',
  segmentText: 'Segment',
  cleanImage: 'Clean',
  render: 'Render',
};

function snapshot(key: AioPipelineSnapshotKey): AioPipelineSnapshot {
  return {
    key,
    label: labels[key],
    detectionsByImage: { image: [] },
    selectedRegionByImage: { image: null },
    aioDownloads: [],
  };
}

describe('initializeManualProgress', () => {
  it('maps an automatic index by stage key instead of numeric position', () => {
    const result = initializeManualProgress({
      snapshots: [snapshot('detectText'), snapshot('render')],
      imageIds: ['image'],
      snapshotIndexByImage: { image: 1 },
      autoHistoryAvailable: true,
    });

    expect(result.image?.currentIndex).toBe(
      AIO_MANUAL_STAGE_ORDER.indexOf('render'),
    );
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 99])(
    'does not unlock history for invalid index %s',
    (index) => {
      const result = initializeManualProgress({
        snapshots: [snapshot('detectText')],
        imageIds: ['image'],
        snapshotIndexByImage: { image: index },
        autoHistoryAvailable: true,
      });

      expect(result.image?.currentIndex).toBe(0);
      expect(result.image?.unlockedMaxIndex).toBe(0);
    },
  );
});

describe('normalizeSnapshotsForManualMode', () => {
  it('uses current fallback downloads and does not expose them in early stages', () => {
    const download: AioDownloadEntry = {
      fileName: 'latest.png',
      sourceImageId: 'image',
      blob: new Blob(['latest']),
    };

    const result = normalizeSnapshotsForManualMode({
      snapshots: [],
      imageIds: ['image'],
      labels,
      fallbackDetections: { image: [] },
      fallbackSelection: { image: null },
      fallbackDownloads: [download],
    });

    expect(
      result.find((entry) => entry.key === 'detectText')?.aioDownloads,
    ).toEqual([]);
    expect(
      result.find((entry) => entry.key === 'render')?.aioDownloads,
    ).toEqual([download]);
  });

  it('creates independent containers and removes deleted-image data', () => {
    const existing = snapshot('detectText');
    existing.detectionsByImage.deleted = [];

    const result = normalizeSnapshotsForManualMode({
      snapshots: [existing],
      imageIds: ['image'],
      labels,
      fallbackDetections: {},
      fallbackSelection: {},
      fallbackDownloads: [],
    });

    const first = result[0];
    const second = result[1];

    expect(first?.detectionsByImage).not.toBe(existing.detectionsByImage);
    expect(first?.detectionsByImage).not.toBe(second?.detectionsByImage);
    expect(first?.detectionsByImage.deleted).toBeUndefined();
    expect(first?.selectedRegionByImage.image).toBeNull();
  });
});
