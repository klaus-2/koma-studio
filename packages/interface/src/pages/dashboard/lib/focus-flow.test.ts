import { describe, expect, it } from 'vitest';

import {
  buildFocusFlowState,
  findDisabledFocusStages,
  findNextUnreviewedPageId,
  FULL_FOCUS_STAGE_TOGGLES,
  type FocusFlowInputs,
} from './focus-flow';

const baseInputs = (overrides: Partial<FocusFlowInputs> = {}): FocusFlowInputs => ({
  images: [],
  processedById: {},
  detectionsByImage: {},
  downloadImageIds: new Set<string>(),
  reviewedImageIds: [],
  ...overrides,
});

const region = (text: string) => ({
  renderText: text,
  translatedText: text,
  recognizedText: 'raw',
});

describe('buildFocusFlowState', () => {
  it('starts on the pages step with an empty workspace', () => {
    const flow = buildFocusFlowState(baseInputs());
    expect(flow.step).toBe('pages');
    expect(flow.canRun).toBe(false);
    expect(flow.canExport).toBe(false);
  });

  it('asks for a run once pages exist but none are processed', () => {
    const flow = buildFocusFlowState(
      baseInputs({ images: [{ id: 'p1' }, { id: 'p2' }] }),
    );
    expect(flow.step).toBe('run');
    expect(flow.canRun).toBe(true);
    expect(flow.canExport).toBe(false);
  });

  it('treats flagged pages as processed and counts empty bubbles', () => {
    const flow = buildFocusFlowState(
      baseInputs({
        images: [{ id: 'p1' }],
        processedById: { p1: true },
        detectionsByImage: {
          p1: [region('Olá'), region(''), { recognizedText: '…' }],
        },
      }),
    );
    expect(flow.step).toBe('review');
    expect(flow.pages[0]?.processed).toBe(true);
    expect(flow.pages[0]?.regionCount).toBe(3);
    expect(flow.pages[0]?.emptyRegionCount).toBe(2);
    expect(flow.emptyRegionTotal).toBe(2);
    expect(flow.canExport).toBe(true);
  });

  it('recognises processed pages from downloads and restored regions', () => {
    const byDownload = buildFocusFlowState(
      baseInputs({
        images: [{ id: 'p1' }],
        downloadImageIds: new Set(['p1']),
      }),
    );
    expect(byDownload.pages[0]?.processed).toBe(true);

    const byRegions = buildFocusFlowState(
      baseInputs({
        images: [{ id: 'p1' }],
        detectionsByImage: { p1: [region('Pronto')] },
      }),
    );
    expect(byRegions.pages[0]?.processed).toBe(true);
  });

  it('does not count detection-only regions as processed', () => {
    const flow = buildFocusFlowState(
      baseInputs({
        images: [{ id: 'p1' }],
        detectionsByImage: { p1: [{ recognizedText: 'こんにちは' }] },
      }),
    );
    expect(flow.pages[0]?.processed).toBe(false);
    expect(flow.step).toBe('run');
  });

  it('reaches the export step when every processed page is reviewed', () => {
    const flow = buildFocusFlowState(
      baseInputs({
        images: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        processedById: { p1: true, p2: true },
        reviewedImageIds: ['p1', 'p2', 'p3'],
      }),
    );
    expect(flow.step).toBe('export');
    expect(flow.processedPages).toBe(2);
    // p3 was never processed: its review mark must not inflate progress.
    expect(flow.reviewedPages).toBe(2);
    expect(flow.unreviewedPageIds).toEqual([]);
  });
});

describe('findNextUnreviewedPageId', () => {
  const flow = buildFocusFlowState(
    baseInputs({
      images: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }],
      processedById: { p1: true, p2: true, p3: true, p4: true },
      reviewedImageIds: ['p2'],
    }),
  );

  it('advances in page order, skipping reviewed pages', () => {
    expect(findNextUnreviewedPageId(flow, 'p1')).toBe('p3');
    expect(findNextUnreviewedPageId(flow, null)).toBe('p1');
  });

  it('previews the queue with the page being marked right now', () => {
    expect(findNextUnreviewedPageId(flow, 'p3', 'p3')).toBe('p4');
    expect(findNextUnreviewedPageId(flow, 'p4', 'p4')).toBe('p1');
  });

  it('returns null when the queue is drained', () => {
    const done = buildFocusFlowState(
      baseInputs({
        images: [{ id: 'p1' }],
        processedById: { p1: true },
        reviewedImageIds: ['p1'],
      }),
    );
    expect(findNextUnreviewedPageId(done, 'p1')).toBeNull();
  });
});

describe('findDisabledFocusStages', () => {
  it('reports disabled stages in pipeline order', () => {
    expect(findDisabledFocusStages(FULL_FOCUS_STAGE_TOGGLES)).toEqual([]);
    expect(
      findDisabledFocusStages({
        ...FULL_FOCUS_STAGE_TOGGLES,
        cleanImage: false,
        detectText: false,
      }),
    ).toEqual(['detectText', 'cleanImage']);
  });
});
