// Floating type dock for the render text preview: font/shape/size controls,
// formatting, orientation, skew steppers, and the expanded fine-tune panel
// with fill/outline/shadow/text-effect/circular-text popovers.
// JSX moved verbatim from RenderTextPreview.tsx (T07 split).

import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Settings,
  Sparkles,
  Underline,
  X,
} from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type {
  TypographyShape,
  TypographyShapeKind,
} from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import {
  applyNativeTextEffectPreset,
  NATIVE_TEXT_EFFECT_PRESETS,
  type NativeTextEffectPresetId,
} from '../../../typography/textEffects';
import {
  buildFillPickerValue,
  parseFillPickerValue,
} from '../../../utils/textFillPicker';
import {
  applyShadowFillPickerValueToStyle,
  buildShadowFillPickerValue,
  clamp,
  cn,
  createDefaultShadowLayer,
  normalizeRenderRotation,
  normalizeRenderSkew,
} from '../../../utils/dashboard.utils';
import { CircularTextPopover } from '../../color/CircularTextPopover';
import { FillStylePopover } from '../../color/FillStylePopover';
import { RenderEffectPopover } from '../../color/RenderEffectPopover';
import { TextEffectPopover } from '../../color/TextEffectPopover';

interface RenderTextPreviewTypeDockProps {
  dockLeft: number;
  dockTop: number;
  dockAnchor: { placement: 'right' | 'left' | 'top' | 'bottom' };
  dockRef: React.RefObject<HTMLDivElement | null>;
  dockPointerDownRef: React.RefObject<boolean>;
  isCompactViewport: boolean;
  selectedRegion: AioTextRegion;
  selectedRegionStyle: RenderTextStyle;
  selectedRegionIsNoteOverlay: boolean;
  dockExpanded: boolean;
  setDockExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  availableRenderFonts: string[];
  textFillSwatches: string[];
  onRequestRefineRegion?: () => void;
  updateSelectedRegionStyle: (
    updater: (style: RenderTextStyle) => RenderTextStyle,
  ) => void;
  updateSelectedRegionShapeKind: (kind: TypographyShapeKind) => void;
  normalizeSelectedRegionShape: (options?: {
    kind?: TypographyShapeKind;
    centerText?: boolean;
    source?: TypographyShape['source'];
  }) => void;
  adjustSelectedFontSize: (delta: number) => void;
  adjustSelectedRotation: (deltaDegrees: number) => void;
  saveCurrentSelection: () => { start: number; end: number } | null;
  clearPickerState: () => void;
  syncInlineEditorSelection: () => void;
}

