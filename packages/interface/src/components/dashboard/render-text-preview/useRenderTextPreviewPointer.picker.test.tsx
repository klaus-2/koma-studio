// @vitest-environment jsdom
import { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type {
  AioTextRegion,
  ImageFilters,
  LoadedImage,
  ManualImageEditTool,
  SegmentEditTool,
} from '../../../types/dashboard.types';
import type { DirectPageFile } from '../../../utils/page-source';
import type { TypographyShapeKind } from '../../../typography/types';
import { useRenderTextPreviewPointer } from './useRenderTextPreviewPointer';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const region = (
  id: string,
  bbox: [number, number, number, number],
): AioTextRegion => ({
  id,
  bbox,
  score: 1,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
});

const filters: ImageFilters = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
};

const directPage = () => {
  const file = new File([], 'page.png');
  return {
    kind: 'direct',
    name: 'page.png',
    type: 'image/png',
    size: 0,
    lastModified: 0,
    resident: file,
    toBlob: async () => file,
    dimensions: async () => ({ width: 100, height: 100 }),
    release: () => {},
  } satisfies DirectPageFile;
};

const image: LoadedImage = {
  id: 'img-1',
  file: directPage(),
  url: 'blob:img-1',
  width: 100,
  height: 100,
  rotation: 0,
  filters,
};

type HarnessProps = {
  displayRegions: AioTextRegion[];
  selectedRegionId: string | null;
  onOpenRegionPicker: (hits: readonly AioTextRegion[], point: { x: number; y: number }) => void;
  onSelectRegion: (regionId: string | null) => void;
  onMultiSelectToggle: (regionId: string) => void;
};

function PointerHarness({
  displayRegions,
  selectedRegionId,
  onOpenRegionPicker,
  onSelectRegion,
  onMultiSelectToggle,
}: HarnessProps) {
  const nullRef = useRef<null>(null);
  const regionsRef = useRef<AioTextRegion[]>(displayRegions);
  regionsRef.current = displayRegions;
  const manualInteractionRef = useRef<null>(null);
  const segBrushLastRef = useRef<null>(null);

  const { handlePointerDown } = useRenderTextPreviewPointer({
    interaction: null,
    setInteraction: vi.fn(),
    setContextMenu: vi.fn(),
    setHoveredRegionId: vi.fn(),
    paintCanvasRef: nullRef,
    healingMaskCanvasRef: nullRef,
    segBrushCanvasRef: nullRef,
    segBrushLastRef: segBrushLastRef,
    segBrushDataUrlRef: nullRef,
    wandMaskSelectedRef: nullRef,
    manualInteractionRef: manualInteractionRef,
    lastHoveredRegionIdRef: nullRef,
    regionsWithDefaultsRef: regionsRef,
    image,
    displayRegionsWithDefaults: displayRegions,
    regionsWithDefaultsById: new Map(displayRegions.map((item) => [item.id, item])),
    fallbackStyle: DEFAULT_RENDER_STYLE,
    selectedRegionId,
    editable: true,
    areaSelectionEnabled: true,
    allowRegionCreation: false,
    renderStageActive: true,
    segmentEditEnabled: false,
    segmentEditTool: 'select' as SegmentEditTool,
    segmentBrushSize: 20,
    activeManualImageTool: 'none' as ManualImageEditTool,
    manualHealingPending: false,
    isBrushCursorActive: false,
    manualBrushSize: 20,
    manualPaintColor: '#000000',
    manualBrushOpacity: 1,
    manualBrushBlur: 0,
    newRegionShapeKind: 'rounded' as TypographyShapeKind,
    onCardSelect: vi.fn(),
    onSelectRegion,
    onRegionsChange: vi.fn(),
    onMultiSelectToggle,
    onOpenRegionPicker,
    onManualWandMaskChange: vi.fn(),
    onManualWandRequest: vi.fn(async () => undefined),
    toImagePoint: (event) => ({
      x: event.clientX,
      y: event.clientY,
      scale: 1,
    }),
    drawSegBrushOnCanvas: vi.fn(),
    commitPaintLayer: vi.fn(),
    commitHealingMask: vi.fn(),
    updateRegionBox: vi.fn(),
    setRegionSkew: vi.fn(),
    setRegionRotation: vi.fn(),
    updateRegionRotation: vi.fn(),
    updateBrushCursor: vi.fn(),
    hideBrushCursor: vi.fn(),
    handleRegionContextMenu: vi.fn(),
    openInlineEditorForRegion: vi.fn(),
    closeInlineEditor: vi.fn(),
  });

  return (
    <div
      data-testid="stage"
      onPointerDown={handlePointerDown}
      ref={(node) => {
        if (node && typeof node.setPointerCapture !== 'function') {
          node.setPointerCapture = () => undefined;
        }
      }}
    />
  );
}

// jsdom has no PointerEvent: dispatch a MouseEvent with the pointerdown
// type so React's synthetic onPointerDown carries button/clientX/ctrlKey.
const firePointerDown = (
  stage: HTMLElement,
  modifier: { ctrlKey?: boolean; shiftKey?: boolean } = {},
): void => {
  fireEvent(
    stage,
    new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 50,
      clientY: 50,
      ...modifier,
    }),
  );
};

