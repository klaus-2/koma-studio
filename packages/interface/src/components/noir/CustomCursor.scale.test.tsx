import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiScaleStore } from '@koma/ui/stores/ui-scale-store';
import {
  applyUiScale,
  setUiScaleNativeZoomHandler,
} from '@koma/ui/utils/applyUiScale';

import { CustomCursorClassic } from './CustomCursorClassic';
import { CustomCursorNoir } from './CustomCursorNoir';

describe('CustomCursor UI scale coordinate normalization', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    setUiScaleNativeZoomHandler(null);
    useUiScaleStore.setState({ uiScale: 1, compactDensity: false });
  });

  afterEach(() => {
    setUiScaleNativeZoomHandler(null);
    useUiScaleStore.setState({ uiScale: 1, compactDensity: false });
    vi.unstubAllGlobals();
  });

  it.each([
    ['classic', CustomCursorClassic],
    ['noir', CustomCursorNoir],
  ] as const)(
    'divides clientX/clientY by CSS root zoom for %s cursor in browser fallback mode',
    (_label, CursorComponent) => {
      useUiScaleStore.setState({ uiScale: 1.25 });
      applyUiScale(1.25, false);

      const { container, unmount } = render(<CursorComponent />);
      act(() => {
        document.dispatchEvent(
          new MouseEvent('pointermove', { clientX: 500, clientY: 250, bubbles: true }),
        );
      });

      const dot = container.querySelector('.koma-cursor__dot') as HTMLDivElement | null;
      expect(dot?.style.transform).toBe('translate3d(400px, 200px, 0)');
      unmount();
    },
  );

  it('keeps 1:1 viewport coordinates when native WebView zoom is active', () => {
    setUiScaleNativeZoomHandler(() => true);
    useUiScaleStore.setState({ uiScale: 1.25 });
    applyUiScale(1.25, false);

    const { container, unmount } = render(<CustomCursorNoir />);
    act(() => {
      document.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 500, clientY: 250, bubbles: true }),
      );
    });

    const dot = container.querySelector('.koma-cursor__dot') as HTMLDivElement | null;
    expect(dot?.style.transform).toBe('translate3d(500px, 250px, 0)');
    unmount();
  });
});
