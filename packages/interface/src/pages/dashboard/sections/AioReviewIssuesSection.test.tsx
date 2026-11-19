// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AioReviewIssuesSection, {
  AIO_REVIEW_FILTER_STORAGE_KEY,
  AIO_REVIEW_FILTER_KINDS,
  type AioReviewFilterKind,
} from './AioReviewIssuesSection';
import RegionIssuesPanel from '@/components/dashboard/RegionIssuesPanel';
import type { RegionIssueNavRow } from '@/components/dashboard/RegionIssuesPanel';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { DEFAULT_RENDER_STYLE } from '@/constants/dashboard.constants';
import type {
  AioTextRegion,
  ImageFilters,
} from '@/types/dashboard.types';
import type { DirectPageFile } from '@/utils/page-source';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const focusRegionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../hooks/useRegionFocusScroll', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../hooks/useRegionFocusScroll')>();
  return { ...actual, useRegionFocusScroll: () => ({ focusRegion: focusRegionMock }) };
});

vi.mock('@/components/dashboard/render-text-preview/canvasDrawing', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/components/dashboard/render-text-preview/canvasDrawing')
    >();
  return {
    ...actual,
    createRegionTextMeasurer:
      () =>
      (
        targetRegion: AioTextRegion,
        fontSizeOverride: number | undefined,
      ) => {
        const style = targetRegion.renderStyle;
        const fontSize =
          fontSizeOverride ?? (style ? style.fontSize : undefined);
        const text = (targetRegion.renderText ?? '').trim();
        if (fontSize === undefined || text.length === 0) return null;
        return {
          textWidth: text.length * 1.2 * fontSize,
          textHeight: fontSize * 1.2,
          fontSize,
        };
      },
  };
});

const directPage = (): DirectPageFile => {
  const file = new File([], 'page.png');
  return {
    kind: 'direct',
    name: 'page.png',
    type: 'image/png',
    size: 0,
    lastModified: 0,
    resident: file,
    toBlob: async () => file,
    dimensions: async () => ({ width: 100, height: 40 }),
    release: () => {},
  };
};

const filters: ImageFilters = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
};

const region = (
  id: string,
  overrides: Partial<AioTextRegion> = {},
): AioTextRegion => ({
  id,
  bbox: [0, 0, 100, 40],
  score: 1,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
  renderText: 'Hello',
  renderStyle: {
    ...DEFAULT_RENDER_STYLE,
    ...overrides.renderStyle,
  },
  ...overrides,
});

const seedStores = (regions: AioTextRegion[]): void => {
  useImageCollectionStore.setState({
    images: [
      {
        id: 'img-1',
        file: directPage(),
        url: 'blob:img-1',
        width: 100,
        height: 40,
        rotation: 0,
        filters,
      },
      {
        id: 'img-2',
        file: directPage(),
        url: 'blob:img-2',
        width: 100,
        height: 40,
        rotation: 0,
        filters,
      },
    ],
    activeId: 'img-1',
  });
  useRegionEditorStore.setState({
    aioDetectionsByImage: { 'img-1': regions, 'img-2': [] },
    aioSelectedRegionByImage: {},
  });
};

const renderSection = (noir = false): ReturnType<typeof render> => {
  const view = render(
    <I18nProvider>
      <AioReviewIssuesSection noir={noir} />
    </I18nProvider>,
  );
  const header = screen.getByRole('button', { name: /Pending issues/ });
  act(() => {
    header.click();
  });
  return view;
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('AioReviewIssuesSection', () => {
  it('derives locked rows (flag and lockedFields) and sfx rows with counts', async () => {
    seedStores([
      region('plain'),
      region('legacy-locked', { locked: true }),
      region('field-locked', { lockedFields: { text: true } }),
      region('sfx-one', { sfxCandidate: true }),
      region('locked-and-sfx', {
        locked: true,
        sfxCandidate: true,
      }),
    ]);
    renderSection();

    const lockedChip = screen.getByRole('button', { name: /^Locked · / });
    expect(lockedChip.textContent).toContain('3');
    const sfxChip = screen.getByRole('button', { name: /^SFX · / });
    expect(sfxChip.textContent).toContain('2');
  });

  it('keeps untranslated/overflow counts derived from the issue kinds', async () => {
    seedStores([
      region('echoed', {
        bbox: [0, 0, 1000, 1000],
        translatedText: 'Hello',
        recognizedText: 'Hello',
      }),
      region('overflowing', {
        bbox: [0, 0, 1, 1],
        translatedText: 'Hi',
        recognizedText: 'Yo',
        renderStyle: {
          ...DEFAULT_RENDER_STYLE,
          fontSize: 40,
          minFontSize: 8,
          autoFontSize: false,
        },
      }),
    ]);
    renderSection();

    expect(
      screen.getByRole('button', { name: /^Untranslated · 1/ }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^Overflow · 1/ })).toBeDefined();
  });

  it('filters the combined list when a chip is active', async () => {
    const user = userEvent.setup();
    seedStores([
      region('echo', {
        bbox: [0, 0, 1000, 1000],
        translatedText: 'Dialogue',
        recognizedText: 'Dialogue',
      }),
      region('sfx-only', { sfxCandidate: true, renderText: 'Boom!' }),
    ]);
    renderSection();

    expect(screen.getByRole('group', { name: 'Pending translation issues' }).textContent).toContain('SFX');
    expect(screen.getByRole('group', { name: 'Pending translation issues' }).textContent).toContain('Dialogue');

    await user.click(screen.getByRole('button', { name: /^SFX · / }));
    expect(screen.getByRole('group', { name: 'Pending translation issues' }).textContent).toContain('Boom!');
    expect(screen.getByRole('group', { name: 'Pending translation issues' }).textContent).not.toContain('Dialogue');

    await user.click(screen.getByRole('button', { name: /^Untranslated · / }));
    expect(screen.getByRole('group', { name: 'Pending translation issues' }).textContent).toContain('Dialogue');
    expect(screen.getByRole('group', { name: 'Pending translation issues' }).textContent).not.toContain('Boom!');
  });

  it('persists the filter choice in localStorage and restores it', async () => {
    const user = userEvent.setup();
    seedStores([
      region('sfx-only', { sfxCandidate: true }),
    ]);
    renderSection();

    await user.click(screen.getByRole('button', { name: /^SFX · / }));
    expect(window.localStorage.getItem(AIO_REVIEW_FILTER_STORAGE_KEY)).toBe('sfx');

    cleanup();
    seedStores([region('sfx-only', { sfxCandidate: true })]);
    renderSection();

    const activeChip = screen.getByRole('button', { name: /^SFX · / });
    expect(activeChip.getAttribute('aria-pressed')).toBe('true');
  });

  it('falls back to "all" for an invalid stored value', () => {
    seedStores([region('plain')]);
    window.localStorage.setItem(AIO_REVIEW_FILTER_STORAGE_KEY, 'bogus');
    renderSection();

    const allChip = screen.getByRole('button', { name: /^All · / });
    expect(allChip.getAttribute('aria-pressed')).toBe('true');
  });

  it('focuses the region after selecting an issue (selection first)', async () => {
    const user = userEvent.setup();
    seedStores([
      region('echo', {
        bbox: [0, 0, 1000, 1000],
        translatedText: 'Dialogue',
        recognizedText: 'Dialogue',
      }),
    ]);
    renderSection();
    await user.click(screen.getByRole('button', { name: /Untranslated\s*Dialogue/ }));

    expect(useImageCollectionStore.getState().activeId).toBe('img-1');
    expect(focusRegionMock).toHaveBeenCalledWith({
      imageId: 'img-1',
      regionId: 'echo',
    });
  });

  it('shows the empty state when there are no issues at all', () => {
    seedStores([]);
    renderSection();
    expect(screen.getByText('No pending issues.')).toBeDefined();
  });
});