describe('pointerdown region picker trigger (F3 wiring)', () => {
  const overlapping = [region('back', [0, 0, 100, 100]), region('front', [0, 0, 100, 100])];

  it('opens the picker with both hits when the topmost region is not selected', () => {
    const onOpenRegionPicker = vi.fn();
    const onSelectRegion = vi.fn();
    const onMultiSelectToggle = vi.fn();
    const { getByTestId } = render(
      <I18nProvider>
        <PointerHarness
          displayRegions={overlapping}
          selectedRegionId={null}
          onOpenRegionPicker={onOpenRegionPicker}
          onSelectRegion={onSelectRegion}
          onMultiSelectToggle={onMultiSelectToggle}
        />
      </I18nProvider>,
    );

    firePointerDown(getByTestId('stage'));

    expect(onOpenRegionPicker).toHaveBeenCalledTimes(1);
    expect(onOpenRegionPicker.mock.calls[0]?.[0]).toEqual(overlapping);
    expect(onSelectRegion).not.toHaveBeenCalled();
    expect(onMultiSelectToggle).not.toHaveBeenCalled();
  });

  it('never opens the picker on a Ctrl multi-select click', () => {
    const onOpenRegionPicker = vi.fn();
    const onSelectRegion = vi.fn();
    const onMultiSelectToggle = vi.fn();
    const { getByTestId } = render(
      <I18nProvider>
        <PointerHarness
          displayRegions={overlapping}
          selectedRegionId={null}
          onOpenRegionPicker={onOpenRegionPicker}
          onSelectRegion={onSelectRegion}
          onMultiSelectToggle={onMultiSelectToggle}
        />
      </I18nProvider>,
    );

    firePointerDown(getByTestId('stage'), { ctrlKey: true });

    expect(onOpenRegionPicker).not.toHaveBeenCalled();
    expect(onMultiSelectToggle).toHaveBeenCalledWith('front');
    expect(onSelectRegion).not.toHaveBeenCalled();
  });

  it('toggles the multi-selection on a Shift+click like Ctrl already do', () => {
    const onOpenRegionPicker = vi.fn();
    const onSelectRegion = vi.fn();
    const onMultiSelectToggle = vi.fn();
    const { getByTestId } = render(
      <I18nProvider>
        <PointerHarness
          displayRegions={overlapping}
          selectedRegionId={null}
          onOpenRegionPicker={onOpenRegionPicker}
          onSelectRegion={onSelectRegion}
          onMultiSelectToggle={onMultiSelectToggle}
        />
      </I18nProvider>,
    );

    firePointerDown(getByTestId('stage'), { shiftKey: true });

    expect(onOpenRegionPicker).not.toHaveBeenCalled();
    expect(onMultiSelectToggle).toHaveBeenCalledWith('front');
    expect(onSelectRegion).not.toHaveBeenCalled();
  });

  it('toggles on Shift+click even for a single hit (shift excluded from the picker)', () => {
    const onOpenRegionPicker = vi.fn();
    const onSelectRegion = vi.fn();
    const onMultiSelectToggle = vi.fn();
    const { getByTestId } = render(
      <I18nProvider>
        <PointerHarness
          displayRegions={[region('only', [0, 0, 100, 100])]}
          selectedRegionId={null}
          onOpenRegionPicker={onOpenRegionPicker}
          onSelectRegion={onSelectRegion}
          onMultiSelectToggle={onMultiSelectToggle}
        />
      </I18nProvider>,
    );

    firePointerDown(getByTestId('stage'), { shiftKey: true });

    expect(onOpenRegionPicker).not.toHaveBeenCalled();
    expect(onMultiSelectToggle).toHaveBeenCalledWith('only');
    expect(onSelectRegion).not.toHaveBeenCalled();
  });

  it('does not open the picker and starts the move drag when the topmost region is selected', () => {
    const onOpenRegionPicker = vi.fn();
    const onSelectRegion = vi.fn();
    const onMultiSelectToggle = vi.fn();
    const { getByTestId } = render(
      <I18nProvider>
        <PointerHarness
          displayRegions={overlapping}
          selectedRegionId="front"
          onOpenRegionPicker={onOpenRegionPicker}
          onSelectRegion={onSelectRegion}
          onMultiSelectToggle={onMultiSelectToggle}
        />
      </I18nProvider>,
    );

    firePointerDown(getByTestId('stage'));

    expect(onOpenRegionPicker).not.toHaveBeenCalled();
    expect(onSelectRegion).toHaveBeenCalledWith('front');
    expect(onMultiSelectToggle).not.toHaveBeenCalled();
  });

  it('selects directly on a single hit without any picker', () => {
    const onOpenRegionPicker = vi.fn();
    const onSelectRegion = vi.fn();
    const onMultiSelectToggle = vi.fn();
    const { getByTestId } = render(
      <I18nProvider>
        <PointerHarness
          displayRegions={[region('only', [0, 0, 100, 100])]}
          selectedRegionId={null}
          onOpenRegionPicker={onOpenRegionPicker}
          onSelectRegion={onSelectRegion}
          onMultiSelectToggle={onMultiSelectToggle}
        />
      </I18nProvider>,
    );

    firePointerDown(getByTestId('stage'));

    expect(onOpenRegionPicker).not.toHaveBeenCalled();
    expect(onSelectRegion).toHaveBeenCalledWith('only');
  });
});
