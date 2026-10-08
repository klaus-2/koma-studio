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
import { readInlineEditorPlainText } from '../../../utils/inlineEditor';
import { getRegionRotation } from '../render-text-preview/regionGeometry';
import type { RenderRegionOverlayBoxEditor } from '../render-text-preview/RenderRegionOverlayBox';

interface RenderRegionOverlayBoxNoirProps {
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
  editor?: RenderRegionOverlayBoxEditor;
}

const RenderRegionOverlayBoxNoir = ({
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
}: RenderRegionOverlayBoxNoirProps) => {
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
      borderRadius: region.shape?.kind === 'rounded' ? '999px' : '2px',
    };
  }, [dragBox, fallbackStyle, imageHeight, imageWidth, region, regionRotation]);

  return (
    <div
      className={cn(
        'absolute border-2 transition-colors',
        region.source === 'manual'
          ? 'border-dashed border-gold/70'
          : 'border-azure/60',
        isNoteOverlay && 'border-mint/70 bg-mint/5',
        selected && '!border-crimson bg-crimson/8 shadow-hard-crimson',
        isMultiSelected && '!border-gold bg-gold/8',
      )}
      style={boxStyle}
      data-region-id={region.id}
    >
      {isMultiSelected && (
        <span className="panel-cut-sm absolute -left-2 -top-2 z-10 grid h-5 w-5 place-items-center bg-gold font-mono text-[10px] font-black text-ink shadow-hard-paper">
          {multiSelectIndex + 1}
        </span>
      )}
      <span className={cn(
        'panel-cut-sm absolute left-0 top-0 max-w-full truncate px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider',
        selected ? 'bg-crimson text-ink' : isNoteOverlay ? 'bg-mint text-ink' : 'bg-ink/85 text-paper',
      )}>
        {isNoteOverlay
          ? 'NT'
          : previewText.trim().length > 0
            ? previewText.slice(0, 32)
            : renderStageActive
              ? t('dashboard.renderText.dblClickToEdit')
              : t('dashboard.renderText.renderNotApplied')}
      </span>

      {editor && (
        <div
          ref={editor.contentEditableRef}
          className="koma-render-inline-editor"
          contentEditable
          role="textbox"
          tabIndex={0}
          aria-multiline="true"
          suppressContentEditableWarning
          style={editor.contentEditableStyle}
          onPointerDown={(event) => event.stopPropagation()}
          data-empty={editor.state.value.length === 0 ? 'true' : undefined}
          data-placeholder={t('dashboard.renderText.editPlaceholder')}
          onInput={(event) => {
            const nextValue = readInlineEditorPlainText(event.currentTarget);
            if (nextValue.length > 0) event.currentTarget.removeAttribute('data-empty');
            else event.currentTarget.setAttribute('data-empty', 'true');
            editor.onInput(nextValue);
            editor.syncSelection();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); editor.cancel(); return; }
            if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); event.stopPropagation(); editor.save(); }
          }}
          onBlur={(event) => {
            if (editor.dockPointerDownRef.current) return;
            const nextTarget = event.relatedTarget as Node | null;
            if (nextTarget && editor.dockRef.current?.contains(nextTarget)) return;
            if (!editor.state.isDirty) { editor.setState(null); return; }
            editor.save();
          }}
          onSelect={editor.syncSelection}
          onKeyUp={editor.syncSelection}
          onMouseUp={editor.syncSelection}
          aria-label={t('dashboard.renderText.editAria')}
        />
      )}

      {showHandles && (
        <>
          <button
            type="button"
            className="panel-cut-sm koma-render-handle absolute -right-2 -top-2 z-10 grid h-5 w-5 place-items-center bg-crimson text-ink shadow-hard-gold transition-transform hover:scale-110"
            title={t('dashboard.renderText.removeSelection.title')}
            aria-label={t('dashboard.renderText.removeSelection.title')}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); removeRegionById?.(region.id); }}
          >
            <X size={11} />
          </button>
          <span className="koma-render-rotate-arm absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 -translate-y-full bg-crimson" />
          <span
            className="koma-render-rotate-handle koma-render-handle absolute left-1/2 top-0 z-10 h-3 w-3 -translate-x-1/2 -translate-y-[calc(100%+18px)] cursor-grab rounded-full border-2 border-crimson bg-ink"
            data-render-handle="rotate"
            data-region-id={region.id}
          />
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
            <span
              key={corner}
              className={cn(
                'koma-detect-handle koma-render-handle absolute z-10 h-3 w-3 border-2 border-crimson bg-ink',
                corner === 'nw' && '-left-1.5 -top-1.5 cursor-nwse-resize',
                corner === 'ne' && '-right-1.5 -top-1.5 cursor-nesw-resize',
                corner === 'sw' && '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                corner === 'se' && '-bottom-1.5 -right-1.5 cursor-nwse-resize',
              )}
              data-render-handle="corner"
              data-corner={corner}
              data-region-id={region.id}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default React.memo(RenderRegionOverlayBoxNoir);
