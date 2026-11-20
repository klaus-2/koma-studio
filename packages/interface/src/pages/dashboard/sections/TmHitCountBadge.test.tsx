// @vitest-environment jsdom
import { Profiler } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setDesktopBridgeProvider } from '../../../lib/desktop-bridge';
import { I18nProvider } from '../../../i18n';
import TmHitCountBadge from './TmHitCountBadge';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useTranslatorStore } from '../stores/translator-store';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type { AioTextRegion } from '../../../types/dashboard.types';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const region = (
  id: string,
  source: 'tm' | 'engine',
): AioTextRegion => ({
  id,
  bbox: [10, 10, 110, 60],
  score: 0.9,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
  renderStyle: { ...DEFAULT_RENDER_STYLE },
  translationSource: source,
});

let renderCount = 0;

const renderBadge = (): void => {
  renderCount = 0;
  render(
    <I18nProvider>
      <Profiler
        id="tm-hit-count-badge"
        onRender={() => {
          renderCount++;
        }}
      >
        <TmHitCountBadge noir={false} />
      </Profiler>
    </I18nProvider>,
  );
};

const detections = (): Record<string, AioTextRegion[]> => ({
  'img-1': [region('r-1', 'tm'), region('r-2', 'engine')],
  'img-2': [region('r-3', 'tm'), region('r-4', 'tm'), region('r-5', 'tm')],
});

beforeEach(() => {
  useImageCollectionStore.setState({ activeId: 'img-1' });
  useTranslatorStore.setState({
    translatorDetectionsByImage: detections(),
  });
});

afterEach(cleanup);

describe('TmHitCountBadge per-id subscription (I11)', () => {
  it('counts TM hits and region totals of the active image only', () => {
    renderBadge();
    expect(document.body.textContent).toContain('TM hits: 1 / 2');
  });

  it("does not re-render when another image's detections change", () => {
    renderBadge();
    const baseline = renderCount;

    act(() => {
      const current = useTranslatorStore.getState().translatorDetectionsByImage;
      useTranslatorStore.setState({
        translatorDetectionsByImage: {
          ...current,
          'img-2': [region('r-9', 'engine')],
        },
      });
    });

    expect(renderCount).toBe(baseline);
    expect(document.body.textContent).toContain('TM hits: 1 / 2');
  });

  it("re-renders only when the active image's array identity changes", () => {
    renderBadge();
    const baseline = renderCount;

    act(() => {
      const current = useTranslatorStore.getState().translatorDetectionsByImage;
      useTranslatorStore.setState({
        translatorDetectionsByImage: {
          ...current,
          'img-1': [region('r-1', 'tm'), region('r-2', 'tm')],
        },
      });
    });

    expect(renderCount).toBe(baseline + 1);
    expect(document.body.textContent).toContain('TM hits: 2 / 2');
  });

  it('renders zero counts for an image without detections', () => {
    useImageCollectionStore.setState({ activeId: 'img-empty' });
    renderBadge();
    expect(document.body.textContent).toContain('TM hits: 0 / 0');
  });
});