const RenderTextPreviewTypeDock = ({
  dockLeft,
  dockTop,
  dockAnchor,
  dockRef,
  dockPointerDownRef,
  isCompactViewport,
  selectedRegion,
  selectedRegionStyle,
  selectedRegionIsNoteOverlay,
  dockExpanded,
  setDockExpanded,
  availableRenderFonts,
  textFillSwatches,
  onRequestRefineRegion,
  updateSelectedRegionStyle,
  updateSelectedRegionShapeKind,
  normalizeSelectedRegionShape,
  adjustSelectedFontSize,
  adjustSelectedRotation,
  saveCurrentSelection,
  clearPickerState,
  syncInlineEditorSelection,
}: RenderTextPreviewTypeDockProps) => {
  const { t } = useI18n();

  const fontOptions = React.useMemo(
    () =>
      availableRenderFonts.map((family) => (
        <option key={family} value={family}>
          {family}
        </option>
      )),
    [availableRenderFonts],
  );

  const handleTextEffectChange = React.useCallback(
    (presetId: NativeTextEffectPresetId) =>
      updateSelectedRegionStyle((s) =>
        applyNativeTextEffectPreset(s, presetId),
      ),
    [updateSelectedRegionStyle],
  );
  const handleTextEffectIntensity = React.useCallback(
    (value: number) =>
      updateSelectedRegionStyle((s) => ({
        ...s,
        textEffectIntensity: value,
      })),
    [updateSelectedRegionStyle],
  );

  return (
    <div
      ref={dockRef}
      className={cn(
        'koma-type-dock',
        isCompactViewport && 'koma-type-dock--compact',
        dockAnchor.placement === 'left' && 'koma-type-dock--left',
        dockAnchor.placement === 'right' && 'koma-type-dock--right',
        dockAnchor.placement === 'top' && 'koma-type-dock--top',
        dockAnchor.placement === 'bottom' && 'koma-type-dock--bottom',
      )}
      style={{ left: `${dockLeft}px`, top: `${dockTop}px` }}
      onPointerDown={(e) => {
        dockPointerDownRef.current = true;
        syncInlineEditorSelection();
        e.stopPropagation();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="koma-type-dock__bar">
        {/* ═══ Row 1: Primary Controls ═══ */}
        <div className="koma-type-dock__row koma-type-dock__row--primary">
          {/* Font Family */}
          <select
            className="koma-type-dock__select koma-type-dock__select--font"
            value={selectedRegionStyle.fontFamily}
            onChange={(e) =>
              updateSelectedRegionStyle((s) => ({
                ...s,
                fontFamily: e.target.value,
              }))
            }
            aria-label={t('renderPreview.textFont')}
          >
            {fontOptions}
          </select>

          {/* Shape */}
          <select
            className="koma-type-dock__select koma-type-dock__select--shape"
            value={selectedRegion?.shape?.kind ?? 'rounded'}
            onChange={(e) =>
              updateSelectedRegionShapeKind(
                e.target.value as TypographyShapeKind,
              )
            }
            disabled={selectedRegionIsNoteOverlay}
            aria-label={t('renderPreview.selectionShape')}
          >
            <option value="square">{t('renderPreview.rectangular')}</option>
            <option value="rounded">{t('renderPreview.elliptic')}</option>
          </select>

          {/* Font Size Stepper */}
          <div
            className="koma-type-dock__stepper"
            role="group"
            aria-label={t('renderPreview.fontSize')}
          >
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() => adjustSelectedFontSize(-1)}
              aria-label={t('renderPreview.decreaseFont')}
            >
              −
            </button>
            <span className="koma-type-dock__step-val">
              {Math.round(selectedRegionStyle.fontSize)}
            </span>
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() => adjustSelectedFontSize(1)}
              aria-label={t('renderPreview.increaseFont')}
            >
              +
            </button>
          </div>
        </div>

        <div className="koma-type-dock__row-sep" aria-hidden="true" />

        {/* ═══ Row 2: Format Controls ═══ */}
        <div className="koma-type-dock__row koma-type-dock__row--format">
          {/* Alignment */}
          <div
            className="koma-type-dock__icon-group"
            role="group"
            aria-label={t('renderPreview.alignment')}
          >
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.alignment === 'left' &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  alignment: 'left',
                }))
              }
              aria-label={t('renderPreview.alignLeft')}
            >
              <AlignLeft size={12} />
            </button>
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.alignment === 'center' &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                normalizeSelectedRegionShape({
                  centerText: true,
                  source: 'refined',
                })
              }
              aria-label={t('renderPreview.alignCenter')}
            >
              <AlignCenter size={12} />
            </button>
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.alignment === 'right' &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  alignment: 'right',
                }))
              }
              aria-label={t('renderPreview.alignRight')}
            >
              <AlignRight size={12} />
            </button>
          </div>

          <span className="koma-type-dock__pipe" aria-hidden="true" />

          {/* Typography Style */}
          <div
            className="koma-type-dock__icon-group"
            role="group"
            aria-label={t('renderPreview.typographyStyle')}
          >
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.bold &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  bold: !s.bold,
                }))
              }
              aria-label={t('renderPreview.bold')}
            >
              <Bold size={12} />
            </button>
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.italic &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  italic: !s.italic,
                }))
              }
              aria-label={t('renderPreview.italic')}
            >
              <Italic size={12} />
            </button>
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.underline &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  underline: !s.underline,
                }))
              }
              aria-label={t('renderPreview.underline')}
            >
              <Underline size={12} />
            </button>
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.uppercase &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  uppercase: !s.uppercase,
                }))
              }
              aria-label={t('renderPreview.uppercase')}
              title={t('renderPreview.uppercase')}
            >
              <span className="koma-type-dock__icon-text">{t('renderPreview.iconUppercase')}</span>
            </button>
          </div>

          <span className="koma-type-dock__pipe" aria-hidden="true" />

          {/* Orientation */}
          <div
            className="koma-type-dock__icon-group"
            role="group"
            aria-label={t('renderPreview.textOrientation')}
          >
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.textOrientation !== 'vertical' &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  textOrientation: 'horizontal',
                }))
              }
              aria-label={t('renderPreview.horizontal')}
              title={t('renderPreview.horizontal')}
            >
              <span className="koma-type-dock__icon-text">{t('renderPreview.iconHorizontal')}</span>
            </button>
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.textOrientation === 'vertical' &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  textOrientation: 'vertical',
                }))
              }
              aria-label={t('renderPreview.vertical')}
              title={t('renderPreview.vertical')}
            >
              <span className="koma-type-dock__icon-text">{t('renderPreview.iconVertical')}</span>
            </button>
            <button
              type="button"
              className={cn(
                'koma-type-dock__icon-btn',
                selectedRegionStyle.textPathMode === 'circular' &&
                'koma-type-dock__icon-btn--active',
              )}
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  textPathMode:
                    s.textPathMode === 'circular'
                      ? 'normal'
                      : 'circular',
                }))
              }
              aria-label={t('renderPreview.circular')}
              title={t('renderPreview.circularText')}
            >
              <span className="koma-type-dock__icon-text">{t('renderPreview.iconCircular')}</span>
            </button>
          </div>

          <span className="koma-type-dock__pipe" aria-hidden="true" />

          {/* Rotation Stepper */}
          <div
            className="koma-type-dock__stepper"
            role="group"
            aria-label={t('renderPreview.rotation')}
          >
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() => adjustSelectedRotation(-5)}
              aria-label={t('renderPreview.rotateMinus5')}
            >
              −
            </button>
            <span className="koma-type-dock__step-val">
              {Math.round(selectedRegionStyle.rotation)}°
            </span>
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() => adjustSelectedRotation(5)}
              aria-label={t('renderPreview.rotatePlus5')}
            >
              +
            </button>
          </div>
        </div>

        {/* ═══ Row 3: Transform + Actions ═══ */}
        <div className="koma-type-dock__row koma-type-dock__row--actions">
          {/* Skew X */}
          <div
            className="koma-type-dock__stepper koma-type-dock__stepper--labeled"
            role="group"
            aria-label={t('renderPreview.skewX')}
          >
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  skewX: normalizeRenderSkew((s.skewX || 0) - 2),
                }))
              }
              aria-label={t('renderPreview.skewXMinus2')}
            >
              −
            </button>
            <span className="koma-type-dock__step-val">
              {Math.round(selectedRegionStyle.skewX || 0)}°
              <span className="koma-type-dock__step-unit">{t('dashboard.render.skewXLabel')}</span>
            </span>
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  skewX: normalizeRenderSkew((s.skewX || 0) + 2),
                }))
              }
              aria-label={t('renderPreview.skewXPlus2')}
            >
              +
            </button>
          </div>

          {/* Skew Y */}
          <div
            className="koma-type-dock__stepper koma-type-dock__stepper--labeled"
            role="group"
            aria-label={t('renderPreview.skewY')}
          >
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  skewY: normalizeRenderSkew((s.skewY || 0) - 2),
                }))
              }
              aria-label={t('renderPreview.skewYMinus2')}
            >
              −
            </button>
            <span className="koma-type-dock__step-val">
              {Math.round(selectedRegionStyle.skewY || 0)}°
              <span className="koma-type-dock__step-unit">{t('dashboard.render.skewYLabel')}</span>
            </span>
            <button
              type="button"
              className="koma-type-dock__step-btn"
              onClick={() =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  skewY: normalizeRenderSkew((s.skewY || 0) + 2),
                }))
              }
              aria-label={t('renderPreview.skewYPlus2')}
            >
              +
            </button>
          </div>

          <span className="koma-type-dock__spacer" />

          {/* Action Buttons */}
          <button
            type="button"
            className={cn(
              'koma-type-dock__action',
              dockExpanded && 'koma-type-dock__action--active',
            )}
            onClick={() => setDockExpanded((prev) => !prev)}
            aria-expanded={dockExpanded}
          >
            <Settings size={11} />
            {t('renderPreview.adjustments')}
          </button>

          <button
            type="button"
            className="koma-type-dock__action"
            onClick={() => onRequestRefineRegion?.()}
            disabled={
              !onRequestRefineRegion || selectedRegionIsNoteOverlay
            }
          >
            <Sparkles size={11} />
            {t('renderPreview.refine')}
          </button>
        </div>
      </div>

      {/* ═══ Expanded Fine-Tune Panel ═══ */}
      {dockExpanded && (
        <div className="koma-type-dock__fine custom-scrollbar">
          <div className="koma-type-dock__fine-grid">
            {/* Auto Font Size */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">
                {t('renderPreview.autoFontSize')}
              </span>
              <label className="koma-type-dock__fine-toggle">
                <input
                  type="checkbox"
                  checked={selectedRegionStyle.autoFontSize}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      autoFontSize: e.target.checked,
                      fontSize: DEFAULT_RENDER_STYLE.fontSize,
                      minFontSize: DEFAULT_RENDER_STYLE.minFontSize,
                    }))
                  }
                />
                <span className="koma-type-dock__fine-toggle-text">
                  {selectedRegionStyle.autoFontSize
                    ? t('renderPreview.autoFit')
                    : t('renderPreview.fixed')}
                </span>
              </label>
            </div>

            {/* Hyphenation */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">
                {t('renderPreview.hyphenation')}
              </span>
              <label className="koma-type-dock__fine-toggle">
                <input
                  type="checkbox"
                  checked={selectedRegionStyle.hyphenationEnabled}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      hyphenationEnabled: e.target.checked,
                    }))
                  }
                />
                <span className="koma-type-dock__fine-toggle-text">
                  {selectedRegionStyle.hyphenationEnabled
                    ? t('renderPreview.enabled')
                    : t('renderPreview.disabled')}
                </span>
              </label>
            </div>

            {/* Max Font Size */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">
                {t('renderPreview.maxSize')}
              </span>
              <div className="koma-type-dock__fine-control">
                <input
                  type="range"
                  className="koma-type-dock__fine-range"
                  min={8}
                  max={160}
                  step={1}
                  value={Math.round(selectedRegionStyle.fontSize)}
                  onChange={(e) => {
                    const next = Math.round(Number(e.target.value));
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      fontSize: next,
                      minFontSize: Math.min(
                        Math.round(s.minFontSize),
                        next,
                      ),
                    }));
                  }}
                />
                <span className="koma-type-dock__fine-value">
                  {Math.round(selectedRegionStyle.fontSize)}px
                </span>
              </div>
            </div>

            {/* Min Font Size */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">
                {t('renderPreview.minSize')}
              </span>
              <div className="koma-type-dock__fine-control">
                <input
                  type="range"
                  className="koma-type-dock__fine-range"
                  min={6}
                  max={Math.max(6, Math.round(selectedRegionStyle.fontSize))}
                  step={1}
                  value={Math.round(selectedRegionStyle.minFontSize)}
                  onChange={(e) => {
                    const next = Math.round(Number(e.target.value));
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      minFontSize: clamp(
                        next,
                        6,
                        Math.max(6, Math.round(s.fontSize)),
                      ),
                    }));
                  }}
                />
                <span className="koma-type-dock__fine-value">
                  {Math.round(selectedRegionStyle.minFontSize)}px
                </span>
              </div>
            </div>

            {/* Line Spacing */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">
                {t('renderPreview.lineSpacing')}
              </span>
              <div className="koma-type-dock__fine-control">
                <input
                  type="range"
                  className="koma-type-dock__fine-range"
                  min={0.65}
                  max={2.2}
                  step={0.05}
                  value={selectedRegionStyle.lineSpacing}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      lineSpacing: Number(e.target.value),
                    }))
                  }
                />
                <span className="koma-type-dock__fine-value">
                  {selectedRegionStyle.lineSpacing.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Text Opacity */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">
                {t('renderPreview.opacity')}
              </span>
              <div className="koma-type-dock__fine-control">
                <input
                  type="range"
                  className="koma-type-dock__fine-range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={selectedRegionStyle.opacity}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      opacity: Number(e.target.value),
                    }))
                  }
                />
                <span className="koma-type-dock__fine-value">
                  {Math.round(selectedRegionStyle.opacity * 100)}%
                </span>
              </div>
            </div>

            {/* Skew X */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">{t('renderPreview.skewX')}</span>
              <div className="koma-type-dock__fine-control">
                <input
                  type="range"
                  className="koma-type-dock__fine-range"
                  min={-45}
                  max={45}
                  step={0.5}
                  value={selectedRegionStyle.skewX || 0}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      skewX: normalizeRenderSkew(
                        Number(e.target.value),
                      ),
                    }))
                  }
                />
                <span className="koma-type-dock__fine-value">
                  {(selectedRegionStyle.skewX || 0).toFixed(1)}°
                </span>
              </div>
            </div>

            {/* Skew Y */}
            <div className="koma-type-dock__fine-field">
              <span className="koma-type-dock__fine-label">{t('renderPreview.skewY')}</span>
              <div className="koma-type-dock__fine-control">
                <input
                  type="range"
                  className="koma-type-dock__fine-range"
                  min={-45}
                  max={45}
                  step={0.5}
                  value={selectedRegionStyle.skewY || 0}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      skewY: normalizeRenderSkew(
                        Number(e.target.value),
                      ),
                    }))
                  }
                />
                <span className="koma-type-dock__fine-value">
                  {(selectedRegionStyle.skewY || 0).toFixed(1)}°
                </span>
              </div>
            </div>
          </div>

          {/* ═══ Effects Row ═══ */}
          <div className="koma-type-dock__effects-row">
            {/* Fill */}
            <FillStylePopover
              label={t('renderPreview.fill')}
              value={buildFillPickerValue(selectedRegionStyle)}
              swatches={textFillSwatches}
              onBeforeOpen={saveCurrentSelection}
              onClose={clearPickerState}
              onChange={(nextValue) => {
                updateSelectedRegionStyle((style) => {
                  const nextFill = parseFillPickerValue(
                    nextValue,
                    style.color || '#111111',
                  );
                  // CRITICAL: Do NOT include keys that are not in INLINE_RENDER_STYLE_KEYS
                  // (e.g. detectGradient), otherwise getInlineStylePatchFromStyleDiff returns null
                  // and the style is applied to the entire region instead of the selection.
                  return {
                    ...style,
                    color: nextFill.color,
                    fillCssValue: nextFill.fillCssValue,
                    gradientEnabled: nextFill.gradientEnabled,
                    gradientStartColor: nextFill.gradientStartColor,
                    gradientEndColor: nextFill.gradientEndColor,
                    gradientAngle: nextFill.gradientAngle,
                  };
                });
              }}
            />

            {/* Outline */}
            <RenderEffectPopover
              label={t('renderPreview.outline')}
              value={selectedRegionStyle.outlineColor}
              enabled={selectedRegionStyle.outlineWidth > 0}
              summary={`${selectedRegionStyle.outlineWidth.toFixed(1)}px`}
              onEnabledChange={(enabled) =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  outlineWidth: enabled
                    ? s.outlineWidth > 0
                      ? s.outlineWidth
                      : 2
                    : 0,
                }))
              }
              onColorChange={(nextValue) =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  outlineColor: nextValue,
                }))
              }
            >
              <div className="koma-effect-popover__field">
                <label>{t('renderPreview.opacity')}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedRegionStyle.outlineOpacity ?? 1}
                  disabled={selectedRegionStyle.outlineWidth <= 0}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      outlineOpacity: Number(e.target.value),
                    }))
                  }
                />
                <span className="koma-effect-popover__value">
                  {Math.round(
                    (selectedRegionStyle.outlineOpacity ?? 1) * 100,
                  )}
                  %
                </span>
              </div>
              <div className="koma-effect-popover__field">
                <label>{t('settings.modePresets.outlineWidth')}</label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.25}
                  value={selectedRegionStyle.outlineWidth}
                  disabled={selectedRegionStyle.outlineWidth <= 0}
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      outlineWidth: Number(e.target.value),
                    }))
                  }
                />
                <span className="koma-effect-popover__value">
                  {selectedRegionStyle.outlineWidth.toFixed(2)}
                </span>
              </div>
            </RenderEffectPopover>

            {/* Shadow */}
            <RenderEffectPopover
              label={t('renderPreview.shadow')}
              value={buildShadowFillPickerValue(selectedRegionStyle)}
              enabled={selectedRegionStyle.shadowEnabled}
              summary={
                selectedRegionStyle.shadowLayers?.length
                  ? t('renderPreview.shadowLayersCount', {
                    count: selectedRegionStyle.shadowLayers.length,
                  })
                  : t('renderPreview.shadowBlurSummary', {
                    value: selectedRegionStyle.shadowBlur.toFixed(0),
                  })
              }
              allowGradient
              swatches={textFillSwatches}
              onEnabledChange={(enabled) =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  shadowEnabled: enabled,
                }))
              }
              onColorChange={(nextValue) =>
                updateSelectedRegionStyle((s) =>
                  applyShadowFillPickerValueToStyle(s, nextValue),
                )
              }
            >
              {/* Opacity + Blur side by side */}
              <div className="koma-effect-popover__field-pair">
                <div className="koma-effect-popover__field">
                  <label>{t('renderPreview.opacity')}</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedRegionStyle.shadowOpacity ?? 1}
                    disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) =>
                      updateSelectedRegionStyle((s) => ({
                        ...s,
                        shadowOpacity: Number(e.target.value),
                      }))
                    }
                  />
                  <span className="koma-effect-popover__value">
                    {Math.round((selectedRegionStyle.shadowOpacity ?? 1) * 100)}%
                  </span>
                </div>
                <div className="koma-effect-popover__field">
                  <label>{t('renderPreview.blur')}</label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={0.5}
                    value={selectedRegionStyle.shadowBlur}
                    disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) =>
                      updateSelectedRegionStyle((s) => ({
                        ...s,
                        shadowBlur: Number(e.target.value),
                      }))
                    }
                  />
                  <span className="koma-effect-popover__value">
                    {selectedRegionStyle.shadowBlur.toFixed(1)}
                  </span>
                </div>
              </div>
              {/* Offset X + Offset Y side by side */}
              <div className="koma-effect-popover__field-pair">
                <div className="koma-effect-popover__field">
                  <label>{t('renderPreview.offsetX')}</label>
                  <input
                    type="range"
                    min={-24}
                    max={24}
                    step={1}
                    value={selectedRegionStyle.shadowOffsetX}
                    disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) =>
                      updateSelectedRegionStyle((s) => ({
                        ...s,
                        shadowOffsetX: Number(e.target.value),
                      }))
                    }
                  />
                  <span className="koma-effect-popover__value">
                    {selectedRegionStyle.shadowOffsetX.toFixed(0)}px
                  </span>
                </div>
                <div className="koma-effect-popover__field">
                  <label>{t('renderPreview.offsetY')}</label>
                  <input
                    type="range"
                    min={-24}
                    max={24}
                    step={1}
                    value={selectedRegionStyle.shadowOffsetY}
                    disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) =>
                      updateSelectedRegionStyle((s) => ({
                        ...s,
                        shadowOffsetY: Number(e.target.value),
                      }))
                    }
                  />
                  <span className="koma-effect-popover__value">
                    {selectedRegionStyle.shadowOffsetY.toFixed(0)}px
                  </span>
                </div>
              </div>

              {/* Shadow Layers */}
              <div className="koma-effect-popover__layers">
                <div className="koma-effect-popover__layersHead">
                  <span>{t('renderPreview.shadowLayers')}</span>
                  <button
                    type="button"
                    className="koma-btn koma-btn--ghost koma-btn--sm"
                    onClick={() =>
                      updateSelectedRegionStyle((s) => ({
                        ...s,
                        shadowLayers: [
                          ...(s.shadowLayers ?? []),
                          createDefaultShadowLayer(),
                        ],
                      }))
                    }
                  >
                    {t('renderPreview.addLayer')}
                  </button>
                </div>
                {(selectedRegionStyle.shadowLayers ?? []).map(
                  (layer, idx) => (
                    <div
                      key={`shadow-layer-${idx}`}
                      className="koma-effect-popover__layerCard"
                    >
                      <div className="koma-effect-popover__layerHead">
                        <strong>{t('renderPreview.layerN', { count: idx + 1 })}</strong>
                        <button
                          type="button"
                          className="koma-tool-config__close"
                          onClick={() =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              shadowLayers: (
                                s.shadowLayers ?? []
                              ).filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label={t('renderPreview.removeLayerN', { count: idx + 1 })}
                        >
                          <X size={10} />
                        </button>
                      </div>
                      {/* Fill – full width, no value column */}
                      <div className="koma-effect-popover__field koma-effect-popover__field--fill">
                        <label>{t('renderPreview.fill')}</label>
                        <FillStylePopover
                          label={t('renderPreview.shadowLayerN', { count: idx + 1 })}
                          value={layer.fillCssValue}
                          allowGradient
                          swatches={textFillSwatches}
                          onBeforeOpen={saveCurrentSelection}
                          onClose={clearPickerState}
                          onChange={(v) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              shadowLayers: (s.shadowLayers ?? []).map(
                                (entry, i) =>
                                  i === idx
                                    ? { ...entry, fillCssValue: v }
                                    : entry,
                              ),
                            }))
                          }
                        />
                      </div>
                      {/* Opacity + Blur side by side */}
                      <div className="koma-effect-popover__field-pair">
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.opacity')}</label>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={layer.opacity}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowLayers: (s.shadowLayers ?? []).map(
                                  (entry, i) =>
                                    i === idx
                                      ? { ...entry, opacity: Number(e.target.value) }
                                      : entry,
                                ),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {Math.round(layer.opacity * 100)}%
                          </span>
                        </div>
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.blur')}</label>
                          <input
                            type="range"
                            min={0}
                            max={40}
                            step={0.5}
                            value={layer.blur}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowLayers: (s.shadowLayers ?? []).map(
                                  (entry, i) =>
                                    i === idx
                                      ? { ...entry, blur: Number(e.target.value) }
                                      : entry,
                                ),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {layer.blur.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      {/* Offset X + Offset Y side by side */}
                      <div className="koma-effect-popover__field-pair">
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.offsetX')}</label>
                          <input
                            type="range"
                            min={-24}
                            max={24}
                            step={1}
                            value={layer.offsetX}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowLayers: (s.shadowLayers ?? []).map(
                                  (entry, i) =>
                                    i === idx
                                      ? { ...entry, offsetX: Number(e.target.value) }
                                      : entry,
                                ),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {layer.offsetX.toFixed(0)}px
                          </span>
                        </div>
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.offsetY')}</label>
                          <input
                            type="range"
                            min={-24}
                            max={24}
                            step={1}
                            value={layer.offsetY}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowLayers: (s.shadowLayers ?? []).map(
                                  (entry, i) =>
                                    i === idx
                                      ? { ...entry, offsetY: Number(e.target.value) }
                                      : entry,
                                ),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {layer.offsetY.toFixed(0)}px
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </RenderEffectPopover>

            {/* Text Effect */}
            <TextEffectPopover
              value={selectedRegionStyle.textEffectPreset ?? 'none'}
              presets={NATIVE_TEXT_EFFECT_PRESETS}
              intensity={selectedRegionStyle.textEffectIntensity ?? 1}
              onChange={handleTextEffectChange}
              onIntensityChange={handleTextEffectIntensity}
            />

            {/* Circular Text */}
            <CircularTextPopover
              enabled={selectedRegionStyle.textPathMode === 'circular'}
              summary={`${((selectedRegionStyle.circularRadiusScale || 0.78) * 100).toFixed(0)}%`}
              onEnabledChange={(enabled) =>
                updateSelectedRegionStyle((s) => ({
                  ...s,
                  textPathMode: enabled ? 'circular' : 'normal',
                }))
              }
            >
              <div className="koma-effect-popover__field">
                <label>{t('renderPreview.radius')}</label>
                <input
                  type="range"
                  min={0.2}
                  max={1.2}
                  step={0.01}
                  value={
                    selectedRegionStyle.circularRadiusScale || 0.78
                  }
                  disabled={
                    selectedRegionStyle.textPathMode !== 'circular'
                  }
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      circularRadiusScale: Number(e.target.value),
                    }))
                  }
                />
                <span className="koma-effect-popover__value">
                  {(
                    (selectedRegionStyle.circularRadiusScale || 0.78) *
                    100
                  ).toFixed(0)}
                  %
                </span>
              </div>
              <div className="koma-effect-popover__field">
                <label>{t('renderPreview.startAngle')}</label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={selectedRegionStyle.circularStartAngle || -90}
                  disabled={
                    selectedRegionStyle.textPathMode !== 'circular'
                  }
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      circularStartAngle: normalizeRenderRotation(
                        Number(e.target.value),
                      ),
                    }))
                  }
                />
                <span className="koma-effect-popover__value">
                  {(
                    selectedRegionStyle.circularStartAngle || -90
                  ).toFixed(0)}
                  °
                </span>
              </div>
              <div className="koma-effect-popover__field">
                <label>{t('renderPreview.spacing')}</label>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={selectedRegionStyle.circularLetterSpacing || 1}
                  disabled={
                    selectedRegionStyle.textPathMode !== 'circular'
                  }
                  onChange={(e) =>
                    updateSelectedRegionStyle((s) => ({
                      ...s,
                      circularLetterSpacing: Number(e.target.value),
                    }))
                  }
                />
                <span className="koma-effect-popover__value">
                  {(
                    selectedRegionStyle.circularLetterSpacing || 1
                  ).toFixed(2)}
                  x
                </span>
              </div>
            </CircularTextPopover>
          </div>
        </div>
      )}
    </div>
  );
};

// The dock receives stable callback identities from the composition root, so
// memoizing skips its ~1,100-line subtree while dragging/hovering changes
// unrelated parent state (interaction, hoveredRegionId, contextMenu, ...).
export default React.memo(RenderTextPreviewTypeDock);
