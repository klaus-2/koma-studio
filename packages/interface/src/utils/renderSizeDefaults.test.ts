// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import {
  LEGACY_RENDER_SIZE_MAX,
  LEGACY_RENDER_SIZE_MIN,
  RENDER_SIZE_MAX,
  RENDER_SIZE_MIN,
  forceLegacyRenderSizesInPlace,
  forceRenderSizesInPlace,
  markWorkspaceRenderSizesMigrated,
  migrateRenderSizeCatalog,
  shouldMigrateWorkspaceRenderSizes,
} from './renderSizeDefaults';

const style = (fontSize: number, minFontSize: number) => ({
  fontFamily: 'Arial',
  fontSize,
  minFontSize,
  color: '#ffffff',
});

afterEach(() => {
  window.localStorage.clear();
});

describe('render size defaults migration', () => {
  it('forces both sizes on nested render text styles', () => {
    const aioStyle = style(40, 10);
    const sessionStyle = style(28, 9);
    const tree = {
      aio: { detectionsByImage: { 'img-1': [{ renderStyle: aioStyle }] } },
      typesetter: { sessionsByImage: { 'img-1': { snapshots: [{ regions: [{ renderStyle: sessionStyle }] }] } } },
    };

    forceRenderSizesInPlace(tree);

    expect(aioStyle).toMatchObject({
      fontSize: RENDER_SIZE_MAX,
      minFontSize: RENDER_SIZE_MIN,
    });
    expect(sessionStyle).toMatchObject({
      fontSize: RENDER_SIZE_MAX,
      minFontSize: RENDER_SIZE_MIN,
    });
  });

  it('leaves watermark text layers alone', () => {
    const watermark = {
      textLayer: {
        enabled: true,
        text: 'KŌMA Studio',
        fontFamily: 'Cabin',
        fontSize: 40,
        color: '#f8fafc',
        outlineColor: '#0b1120',
      },
    };

    forceRenderSizesInPlace(watermark);

    expect(watermark.textLayer.fontSize).toBe(40);
  });

  it('only rewrites uncustomised values in the session cache', () => {
    const cached = {
      a: style(LEGACY_RENDER_SIZE_MAX, LEGACY_RENDER_SIZE_MIN),
      b: style(24, 8),
    };

    forceLegacyRenderSizesInPlace(cached);

    expect(cached.a).toMatchObject({ fontSize: RENDER_SIZE_MAX, minFontSize: RENDER_SIZE_MIN });
    expect(cached.b).toMatchObject({ fontSize: 24, minFontSize: 8 });
  });

  it('rewrites each preset catalog once, per shape', () => {
    window.localStorage.setItem(
      'typography',
      JSON.stringify({ presets: [{ id: 'p1', style: style(40, 10) }] }),
    );
    window.localStorage.setItem(
      'modes',
      JSON.stringify({ presets: { text_bubble: { fontFamily: 'Arial', fontSize: 40 } } }),
    );

    migrateRenderSizeCatalog('typography');
    migrateRenderSizeCatalog('modes');

    expect(JSON.parse(window.localStorage.getItem('typography') ?? '')).toMatchObject({
      presets: [{ style: { fontSize: RENDER_SIZE_MAX, minFontSize: RENDER_SIZE_MIN } }],
    });
    expect(JSON.parse(window.localStorage.getItem('modes') ?? '')).toMatchObject({
      presets: { text_bubble: { fontSize: RENDER_SIZE_MAX } },
    });

    // A later edit is not clobbered by another read of the catalog.
    window.localStorage.setItem(
      'typography',
      JSON.stringify({ presets: [{ id: 'p1', style: style(30, 7) }] }),
    );
    migrateRenderSizeCatalog('typography');
    expect(JSON.parse(window.localStorage.getItem('typography') ?? '')).toMatchObject({
      presets: [{ style: { fontSize: 30, minFontSize: 7 } }],
    });
  });

  it('marks the workspace override after it is persisted', () => {
    expect(shouldMigrateWorkspaceRenderSizes()).toBe(true);
    markWorkspaceRenderSizesMigrated();
    expect(shouldMigrateWorkspaceRenderSizes()).toBe(false);
  });
});
