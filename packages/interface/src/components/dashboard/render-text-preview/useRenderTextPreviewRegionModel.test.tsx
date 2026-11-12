// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import type { AioTextRegion } from '../../../types/dashboard.types';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import {
  getRenderModePresetRevision,
  resetAllRenderModePresets,
  setRenderModePreset,
} from '../../../utils/renderModePresets';
import { useRenderTextPreviewRegionModel } from './useRenderTextPreviewRegionModel';

const buildRegion = (): AioTextRegion =>
  ({
    id: 'region-1',
    bbox: [0, 0, 320, 120],
    renderMode: 'auto',
    detectedRenderMode: 'text_bubble',
  }) as unknown as AioTextRegion;

const renderRegionModel = (regions: AioTextRegion[]) =>
  renderHook(
    ({ regions: value }: { regions: AioTextRegion[] }) =>
      useRenderTextPreviewRegionModel({
        regions: value,
        fallbackStyle: DEFAULT_RENDER_STYLE,
        imageWidth: 320,
        imageHeight: 420,
        translationNotesEnabled: false,
        onRegionsChange: () => undefined,
      }),
    { initialProps: { regions } },
  );

describe('useRenderTextPreviewRegionModel preset invalidation', () => {
  beforeEach(() => {
    resetAllRenderModePresets();
  });

  it('re-derives cached regions when a render-mode preset changes', () => {
    const region = buildRegion();
    const { result, rerender } = renderRegionModel([region]);
    const fontSizeBefore = result.current.regionsWithDefaults[0]?.renderStyle?.fontSize;
    expect(fontSizeBefore).not.toBe(99);

    setRenderModePreset('text_bubble', {
      fontFamily: DEFAULT_RENDER_STYLE.fontFamily,
      fontSize: 99,
      bold: false,
      italic: false,
      color: '#123456',
      outlineColor: '#000000',
      outlineWidth: 1,
      outlineEnabled: false,
      uppercase: false,
      detectGradient: false,
    });
    expect(getRenderModePresetRevision()).toBeGreaterThan(0);

    rerender({ regions: [region] });

    const derived = result.current.regionsWithDefaults[0]?.renderStyle?.fontSize;
    expect(derived).toBe(99);
  });
});
