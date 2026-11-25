import type React from 'react';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  SegmentEditTool,
  ViewMode,
} from '../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import type { RegionPickerState } from '../render-text-preview/RegionPickerMount';
import type { useTextDetectionPreviewBehaviors } from './TextDetectionPreview.behaviors';

export interface TextDetectionPreviewProps {
  label: string;
  image: LoadedImage;
  previewSrc: string;
  viewMode: ViewMode;
  active: boolean;
  regions: AioTextRegion[];
  selectedRegionId: string | null;
  onCardSelect: () => void;
  onSelectRegion: (regionId: string | null) => void;
  onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  editable: boolean;
  selectionEnabled: boolean;
  creationEnabled: boolean;
  newRegionShapeKind: TypographyShapeKind;
  segmentEditEnabled: boolean;
  segmentEditTool: SegmentEditTool;
  segmentBrushSize: number;
  segmentBrushDataUrl?: string | null;
  onSegmentBrushChange?: (dataUrl: string | null) => void;
  stageBadgeKey: AioPipelineSnapshotKey;
  stageBadgeLabel: string;
  canRewind: boolean;
  canForward: boolean;
  onRewind: () => void;
  onForward: () => void;
  historyHint: string | null;
  translationNotesEnabled: boolean;
  fallbackStyle?: RenderTextStyle;
}

export type TextDetectionPreviewController = ReturnType<
  typeof useTextDetectionPreviewBehaviors
> & {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  imgElemW: number;
  imgElemH: number;
  canvasWrapW: number;
  canvasWrapH: number;
  isBrushCursorActive: boolean;
  zoom: number;
  regionPicker: RegionPickerState | null;
  closeRegionPicker: () => void;
};
