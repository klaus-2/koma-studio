// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import RegionMultiSelectionActionBar from './RegionMultiSelectionActionBar';
import { useImageCollectionStore } from '../../pages/dashboard/stores/image-collection-store';
import { useRegionEditorStore } from '../../pages/dashboard/stores/region-editor-store';
import { useStatusStore } from '../../pages/dashboard/stores/status-store';
import { useTypographerStore } from '../../pages/dashboard/stores/typographer-store';
import { DEFAULT_RENDER_STYLE } from '../../constants/dashboard.constants';
import type { AioTextRegion } from '../../types/dashboard.types';
import type { TypographyStylePreset } from '../../typography/types';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const region = (
  id: string,
  overrides: Partial<AioTextRegion> = {},
): AioTextRegion => ({
  id,
  bbox: [10, 10, 110, 60],
  score: 0.9,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
  renderMode: 'auto',
  detectedRenderMode: 'text_bubble',
  renderStyle: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Region Font' },
  ...overrides,
});

const preset = (): TypographyStylePreset => ({
  id: 'preset-1',
  folderId: null,
  name: 'Batch Preset',
  description: '',
  style: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Preset Font' },
  defaultShapeKind: 'rounded',
  padding: 10,
  createdAt: 0,
  updatedAt: 0,
});

let regions: AioTextRegion[];

const seedStores = (): void => {
  regions = [region('r-1'), region('r-2'), region('r-3')];
  useImageCollectionStore.setState({ activeId: 'img-1' });
  const currentPresetState = useRegionEditorStore.getState().typographyPresetState;
  useRegionEditorStore.setState({
    aioDetectionsByImage: { 'img-1': regions },
    aioSelectedRegionByImage: { 'img-1': 'r-1' },
    typographyPresetState: {
      ...currentPresetState,
      presets: [preset()],
      modeBindings: { text_bubble: 'preset-1' },
    },
  });
  useTypographerStore.setState({
    typographerMultiSelectedByImage: { 'img-1': ['r-1', 'r-2'] },
  });
};

const renderBar = () => {
  const retranslateTranslatorRegions = vi.fn(async () => undefined);
  const updateAioRegionsForImage = vi.fn();
  const { container } = render(
    <I18nProvider>
      <RegionMultiSelectionActionBar
        retranslateTranslatorRegions={retranslateTranslatorRegions}
        updateAioRegionsForImage={updateAioRegionsForImage}
      />
    </I18nProvider>,
  );
  return { container, retranslateTranslatorRegions, updateAioRegionsForImage };
};

const multiSelection = (): Record<string, string[]> =>
  useTypographerStore.getState().typographerMultiSelectedByImage;

beforeEach(() => {
  seedStores();
  useThemeStore.setState({ family: 'classic' });
});

afterEach(cleanup);

describe('RegionMultiSelectionActionBar', () => {
  it('hides while no region is multi-selected', () => {
    useTypographerStore.setState({ typographerMultiSelectedByImage: {} });
    const { container } = renderBar();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it('hides without an active image', () => {
    useImageCollectionStore.setState({ activeId: null });
    const { container } = renderBar();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it('shows the selection counter for the active image', () => {
    renderBar();
    expect(screen.getByText('2 regions selected')).toBeTruthy();
  });

  it('applies the style to the multi-selected ids in ONE committed edit', () => {
    const { updateAioRegionsForImage } = renderBar();

    fireEvent.click(screen.getByText('Apply style'));

    expect(updateAioRegionsForImage).toHaveBeenCalledTimes(1);
    const [imageId, nextRegions] = updateAioRegionsForImage.mock.calls[0] as [
      string,
      AioTextRegion[],
    ];
    expect(imageId).toBe('img-1');
    const changed = nextRegions.filter(
      (next) => next.renderStyle?.fontFamily === 'Preset Font',
    );
    expect(changed.map((next) => next.id)).toEqual(['r-1', 'r-2']);
    expect(useStatusStore.getState().statusMessage).toContain('Batch Preset');
  });

  it('retranslates the multi-selected ids through the threaded page handler', () => {
    const { retranslateTranslatorRegions } = renderBar();

    fireEvent.click(screen.getByText('Re-translate'));

    expect(retranslateTranslatorRegions).toHaveBeenCalledTimes(1);
    expect(retranslateTranslatorRegions).toHaveBeenCalledWith('img-1', [
      'r-1',
      'r-2',
    ]);
  });

  it('deselects only on clear: the regions and the single selection stay untouched', () => {
    renderBar();

    fireEvent.click(screen.getByText('Deselect'));

    expect(multiSelection()).toEqual({});
    expect(useRegionEditorStore.getState().aioDetectionsByImage['img-1']).toEqual(
      regions,
    );
    expect(useRegionEditorStore.getState().aioSelectedRegionByImage['img-1']).toBe('r-1');
  });

  it('deletes the multi-selected regions in ONE committed edit and drops the stale selection', () => {
    const { updateAioRegionsForImage } = renderBar();

    fireEvent.click(screen.getByText('Delete'));

    expect(updateAioRegionsForImage).toHaveBeenCalledTimes(1);
    const [imageId, nextRegions] = updateAioRegionsForImage.mock.calls[0] as [
      string,
      AioTextRegion[],
    ];
    expect(imageId).toBe('img-1');
    expect(nextRegions.map((next) => next.id)).toEqual(['r-3']);
    expect(multiSelection()).toEqual({});
    expect(useStatusStore.getState().statusMessage).toContain('2');
  });

  it('reports a no-op status when no preset is active and commits nothing', () => {
    const currentPresetState = useRegionEditorStore.getState().typographyPresetState;
    useRegionEditorStore.setState({
      typographyPresetState: {
        ...currentPresetState,
        presets: [],
        modeBindings: {},
        defaultPresetId: null,
      },
    });
    const { updateAioRegionsForImage } = renderBar();

    fireEvent.click(screen.getByText('Apply style'));

    expect(updateAioRegionsForImage).not.toHaveBeenCalled();
    expect(useStatusStore.getState().statusMessage).toBe('Select a preset first');
  });

  it('renders the noir twin when the theme family switches to noir', () => {
    const { container } = renderBar();

    act(() => {
      useThemeStore.setState({ family: 'noir' });
    });

    expect(screen.getByText('2 regions selected')).toBeTruthy();
    expect(container.querySelector('.bg-ink')).not.toBeNull();
  });
});
