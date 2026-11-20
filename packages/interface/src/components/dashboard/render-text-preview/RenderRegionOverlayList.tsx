// Shared region overlay list: owns the per-region prop threading (selection
// state, live drag box, handles, inline editor handle) so the classic and
// noir previews only choose their themed box component.

import React from 'react';
import type {
  AioTextRegion,
  RenderOverlayInteraction,
} from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { isTranslationNoteOverlayRegion } from '../../../utils/dashboard.utils';
import type { InlineTextEditorHandle } from './InlineTextEditorSurface';
import type { RenderRegionOverlayBoxProps } from './RenderRegionOverlayBox';
import MarqueeSelectionLayer from './MarqueeSelectionLayer';

interface RenderRegionOverlayListProps {
  BoxComponent: React.ComponentType<RenderRegionOverlayBoxProps>;
  regions: readonly AioTextRegion[];
  visibleRegionIdSet?: ReadonlySet<string>;
  imageWidth: number;
  imageHeight: number;
  renderStageActive: boolean;
  fallbackStyle: RenderTextStyle;
  editable: boolean;
  areaSelectionEnabled: boolean;
  selectedRegionId: string | null;
  multiSelectedRegionIds: readonly string[];
  interaction: RenderOverlayInteraction | null;
  removeRegionById: (regionId: string) => void;
  /** Owning image id, written by the marquee layer's multi-selection. */
  marqueeImageId: string | null;
  /** Handle for the open inline editor, attached to its own region only. */
  editorHandle: InlineTextEditorHandle | null;
}

const RenderRegionOverlayList = ({
  BoxComponent,
  regions,
  visibleRegionIdSet,
  imageWidth,
  imageHeight,
  renderStageActive,
  fallbackStyle,
  editable,
  areaSelectionEnabled,
  selectedRegionId,
  multiSelectedRegionIds,
  interaction,
  removeRegionById,
  marqueeImageId,
  editorHandle,
}: RenderRegionOverlayListProps) => (
  <>
    {regions.map((region) => {
      if (visibleRegionIdSet && !visibleRegionIdSet.has(region.id)) return null;
      const multiSelectIndex = multiSelectedRegionIds.indexOf(region.id);
      const regionIsSelected = region.id === selectedRegionId;
      const showHandles = regionIsSelected && editable && areaSelectionEnabled;
      // Live drag position of the region being moved (store commits once
      // on pointerup; the dragged box renders from interaction state).
      const dragBox =
        interaction &&
          interaction.kind === 'move' &&
          interaction.regionId === region.id
          ? interaction.currentBox
          : undefined;
      return (
        <BoxComponent
          key={region.id}
          region={region}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          isNoteOverlay={isTranslationNoteOverlayRegion(region)}
          selected={regionIsSelected}
          isMultiSelected={multiSelectIndex >= 0}
          multiSelectIndex={multiSelectIndex}
          renderStageActive={renderStageActive}
          fallbackStyle={fallbackStyle}
          showHandles={showHandles}
          dragBox={dragBox}
          removeRegionById={showHandles ? removeRegionById : undefined}
          editor={
            editorHandle && editorHandle.state.regionId === region.id
              ? editorHandle
              : undefined
          }
        />
      );
    })}
    <MarqueeSelectionLayer
      regions={regions}
      imageWidth={imageWidth}
      imageHeight={imageHeight}
      areaSelectionEnabled={areaSelectionEnabled}
      marqueeImageId={marqueeImageId}
    />
  </>
);

export default React.memo(RenderRegionOverlayList);
