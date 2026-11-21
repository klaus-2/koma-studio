import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import type { AioTextRegion } from '../types/dashboard.types';
import type { TypographyStylePreset } from './types';
import {
  applyTypographyPresetToRegionBody,
  usePresetPreviewOverride,
} from './presetPreview';
import {
  publishPresetPreview,
  subscribePresetPreview,
} from './presetPreviewSignal';

const region = (id: string, fontFamily: string): AioTextRegion =>
  ({
    id,
    bbox: [10, 10, 110, 60],
    renderStyle: { ...DEFAULT_RENDER_STYLE, fontFamily },
  }) as unknown as AioTextRegion;

const preset = (id: string): TypographyStylePreset => ({
  id,
  folderId: null,
  name: 'Preview Preset',
  description: '',
  style: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Preset Font', fontSize: 33 },
  defaultShapeKind: 'rounded',
  padding: 4,
  createdAt: 0,
  updatedAt: 0,
});

describe('applyTypographyPresetToRegionBody (shared committed/preview body)', () => {
  it('rebuilds style, shape and stylePresetId from the preset', () => {
    const next = applyTypographyPresetToRegionBody(
      region('r-1', 'Region Font'),
      preset('p-1'),
      DEFAULT_RENDER_STYLE,
    );
    expect(next.renderStyle?.fontFamily).toBe('Preset Font');
    expect(next.stylePresetId).toBe('p-1');
    expect(next.shape?.kind).toBe('rounded');
    expect(next.id).toBe('r-1');
    expect(next.bbox).toEqual([10, 10, 110, 60]);
  });
});

describe('usePresetPreviewOverride (list hover -> active region)', () => {
  afterEach(() => {
    publishPresetPreview(null);
  });

  it('applies the hovered-list preset to the ACTIVE region without canvas hover', () => {
    publishPresetPreview('p-1');
    const r1 = region('r-1', 'Region Font');
    const r2 = region('r-2', 'Region Font');
    const { result } = renderHook(() =>
      usePresetPreviewOverride('r-1', [r1, r2], DEFAULT_RENDER_STYLE, [preset('p-1')]),
    );
    expect(result.current).not.toBeNull();
    expect(result.current?.regionId).toBe('r-1');
    expect(result.current?.region.renderStyle?.fontFamily).toBe('Preset Font');
    expect(result.current?.region.stylePresetId).toBe('p-1');
    expect(r1.renderStyle?.fontFamily).toBe('Region Font');
  });

  it('prefers the first multi-selected region over the single selected one', () => {
    publishPresetPreview('p-1');
    const { result } = renderHook(() =>
      usePresetPreviewOverride('r-2', [region('r-1', 'Region Font'), region('r-2', 'Region Font')], DEFAULT_RENDER_STYLE, [preset('p-1')]),
    );
    expect(result.current?.regionId).toBe('r-2');
    expect(result.current?.region.renderStyle?.fontFamily).toBe('Preset Font');
  });

  it('returns null for a null target id (no active region) with a published preset', () => {
    publishPresetPreview('p-1');
    const { result } = renderHook(() =>
      usePresetPreviewOverride(null, [region('r-1', 'Region Font')], DEFAULT_RENDER_STYLE, [preset('p-1')]),
    );
    expect(result.current).toBeNull();
  });

  it('returns null when the target id is not among the painted regions', () => {
    publishPresetPreview('p-1');
    const { result } = renderHook(() =>
      usePresetPreviewOverride('missing', [region('r-1', 'Region Font')], DEFAULT_RENDER_STYLE, [preset('p-1')]),
    );
    expect(result.current).toBeNull();
  });

  it('returns null while no list row is hovered even with an active target', () => {
    publishPresetPreview(null);
    const { result } = renderHook(() =>
      usePresetPreviewOverride('r-1', [region('r-1', 'Region Font')], DEFAULT_RENDER_STYLE, [preset('p-1')]),
    );
    expect(result.current).toBeNull();
  });

  it('returns null when the published preset id is unknown to the caller', () => {
    publishPresetPreview('p-404');
    const { result } = renderHook(() =>
      usePresetPreviewOverride('r-1', [region('r-1', 'Region Font')], DEFAULT_RENDER_STYLE, [preset('p-1')]),
    );
    expect(result.current).toBeNull();
  });
});

describe('presetPreviewSignal (ephemeral pub/sub)', () => {
  it('publishes to subscribers and clears on null', () => {
    const seen: Array<string | null> = [];
    const unsubscribe = subscribePresetPreview((value) => seen.push(value));
    publishPresetPreview('p-1');
    expect(seen).toEqual(['p-1']);
    publishPresetPreview(null);
    expect(seen).toEqual(['p-1', null]);
    unsubscribe();
    publishPresetPreview('p-2');
    expect(seen).toEqual(['p-1', null]);
  });

  it('does not notify when the signal does not change', () => {
    const seen: Array<string | null> = [];
    const unsubscribe = subscribePresetPreview((value) => seen.push(value));
    publishPresetPreview('p-1');
    publishPresetPreview('p-1');
    unsubscribe();
    expect(seen).toEqual(['p-1']);
  });

  it('does not replay the current value to later subscribers', () => {
    publishPresetPreview('p-3');
    const seen: Array<string | null> = [];
    const unsubscribe = subscribePresetPreview((value) => seen.push(value));
    expect(seen).toEqual([]);
    publishPresetPreview(null);
    expect(seen).toEqual([null]);
    unsubscribe();
  });
});
