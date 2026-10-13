import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFontCatalogOptions } from '../hooks/useFontCatalogOptions';
import { APP_WEBFONT_FAMILIES } from '../constants/app-webfonts';
import {
  getFontCatalogSnapshot,
  publishFontCatalog,
  subscribeFontCatalog,
} from './font-catalog-cache';

vi.mock('@/lib/desktop-bridge', () => ({
  desktopBridge: {
    desktop: { api: { fonts: { list: async () => ({ system: [], custom: [] }) } } },
  },
}));

describe('font-catalog-cache', () => {
  it('seeds a read-only consumer with exactly the families the dock shows before fonts:list answers', () => {
    const snapshot = getFontCatalogSnapshot();

    expect(snapshot).toHaveLength(APP_WEBFONT_FAMILIES.length);
    for (const family of APP_WEBFONT_FAMILIES) {
      expect(snapshot).toContain(family);
    }
    expect(getFontCatalogSnapshot()).toBe(snapshot);
  });

  it('hands subscribers the identical array reference that was published', () => {
    const published = ['Cabin', 'JetBrains Mono'];
    const listener = vi.fn<() => void>();

    const unsubscribe = subscribeFontCatalog(listener);
    publishFontCatalog(published);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getFontCatalogSnapshot()).toBe(published);

    unsubscribe();
    publishFontCatalog(['Manrope']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps one array reference across two publishes of equal content', () => {
    const first = ['Archivo', 'Cabin'];
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeFontCatalog(listener);

    publishFontCatalog(first);
    publishFontCatalog(['Archivo', 'Cabin']);

    expect(getFontCatalogSnapshot()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('notifies subscribers again when the published content really changes', () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeFontCatalog(listener);

    publishFontCatalog(['Instrument Serif']);
    publishFontCatalog(['Instrument Serif', 'Ubuntu Mono']);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(getFontCatalogSnapshot()).toEqual(['Instrument Serif', 'Ubuntu Mono']);
    unsubscribe();
  });

  it('returns the published array from useFontCatalogOptions', () => {
    const published = ['Manrope', 'Cabin'];
    const { result } = renderHook(() => useFontCatalogOptions());

    expect(result.current.length).toBeGreaterThan(0);

    act(() => {
      publishFontCatalog(published);
    });

    expect(result.current).toBe(published);
  });
});
