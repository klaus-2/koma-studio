import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  patchAioSnapshotStageForImage,
  syncManualStagePreviewToNextStage,
} from '@/pages/dashboard/hooks/aio-snapshot.commands';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import type {
  AioDownloadEntry,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
} from '@/types/dashboard.types';

const initialState = useAioPipelineStore.getState();

function snapshot(
  key: AioPipelineSnapshotKey,
  downloads: AioDownloadEntry[] = [],
): AioPipelineSnapshot {
  return {
    key,
    label: key,
    detectionsByImage: { image: [] },
    selectedRegionByImage: { image: null },
    aioDownloads: downloads,
  };
}

beforeEach(() => {
  useAioPipelineStore.setState(initialState, true);
});

afterEach(() => {
  useAioPipelineStore.setState(initialState, true);
});

describe('snapshot writes', () => {
  it('removes a stale target download when the source has none', () => {
    const staleDownload: AioDownloadEntry = {
      sourceImageId: 'image',
      fileName: 'stale.png',
      blob: new Blob(['stale']),
    };
    const unrelated: AioDownloadEntry = {
      sourceImageId: 'other',
      fileName: 'other.png',
      blob: new Blob(['other']),
    };

    useAioPipelineStore.setState({
      aioPipelineSnapshots: [
        snapshot('cleanImage'),
        snapshot('render', [staleDownload, unrelated]),
      ],
    });

    syncManualStagePreviewToNextStage('image', 0, 1);

    expect(
      useAioPipelineStore.getState().aioPipelineSnapshots[1]?.aioDownloads,
    ).toEqual([unrelated]);
  });

  it('preserves state identity for an unchanged patch', () => {
    useAioPipelineStore.setState({
      aioPipelineSnapshots: [snapshot('detectText')],
    });
    const before = useAioPipelineStore.getState();

    patchAioSnapshotStageForImage('image', 0, []);

    expect(useAioPipelineStore.getState()).toBe(before);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 99])(
    'ignores invalid snapshot index %s',
    (index) => {
      useAioPipelineStore.setState({
        aioPipelineSnapshots: [snapshot('detectText')],
      });
      const before = useAioPipelineStore.getState();

      patchAioSnapshotStageForImage('image', index, []);

      expect(useAioPipelineStore.getState()).toBe(before);
    },
  );

  it('rejects a download belonging to another image', () => {
    expect(() =>
      patchAioSnapshotStageForImage('image', 0, [], {
        sourceImageId: 'other',
        fileName: 'other.png',
        blob: new Blob(),
      }),
    ).toThrow('AIO_DOWNLOAD_IMAGE_MISMATCH');
  });

  it('does not retain ownership of the supplied download object', () => {
    useAioPipelineStore.setState({
      aioPipelineSnapshots: [snapshot('render')],
    });
    const download: AioDownloadEntry = {
      sourceImageId: 'image',
      fileName: 'original.png',
      blob: new Blob(),
    };

    patchAioSnapshotStageForImage('image', 0, [], download);
    download.fileName = 'mutated.png';

    expect(
      useAioPipelineStore.getState().aioPipelineSnapshots[0]
        ?.aioDownloads[0]?.fileName,
    ).toBe('original.png');
  });
});
