import '../../../pages/DockTools.css';

import { DEFAULT_FILTERS, DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import {
  type AioTextRegion,
  type LoadedImage,
} from '../../../types/dashboard.types';
import { type PageFile } from '../../../types/page-source.types';
import { type TypographyShapeKind } from '../../../typography/types';
import { useOnbSkin } from '../onboardingSkin';
import RenderTextPreviewClassic from '../../dashboard/RenderTextPreviewClassic';
import RenderTextPreviewNoir from '../../dashboard/noir/RenderTextPreviewNoir';

export interface LabImageSpec {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export const createLabLoadedImage = ({
  id,
  name,
  url,
  width,
  height,
}: LabImageSpec): LoadedImage => {
  const resident = new File([], name, { type: 'image/webp' });
  const file: PageFile = {
    kind: 'direct',
    resident,
    name: resident.name,
    type: resident.type,
    size: resident.size,
    lastModified: resident.lastModified,
    toBlob: async () => resident,
    dimensions: async () => ({ width, height }),
    release: () => undefined,
  };

  return {
    id,
    file,
    url,
    width,
    height,
    rotation: 0,
    filters: {
      ...DEFAULT_FILTERS,
      levels: { ...DEFAULT_FILTERS.levels },
    },
  };
};

export interface OnboardingRenderPreviewProps {
  readonly label: string;
  readonly image: LoadedImage;
  readonly previewSrc: string;
  readonly zoom?: number;
  readonly regions: AioTextRegion[];
  readonly selectedRegionId: string | null;
  readonly areaSelectionEnabled: boolean;
  readonly allowRegionCreation: boolean;
  readonly newRegionShapeKind: TypographyShapeKind;
  readonly inlineEditorRequestKey?: string | null;
  readonly onSelectRegion: (regionId: string | null) => void;
  readonly onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  readonly onRequestRefineRegion: () => void;
}

const LAB_FONTS = ['Arial', 'Comic Sans MS', 'Impact', 'Georgia', 'Trebuchet MS'];
const NOOP = (): void => undefined;
const NOOP_ASYNC = async (): Promise<void> => undefined;

export function OnboardingRenderPreview({
  label,
  image,
  previewSrc,
  zoom = 1,
  regions,
  selectedRegionId,
  areaSelectionEnabled,
  allowRegionCreation,
  newRegionShapeKind,
  inlineEditorRequestKey = null,
  onSelectRegion,
  onRegionsChange,
  onRequestRefineRegion,
}: OnboardingRenderPreviewProps) {
  const skin = useOnbSkin();
  const PreviewComponent = skin.noir ? RenderTextPreviewNoir : RenderTextPreviewClassic;

  return (
    <PreviewComponent
      label={label}
      image={image}
      previewSrc={previewSrc}
      zoom={zoom}
      viewMode="long_strip"
      active
      regions={regions}
      selectedRegionId={selectedRegionId}
      onCardSelect={NOOP}
      onSelectRegion={onSelectRegion}
      onRegionsChange={onRegionsChange}
      editable
      areaSelectionEnabled={areaSelectionEnabled}
      allowRegionCreation={allowRegionCreation}
      newRegionShapeKind={newRegionShapeKind}
      fallbackStyle={DEFAULT_RENDER_STYLE}
      fontRefreshToken={1}
      availableRenderFonts={LAB_FONTS}
      isCompactViewport={false}
      stageBadgeKey="render"
      stageBadgeLabel="RENDER"
      canRewind={false}
      canForward={false}
      onRewind={NOOP}
      onForward={NOOP}
      historyHint={null}
      renderStageActive
      onRequestRefineRegion={onRequestRefineRegion}
      manualEditEnabled={false}
      manualImageTool="none"
      manualPaintColor="#ffffff"
      manualBrushSize={20}
      manualBrushOpacity={1}
      manualBrushBlur={0}
      manualPaintLayerDataUrl={null}
      manualWandMaskDataUrl={null}
      manualHealingPending={false}
      textFillSwatches={[]}
      onManualPaintLayerChange={NOOP}
      onManualWandMaskChange={NOOP}
      onManualWandRequest={NOOP_ASYNC}
      onManualHealingMaskCommit={NOOP_ASYNC}
      translationNotesEnabled={false}
      inlineEditorRequestKey={inlineEditorRequestKey}
    />
  );
}
