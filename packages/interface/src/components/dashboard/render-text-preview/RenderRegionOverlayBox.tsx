import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  buildDefaultRegionRenderText,
  cloneRenderStyle,
  cn,
} from '../../../utils/dashboard.utils';
import { getRegionRotation } from './regionGeometry';
import InlineTextEditorSurface, {
  type InlineTextEditorHandle,
} from './InlineTextEditorSurface';
import InlineTextSelectionOverlay from './InlineTextSelectionOverlay';

export interface RenderRegionOverlayBoxProps {
  region: AioTextRegion;
  imageWidth: number;
  imageHeight: number;
  isNoteOverlay: boolean;
  selected: boolean;
  isMultiSelected: boolean;
  multiSelectIndex: number;
  renderStageActive: boolean;
  fallbackStyle: RenderTextStyle;
  showHandles: boolean;
  dragBox?: [number, number, number, number] | null;
  removeRegionById?: (regionId: string) => void;
  editor?: InlineTextEditorHandle;
}

const RenderRegionOverlayBox = ({
  region,
  imageWidth,
  imageHeight,
  isNoteOverlay,
  selected,
  isMultiSelected,
  multiSelectIndex,
  renderStageActive,
  fallbackStyle,
  showHandles,
  dragBox,
  removeRegionById,
  editor,
}: RenderRegionOverlayBoxProps) => {
  const { t } = useI18n();
  const regionRotation = getRegionRotation(region, fallbackStyle);
  const previewText = renderStageActive
    ? (region.renderText ?? '').trim()
    : buildDefaultRegionRenderText(region);
  const boxStyle = useMemo<React.CSSProperties>(() => {
    const regionSkewStyle = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
    const [x1, y1, x2, y2] = dragBox ?? region.bbox;
    return {
      left: `${(x1 / imageWidth) * 100}%`,
      top: `${(y1 / imageHeight) * 100}%`,
      width: `${((x2 - x1) / imageWidth) * 100}%`,
      height: `${((y2 - y1) / imageHeight) * 100}%`,
      transform: `rotate(${regionRotation}deg) skew(${regionSkewStyle.skewX || 0}deg, ${regionSkewStyle.skewY || 0}deg)`,
      transformOrigin: 'center center',
      borderRadius:
        region.shape?.kind === 'rounded' ? '999px' : '14px',
    };
  }, [dragBox, fallbackStyle, imageHeight, imageWidth, region, regionRotation]);

  return (
    <div
      className={cn(
        'koma-render-box',
        region.source === 'manual' && 'koma-render-box--manual',
        isNoteOverlay && 'koma-render-box--note',
        selected && 'koma-render-box--selected',
        isMultiSelected && 'koma-render-box--multi-selected',
        editor && 'koma-render-box--inline-editing',
      )}
      style={boxStyle}
      data-region-id={region.id}
    >
      {isMultiSelected && (
        <span className="koma-render-box__multi-badge">
          {multiSelectIndex + 1}
        </span>
      )}
      {!editor && (
        <span className="koma-render-box__meta">
          {isNoteOverlay
            ? 'NT'
            : previewText.trim().length > 0
              ? previewText.slice(0, 32)
              : renderStageActive
                ? t('dashboard.renderText.dblClickToEdit')
                : t('dashboard.renderText.renderNotApplied')}
        </span>
      )}
      {editor && (
        <>
          <InlineTextSelectionOverlay
            selectionStart={editor.state.selectionStart}
            selectionEnd={editor.state.selectionEnd}
            lines={editor.selectionLines}
            caretColor={editor.caretColor}
          />
          <InlineTextEditorSurface editor={editor} />
        </>
      )}
      {showHandles && (
        <>
          <button
            type="button"
            className="koma-render-box__close koma-render-handle"
            title={t('dashboard.renderText.removeSelection.title')}
            aria-label={t('dashboard.renderText.removeSelection.title')}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              removeRegionById?.(region.id);
            }}
          >
            <X size={11} />
          </button>
          <span className="koma-render-rotate-arm" />
          <span
            className="koma-render-rotate-handle koma-render-handle"
            data-render-handle="rotate"
            data-region-id={region.id}
          />
          <span
            className="koma-detect-handle koma-detect-handle--nw koma-render-handle"
            data-render-handle="corner"
            data-corner="nw"
            data-region-id={region.id}
          />
          <span
            className="koma-detect-handle koma-detect-handle--ne koma-render-handle"
            data-render-handle="corner"
            data-corner="ne"
            data-region-id={region.id}
          />
          <span
            className="koma-detect-handle koma-detect-handle--sw koma-render-handle"
            data-render-handle="corner"
            data-corner="sw"
            data-region-id={region.id}
          />
          <span
            className="koma-detect-handle koma-detect-handle--se koma-render-handle"
            data-render-handle="corner"
            data-corner="se"
            data-region-id={region.id}
          />
        </>
      )}
    </div>
  );
};

export default React.memo(RenderRegionOverlayBox);
