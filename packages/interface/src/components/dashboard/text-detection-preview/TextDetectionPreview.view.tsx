import React from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Languages,
  Trash2,
  X,
} from 'lucide-react';
import '../ContextMenu.css';
import type {
  TextDetectionPreviewController,
  TextDetectionPreviewProps,
} from '../TextDetectionPreview';
import { useI18n } from '../../../i18n';
import {
  cn,
  cloneRenderStyle,
  getRegionTranslationNotesForDisplay,
} from '../../../utils/dashboard.utils';

export interface TextDetectionPreviewViewProps extends TextDetectionPreviewProps {
  controller: TextDetectionPreviewController;
}

const TextDetectionPreviewView = ({
  controller,
  label,
  image,
  previewSrc,
  zoom,
  active,
  regions,
  selectedRegionId,
  onCardSelect,
  editable,
  selectionEnabled,
  segmentEditEnabled,
  segmentEditTool,
  stageBadgeKey,
  stageBadgeLabel,
  canRewind,
  canForward,
  onRewind,
  onForward,
  historyHint,
  translationNotesEnabled,
  fallbackStyle,
}: TextDetectionPreviewViewProps) => {
  const { t } = useI18n();
  const {
    overlayRef,
    imgElemW,
    imgElemH,
    canvasWrapW,
    canvasWrapH,
    isBrushCursorActive,
    brushCursorRef,
    contextMenu,
    contextMenuTargetRegion,
    draftBox,
    handleContextCopyRecognized,
    handleContextCopyTranslated,
    handleContextEditRecognized,
    handleContextEditTranslated,
    handleContextRemoveRegion,
    handleEditorCancel,
    handleEditorSave,
    handleOverlayPointerCancel,
    handleOverlayPointerEnter,
    handleOverlayPointerLeave,
    handleOverlayPointerMove,
    handlePointerDown,
    handlePointerUp,
    handleRegionContextMenuDelegated,
    handleRegionDoubleClickDelegated,
    handleRegionRemoveClick,
    handleTextEditorChange,
    hoveredRegion,
    hoveredRegionTooltip,
    segBrushCanvasRef,
    segmentOverlayBoxes,
    stopPropagationPointerDown,
    textEditor,
  } = controller;

  const brushCursorPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={brushCursorRef as React.Ref<HTMLDivElement>}
            className="koma-brush-cursor"
          />,
          document.body,
        )
      : null;

  return (
    <>
      <div
        onClick={onCardSelect}
        data-tour={active ? 'dashboard-active-preview-card' : undefined}
        className={cn(
          'koma-preview-card',
          active && 'koma-preview-card--active',
        )}
        style={{ zoom }}
      >
        <div className="koma-preview-card__labelRow">
          <div className="koma-preview-card__label">{label}</div>
          <span
            className={cn(
              'koma-preview-card__stageBadge',
              `koma-preview-card__stageBadge--${stageBadgeKey}`,
            )}
          >
            {stageBadgeLabel}
          </span>
          <div className="koma-preview-card__labelActions">
            <button
              type="button"
              className="koma-iconbtn koma-iconbtn--xs koma-preview-card__historyBtn"
              onClick={(event) => {
                event.stopPropagation();
                onRewind();
              }}
              disabled={!canRewind}
              title={t('detectionPreview.rewind')}
              aria-label={t('detectionPreview.rewind')}
            >
              <ChevronLeft size={11} />
            </button>
            <button
              type="button"
              className="koma-iconbtn koma-iconbtn--xs koma-preview-card__historyBtn"
              onClick={(event) => {
                event.stopPropagation();
                onForward();
              }}
              disabled={!canForward}
              title={t('detectionPreview.forward')}
              aria-label={t('detectionPreview.forward')}
            >
              <ChevronRight size={11} />
            </button>
          </div>
        </div>
        <div className="koma-preview-card__labelHint">
          {historyHint ?? t('detectionPreview.noHistory')}
        </div>
        <div
          className="koma-preview-card__rotateWrap"
          style={{ width: canvasWrapW, height: canvasWrapH }}
        >
          <div
            className="koma-preview-card__canvasWrap"
            style={{
              width: imgElemW,
              height: imgElemH,
              position: 'absolute',
              left: (canvasWrapW - imgElemW) / 2,
              top: (canvasWrapH - imgElemH) / 2,
              transform: image.rotation
                ? `rotate(${image.rotation}deg)`
                : undefined,
            }}
          >
            <img
              src={previewSrc}
              className="koma-preview-card__img"
              style={{ maxWidth: `${imgElemW}px` }}
              alt={image.file.name}
            />
            <div
              ref={overlayRef as React.Ref<HTMLDivElement>}
              className={cn(
                'koma-detect-overlay',
                editable && selectionEnabled && 'koma-detect-overlay--editable',
                segmentEditEnabled &&
                  editable &&
                  segmentEditTool !== 'select' &&
                  'koma-detect-overlay--segment-edit',
              )}
              style={{
                cursor: isBrushCursorActive
                  ? 'none'
                  : segmentEditEnabled && editable && segmentEditTool !== 'select'
                    ? segmentEditTool === 'brush'
                      ? 'crosshair'
                      : 'cell'
                    : editable && selectionEnabled
                      ? 'crosshair'
                      : 'default',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handlePointerUp}
              onPointerEnter={handleOverlayPointerEnter}
              onPointerCancel={handleOverlayPointerCancel}
              onPointerLeave={handleOverlayPointerLeave}
              onContextMenu={handleRegionContextMenuDelegated}
              onDoubleClick={handleRegionDoubleClickDelegated}
            >
              {regions.map((region) => {
                const [x1, y1, x2, y2] = region.bbox;
                const selected = region.id === selectedRegionId;
                const regionRotation = (() => {
                  const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
                  return style.rotation || 0;
                })();
                const regionSkewStyle = cloneRenderStyle(
                  region.renderStyle ?? fallbackStyle,
                );
                const regionNotes = getRegionTranslationNotesForDisplay(
                  region,
                  translationNotesEnabled,
                );
                return (
                  <React.Fragment key={region.id}>
                    <div
                      className={cn(
                        'koma-detect-box',
                        region.source === 'manual' && 'koma-detect-box--manual',
                        selected && 'koma-detect-box--selected',
                      )}
                      style={{
                        left: `${(x1 / image.width) * 100}%`,
                        top: `${(y1 / image.height) * 100}%`,
                        width: `${((x2 - x1) / image.width) * 100}%`,
                        height: `${((y2 - y1) / image.height) * 100}%`,
                        transform: `rotate(${regionRotation}deg) skew(${regionSkewStyle.skewX || 0}deg, ${regionSkewStyle.skewY || 0}deg)`,
                        transformOrigin: 'center center',
                        borderRadius:
                          region.shape?.kind === 'rounded' ? '999px' : '14px',
                      }}
                      data-region-id={region.id}
                    >
                      <span className="koma-detect-box__meta">
                        {region.source === 'manual'
                          ? t('detectionPreview.manual')
                          : `${Math.round(region.score * 100)}%`}
                      </span>
                      {selected && editable && selectionEnabled && (
                        <>
                          <button
                            type="button"
                            className="koma-render-box__close koma-render-handle"
                            title={t('detectionPreview.removeSelection')}
                            aria-label={t('detectionPreview.removeSelection')}
                            data-render-handle="close"
                            data-region-id={region.id}
                            data-remove-region-id={region.id}
                            onPointerDown={stopPropagationPointerDown}
                            onClick={handleRegionRemoveClick}
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
                    {regionNotes.length > 0 && (
                      <div
                        className="koma-translation-notes"
                        style={{
                          left: `${(x1 / image.width) * 100}%`,
                          top: `calc(${(y2 / image.height) * 100}% + 4px)`,
                          width: `${Math.max(
                            ((x2 - x1) / image.width) * 100,
                            12,
                          )}%`,
                        }}
                      >
                        {regionNotes.map((note, noteIndex) => (
                          <div
                            key={`${region.id}-note-${noteIndex}`}
                            className="koma-translation-notes__line"
                          >
                            {note}
                          </div>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              {segmentOverlayBoxes.map(({ key, box }) => {
                const [sx1, sy1, sx2, sy2] = box;
                return (
                  <div
                    key={key}
                    className="koma-detect-seg-box"
                    style={{
                      left: `${(sx1 / image.width) * 100}%`,
                      top: `${(sy1 / image.height) * 100}%`,
                      width: `${((sx2 - sx1) / image.width) * 100}%`,
                      height: `${((sy2 - sy1) / image.height) * 100}%`,
                    }}
                  />
                );
              })}
              <canvas
                ref={segBrushCanvasRef as React.Ref<HTMLCanvasElement>}
                className="koma-segment-brush-canvas"
              />
              {hoveredRegion && hoveredRegionTooltip
                ? (() => {
                    const [hx1, hy1, hx2] = hoveredRegion.bbox;
                    const centerX = ((hx1 + hx2) / 2 / image.width) * 100;
                    const topY = (hy1 / image.height) * 100;
                    return (
                      <div
                        className="koma-detect-tooltip"
                        style={{
                          left: `${centerX}%`,
                          top: `${Math.max(1.5, topY)}%`,
                        }}
                      >
                        <div className="koma-detect-tooltip__line">
                          <span className="koma-detect-tooltip__label">
                            {t('detectionPreview.recognized')}
                          </span>
                          <span className="koma-detect-tooltip__value">
                            {hoveredRegionTooltip.recognized}
                          </span>
                        </div>
                        <div className="koma-detect-tooltip__line">
                          <span className="koma-detect-tooltip__label">
                            {t('detectionPreview.translated')}
                          </span>
                          <span className="koma-detect-tooltip__value">
                            {hoveredRegionTooltip.translated}
                          </span>
                        </div>
                        {translationNotesEnabled && (
                          <div className="koma-detect-tooltip__line">
                            <span className="koma-detect-tooltip__label">
                              {t('detectionPreview.note')}
                            </span>
                            <span className="koma-detect-tooltip__value">
                              {hoveredRegionTooltip.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                : null}
              {contextMenu &&
              contextMenuTargetRegion ? (
                <div
                  className="koma-ctx"
                  style={{
                    left: `${contextMenu.x}px`,
                    top: `${contextMenu.y}px`,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                  role="menu"
                  aria-label={t('dashboard.textDetection.regionActions.aria')}
                >
                  <span className="koma-ctx__label">
                    {t('detectionPreview.text')}
                  </span>

                  <button
                    type="button"
                    className="koma-ctx__item"
                    role="menuitem"
                    onClick={handleContextCopyRecognized}
                    disabled={
                      (contextMenuTargetRegion.recognizedText ?? '').trim().length === 0
                    }
                  >
                    <span className="koma-ctx__item-icon" aria-hidden="true">
                      <ClipboardCopy size={11} />
                    </span>
                    <span className="koma-ctx__item-label">
                      {t('detectionPreview.copyRecognized')}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="koma-ctx__item"
                    onClick={handleContextEditRecognized}
                    disabled={!editable}
                    title={
                      editable
                        ? t('detectionPreview.editRecognizedTitle')
                        : t('detectionPreview.manualModeOnly')
                    }
                  >
                    {t('detectionPreview.editRecognized')}
                  </button>

                  <button
                    type="button"
                    className="koma-ctx__item"
                    role="menuitem"
                    onClick={handleContextCopyTranslated}
                    disabled={
                      (contextMenuTargetRegion.translatedText ?? '').trim().length === 0
                    }
                  >
                    <span className="koma-ctx__item-icon" aria-hidden="true">
                      <Languages size={11} />
                    </span>
                    <span className="koma-ctx__item-label">
                      {t('detectionPreview.copyTranslated')}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="koma-ctx__item"
                    onClick={handleContextEditTranslated}
                    disabled={!editable}
                    title={
                      editable
                        ? t('detectionPreview.editTranslatedTitle')
                        : t('detectionPreview.manualModeOnly')
                    }
                  >
                    {t('detectionPreview.editTranslated')}
                  </button>

                  <div className="koma-ctx__sep" aria-hidden="true" />

                  <button
                    type="button"
                    className="koma-ctx__item koma-ctx__item--danger"
                    role="menuitem"
                    onClick={handleContextRemoveRegion}
                    disabled={!editable}
                    title={
                      editable
                        ? t('detectionPreview.removeRegion')
                        : t('detectionPreview.manualModeOnly')
                    }
                  >
                    <span className="koma-ctx__item-icon" aria-hidden="true">
                      <Trash2 size={11} />
                    </span>
                    <span className="koma-ctx__item-label">
                      {t('detectionPreview.removeRegion')}
                    </span>
                  </button>
                </div>
              ) : null}
              {textEditor ? (
                <div
                  className="koma-detect-text-editor"
                  style={{ left: `${textEditor.x}px`, top: `${textEditor.y}px` }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <label className="koma-detect-text-editor__label">
                    {textEditor.target === 'recognized'
                      ? t('detectionPreview.editRecognizedTitle')
                      : t('detectionPreview.editTranslatedTitle')}
                  </label>
                  <textarea
                    className="koma-detect-text-editor__input"
                    value={textEditor.value}
                    onChange={(event) => handleTextEditorChange(event.target.value)}
                    rows={4}
                    placeholder={
                      textEditor.target === 'recognized'
                        ? t('detectionPreview.placeholderRecognized')
                        : t('detectionPreview.placeholderTranslated')
                    }
                  />
                  <div className="koma-detect-text-editor__actions">
                    <button
                      type="button"
                      className="koma-detect-text-editor__btn koma-detect-text-editor__btn--ghost"
                      onClick={handleEditorCancel}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="koma-detect-text-editor__btn koma-detect-text-editor__btn--primary"
                      onClick={handleEditorSave}
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : null}
              {draftBox ? (
                <div
                  className="koma-detect-box koma-detect-box--draft"
                  style={{
                    left: `${(draftBox[0] / image.width) * 100}%`,
                    top: `${(draftBox[1] / image.height) * 100}%`,
                    width: `${((draftBox[2] - draftBox[0]) / image.width) * 100}%`,
                    height: `${((draftBox[3] - draftBox[1]) / image.height) * 100}%`,
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {brushCursorPortal}
    </>
  );
};

export default TextDetectionPreviewView;
