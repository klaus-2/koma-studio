import type { ComponentProps } from 'react';

import type { AioTextRegion } from '../../types/dashboard.types';
import { DEFAULT_RENDER_STYLE } from '../../constants/dashboard.constants';
import type { LoadedImage } from '../../types/dashboard.types';
import RenderTextPreviewClassic from './RenderTextPreviewClassic';

type RenderTextPreviewProps = ComponentProps<typeof RenderTextPreviewClassic>;

const EMPTY_REGIONS: AioTextRegion[] = [];

const buildImage = (): LoadedImage =>
  ({
    id: 'img-1',
    file: { name: 'page-01.png', type: 'image/png', size: 1, lastModified: 0 },
    url: 'blob:test',
    width: 320,
    height: 420,
  }) as unknown as LoadedImage;

export const buildRenderTextPreviewProps = (
  overrides: Partial<RenderTextPreviewProps> = {},
): RenderTextPreviewProps => ({
  label: '#1 — page-01.png',
  image: buildImage(),
  previewSrc: 'blob:preview',
  zoom: 1,
  viewMode: 'paginated',
  active: true,
  regions: EMPTY_REGIONS,
  selectedRegionId: null,
  onCardSelect: () => undefined,
  onSelectRegion: () => undefined,
  onRegionsChange: () => undefined,
  editable: true,
  areaSelectionEnabled: false,
  newRegionShapeKind: 'square',
  fallbackStyle: DEFAULT_RENDER_STYLE,
  fontRefreshToken: 1,
  availableRenderFonts: [],
  isCompactViewport: false,
  stageBadgeKey: 'cleanImage',
  stageBadgeLabel: 'CLEAN',
  canRewind: false,
  canForward: false,
  onRewind: () => undefined,
  onForward: () => undefined,
  historyHint: null,
  renderStageActive: true,
  manualEditEnabled: false,
  manualImageTool: 'none',
  manualPaintColor: '#000000',
  manualBrushSize: 12,
  manualBrushOpacity: 1,
  manualBrushBlur: 0,
  manualPaintLayerDataUrl: null,
  manualWandMaskDataUrl: null,
  manualHealingPending: false,
  textFillSwatches: [],
  onManualPaintLayerChange: () => undefined,
  onManualWandMaskChange: () => undefined,
  onManualWandRequest: async () => undefined,
  onManualHealingMaskCommit: async () => undefined,
  translationNotesEnabled: false,
  ...overrides,
});