describe('RegionIssuesPanel additionalRows', () => {
  const navRow = (overrides: Partial<RegionIssueNavRow> = {}): RegionIssueNavRow => ({
    imageId: 'img-1',
    regionId: 'r-nav',
    badgeLabelKey: 'dashboard.aio.review.filter.locked' as never,
    detail: 'Locked region detail',
    ...overrides,
  });

  const renderPanel = (props: {
    issues: never[];
    additionalRows?: readonly RegionIssueNavRow[];
    onSelectNavRow?: (row: RegionIssueNavRow) => void;
  }): ReturnType<typeof render> =>
    render(
      <I18nProvider>
        <RegionIssuesPanel
          noir={false}
          issues={props.issues}
          additionalRows={props.additionalRows}
          onSelectNavRow={props.onSelectNavRow}
          onSelect={() => {}}
        />
      </I18nProvider>,
    );

  it('renders additional rows after the issues, same grouping', () => {
    useImageCollectionStore.setState({
      images: [
        {
          id: 'img-1',
          file: directPage(),
          url: 'blob:img-1',
          width: 100,
          height: 40,
          rotation: 0,
          filters,
        },
      ],
      activeId: 'img-1',
    });
    renderPanel({ issues: [], additionalRows: [navRow()] });

    expect(screen.getByText('Locked region detail')).toBeDefined();
    expect(screen.getByRole('button', { name: /Locked region detail/ })).toBeDefined();
  });

  it('keeps the empty state when neither issues nor rows exist', () => {
    useImageCollectionStore.setState({
      images: [
        {
          id: 'img-1',
          file: directPage(),
          url: 'blob:img-1',
          width: 100,
          height: 40,
          rotation: 0,
          filters,
        },
      ],
      activeId: 'img-1',
    });
    renderPanel({ issues: [] });
    expect(screen.getByText('No pending issues.')).toBeDefined();
  });

  it('navigates through onSelectNavRow', async () => {
    const user = userEvent.setup();
    useImageCollectionStore.setState({
      images: [
        {
          id: 'img-1',
          file: directPage(),
          url: 'blob:img-1',
          width: 100,
          height: 40,
          rotation: 0,
          filters,
        },
      ],
      activeId: 'img-1',
    });
    const onSelectNavRow = vi.fn();
    renderPanel({ issues: [], additionalRows: [navRow()], onSelectNavRow });

    await user.click(screen.getByRole('button', { name: /Locked region detail/ }));
    expect(onSelectNavRow).toHaveBeenCalledOnce();
    expect(onSelectNavRow.mock.calls[0]?.[0]).toMatchObject({
      imageId: 'img-1',
      regionId: 'r-nav',
    });
  });
});

describe('filter chip constants', () => {
  it('exposes the five review filters in order', () => {
    expect(AIO_REVIEW_FILTER_KINDS).toEqual([
      'all',
      'untranslated',
      'overflow',
      'locked',
      'sfx',
    ] satisfies readonly AioReviewFilterKind[]);
  });
});

describe('filter chip interaction (act-compat)', () => {
  it('toggles aria-pressed on click', async () => {
    const user = userEvent.setup();
    seedStores([region('plain')]);
    renderSection();

    const lockedChip = screen.getByRole('button', { name: /^Locked · / });
    expect(lockedChip.getAttribute('aria-pressed')).toBe('false');
    await user.click(lockedChip);
    expect(lockedChip.getAttribute('aria-pressed')).toBe('true');
  });
});
