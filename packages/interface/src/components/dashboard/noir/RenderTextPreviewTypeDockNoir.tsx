import React, { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
import { FontFamilySelect } from '../../fonts/FontFamilySelect';

interface RenderTextPreviewTypeDockNoirProps {
  dockLeft: number;
  dockTop: number;
  dockAnchor: { placement: 'right' | 'left' | 'top' | 'bottom' };
  dockRef: React.RefObject<HTMLDivElement | null>;
  dockPointerDownRef: React.RefObject<boolean>;
  isCompactViewport: boolean;
  selectedRegionId: string | null;
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

/* ── Dock stepper (beta) ── */
function Stepper({ label, value, unit, onDec, onInc, decLabel, incLabel, className }: {
  label: string; value: string | number; unit?: string; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; className?: string;
}) {
  return (
    <div className={cn('panel-cut-sm flex h-7 items-center bg-ink-3', className)} role="group" aria-label={label}>
      <button type="button" onClick={onDec} aria-label={decLabel} className="grid h-7 w-7 place-items-center font-mono text-sm text-paper-dim transition-colors hover:bg-crimson hover:text-ink">−</button>
      <span className="flex min-w-[40px] items-center justify-center gap-0.5 px-1 font-mono text-[11px] font-bold text-paper">
        {value}{unit && <span className="text-[8px] uppercase text-paper-dim">{unit}</span>}
      </span>
      <button type="button" onClick={onInc} aria-label={incLabel} className="grid h-7 w-7 place-items-center font-mono text-sm text-paper-dim transition-colors hover:bg-crimson hover:text-ink">+</button>
    </div>
  );
}

/* ── Dock icon group + icon + pipe (beta) ── */
function IconGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="panel-cut-sm flex h-7 bg-ink-3" role="group" aria-label={label}>{children}</div>;
}
function DockIcon({ children, active, onClick, label, title }: {
  children: React.ReactNode; active?: boolean; onClick: () => void; label: string; title?: string;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={title} aria-pressed={active}
      className={cn('grid h-7 w-7 place-items-center transition-colors', active ? 'bg-crimson text-ink' : 'text-paper-dim hover:text-paper')}
    >
      {children}
    </button>
  );
}
function DockPipe() {
  return <span className="h-7 w-px bg-crimson/20" aria-hidden="true" />;
}

/* ── Fine-tune field / toggle / range (beta) ── */
function FineField({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="panel-cut-sm flex flex-col gap-1.5 bg-ink-3/60 p-2">
      <label htmlFor={id} className="font-mono text-[9px] font-bold uppercase tracking-widest text-paper-dim">{label}</label>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ id?: string; 'aria-label'?: string }>, {
          id,
          'aria-label': label,
        })
        : children}
    </div>
  );
}

function FineToggle({ checked, onChange, text, id, 'aria-label': ariaLabel }: {
  checked: boolean; onChange: (v: boolean) => void; text: string; id?: string; 'aria-label'?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <span className={cn('panel-cut-sm grid h-4 w-4 place-items-center border transition-colors', checked ? 'border-crimson bg-crimson' : 'border-paper/25 bg-ink')}>
        {checked && <span className="h-1.5 w-1.5 bg-ink" />}
      </span>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" aria-label={ariaLabel ?? text} />
      <span className="font-mono text-[10px] text-paper">{text}</span>
    </label>
  );
}

/**
 * Local-draft range: store commits on pointer-up so dock style sliders
 * do not thrash region maps / canvas on every input event (INP).
 */
function FineRange({ min, max, step, value, onChange, id, 'aria-label': ariaLabel }: {
  min: number; max: number; step: number; value: number; onChange: (v: number) => void; display?: string;
  id?: string; 'aria-label'?: string;
}) {
  const [draft, setDraft] = useState(value);
  const draggingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!draggingRef.current) setDraft(value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        aria-label={ariaLabel}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          const next = Number(e.currentTarget.value);
          if (Number.isFinite(next)) {
            setDraft(next);
            onChangeRef.current(next);
          }
        }}
        onPointerCancel={(e) => {
          draggingRef.current = false;
          const next = Number(e.currentTarget.value);
          if (Number.isFinite(next)) {
            setDraft(next);
            onChangeRef.current(next);
          }
        }}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          setDraft(next);
          if (!draggingRef.current) onChangeRef.current(next);
        }}
        className="koma-noir-range h-1 flex-1 cursor-pointer appearance-none rounded-none bg-ink accent-crimson"
      />
      <span className="min-w-[42px] text-right font-mono text-[10px] font-bold text-crimson">
        {String(Math.round(draft * 100) / 100)}
      </span>
    </div>
  );
}

const RenderTextPreviewTypeDockNoir = ({
  dockLeft,
  dockTop,
  dockAnchor,
  dockRef,
  dockPointerDownRef,
  isCompactViewport,
  selectedRegionId,
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
}: RenderTextPreviewTypeDockNoirProps) => {
  const { t } = useI18n();

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
    <motion.div
      ref={dockRef}
      initial={{ opacity: 0, scale: 0.94, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn('koma-type-dock fixed z-[150]', isCompactViewport && 'koma-type-dock--compact', dockAnchor.placement === 'left' && 'koma-type-dock--left', dockAnchor.placement === 'right' && 'koma-type-dock--right', dockAnchor.placement === 'top' && 'koma-type-dock--top', dockAnchor.placement === 'bottom' && 'koma-type-dock--bottom')}
      style={{ left: `${dockLeft}px`, top: `${dockTop}px`, maxWidth: dockExpanded ? 440 : 440, overflow: 'visible' }}
      onPointerDown={(e) => { dockPointerDownRef.current = true; syncInlineEditorSelection(); e.stopPropagation(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="glass panel-cut relative flex w-full max-w-full flex-col gap-1 border-crimson/30 p-2 shadow-hard-crimson">
        <div className="halftone-red pointer-events-none absolute inset-0 opacity-10" aria-hidden="true" />

        {/* ═══ Row 1: Primary ═══ */}
        <div className="relative flex items-center gap-1.5">
          <FontFamilySelect
            className="panel-cut-sm h-7 min-w-0 flex-1 max-w-[170px] border border-paper/10 bg-ink-3 px-2 py-1 font-mono text-[11px] text-paper outline-none focus:border-crimson"
            value={selectedRegionStyle.fontFamily}
            onChange={(family) => updateSelectedRegionStyle((s) => ({ ...s, fontFamily: family }))}
            families={availableRenderFonts}
            ariaLabel={t('renderPreview.textFont')}
          />
          <select
            className="panel-cut-sm h-7 w-[82px] border border-paper/10 bg-ink-3 px-2 py-1 font-mono text-[11px] text-paper outline-none focus:border-crimson"
            value={selectedRegion?.shape?.kind ?? 'rounded'}
            onChange={(e) => updateSelectedRegionShapeKind(e.target.value as TypographyShapeKind)}
            disabled={selectedRegionIsNoteOverlay}
            aria-label={t('renderPreview.selectionShape')}
          >
            <option value="square">{t('renderPreview.rectangular')}</option>
            <option value="rounded">{t('renderPreview.elliptic')}</option>
          </select>
          <Stepper label={t('renderPreview.fontSize')} onDec={() => adjustSelectedFontSize(-1)} onInc={() => adjustSelectedFontSize(1)}
            decLabel={t('renderPreview.decreaseFont')} incLabel={t('renderPreview.increaseFont')} value={Math.round(selectedRegionStyle.fontSize)} />
        </div>

        <div className="relative h-px bg-crimson/15" aria-hidden="true" />

        {/* ═══ Row 2: Format ═══ */}
        <div className="relative flex flex-wrap items-center gap-1.5">
          <IconGroup label={t('renderPreview.alignment')}>
            <DockIcon active={selectedRegionStyle.alignment === 'left'} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, alignment: 'left' }))} label={t('renderPreview.alignLeft')}><AlignLeft size={12} /></DockIcon>
            <DockIcon active={selectedRegionStyle.alignment === 'center'} onClick={() => normalizeSelectedRegionShape({ centerText: true, source: 'refined' })} label={t('renderPreview.alignCenter')}><AlignCenter size={12} /></DockIcon>
            <DockIcon active={selectedRegionStyle.alignment === 'right'} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, alignment: 'right' }))} label={t('renderPreview.alignRight')}><AlignRight size={12} /></DockIcon>
          </IconGroup>

          <DockPipe />

          <IconGroup label={t('renderPreview.typographyStyle')}>
            <DockIcon active={selectedRegionStyle.bold} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, bold: !s.bold }))} label={t('renderPreview.bold')}><Bold size={12} /></DockIcon>
            <DockIcon active={selectedRegionStyle.italic} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, italic: !s.italic }))} label={t('renderPreview.italic')}><Italic size={12} /></DockIcon>
            <DockIcon active={selectedRegionStyle.underline} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, underline: !s.underline }))} label={t('renderPreview.underline')}><Underline size={12} /></DockIcon>
            <DockIcon active={selectedRegionStyle.uppercase} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, uppercase: !s.uppercase }))} label={t('renderPreview.uppercase')} title={t('renderPreview.uppercase')}>
              <span className="font-mono text-[10px] font-bold">{t('renderPreview.iconUppercase')}</span>
            </DockIcon>
          </IconGroup>

          <DockPipe />

          <IconGroup label={t('renderPreview.textOrientation')}>
            <DockIcon active={selectedRegionStyle.textOrientation !== 'vertical'} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, textOrientation: 'horizontal' }))} label={t('renderPreview.horizontal')} title={t('renderPreview.horizontal')}>
              <span className="font-mono text-[10px] font-bold">{t('renderPreview.iconHorizontal')}</span>
            </DockIcon>
            <DockIcon active={selectedRegionStyle.textOrientation === 'vertical'} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, textOrientation: 'vertical' }))} label={t('renderPreview.vertical')} title={t('renderPreview.vertical')}>
              <span className="font-mono text-[10px] font-bold">{t('renderPreview.iconVertical')}</span>
            </DockIcon>
            <DockIcon active={selectedRegionStyle.textPathMode === 'circular'} onClick={() => updateSelectedRegionStyle((s) => ({ ...s, textPathMode: s.textPathMode === 'circular' ? 'normal' : 'circular' }))} label={t('renderPreview.circular')} title={t('renderPreview.circularText')}>
              <span className="font-mono text-[10px] font-bold">{t('renderPreview.iconCircular')}</span>
            </DockIcon>
          </IconGroup>

          <DockPipe />

          <Stepper label={t('renderPreview.rotation')} onDec={() => adjustSelectedRotation(-5)} onInc={() => adjustSelectedRotation(5)}
            decLabel={t('renderPreview.rotateMinus5')} incLabel={t('renderPreview.rotatePlus5')} value={`${Math.round(selectedRegionStyle.rotation)}°`} />
        </div>

        {/* ═══ Row 3: Transform + Actions ═══ */}
        <div className="relative flex flex-wrap items-center gap-1.5">
          <Stepper label={t('renderPreview.skewX')} unit={t('dashboard.render.skewXLabel')}
            onDec={() => updateSelectedRegionStyle((s) => ({ ...s, skewX: normalizeRenderSkew((s.skewX || 0) - 2) }))}
            onInc={() => updateSelectedRegionStyle((s) => ({ ...s, skewX: normalizeRenderSkew((s.skewX || 0) + 2) }))}
            decLabel={t('renderPreview.skewXMinus2')} incLabel={t('renderPreview.skewXPlus2')} value={`${Math.round(selectedRegionStyle.skewX || 0)}°`} />
          <Stepper label={t('renderPreview.skewY')} unit={t('dashboard.render.skewYLabel')}
            onDec={() => updateSelectedRegionStyle((s) => ({ ...s, skewY: normalizeRenderSkew((s.skewY || 0) - 2) }))}
            onInc={() => updateSelectedRegionStyle((s) => ({ ...s, skewY: normalizeRenderSkew((s.skewY || 0) + 2) }))}
            decLabel={t('renderPreview.skewYMinus2')} incLabel={t('renderPreview.skewYPlus2')} value={`${Math.round(selectedRegionStyle.skewY || 0)}°`} />

          <span className="flex-1" />

          <button
            type="button"
            className={cn(
              'panel-cut-sm flex h-7 items-center gap-1.5 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all',
              dockExpanded ? 'bg-crimson text-ink shadow-hard-gold' : 'bg-ink-3 text-paper-dim hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-paper hover:shadow-hard-crimson',
            )}
            onClick={() => setDockExpanded((prev) => !prev)}
            aria-expanded={dockExpanded}
          >
            <Settings size={11} />{t('renderPreview.adjustments')}
          </button>
          <button
            type="button"
            className="panel-cut-sm flex h-7 items-center gap-1.5 bg-gold px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-crimson disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            onClick={() => onRequestRefineRegion?.()}
            disabled={!onRequestRefineRegion || selectedRegionIsNoteOverlay}
          >
            <Sparkles size={11} />{t('renderPreview.refine')}
          </button>
        </div>
      </div>

      {/* ═══ Expanded Fine-Tune Panel ═══ */}
      {dockExpanded && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="glass panel-cut custom-scrollbar relative mt-1.5 max-h-[50vh] w-full max-w-full overflow-y-auto border-azure/30 p-2.5 shadow-hard-crimson"
        >
          <div className="halftone pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
          <span className="kicker relative mb-2 block !text-azure">// {t('renderPreview.adjustments')}</span>

          <div className="relative grid grid-cols-2 gap-2">
            {/* Auto Font Size */}
            <FineField label={t('renderPreview.autoFontSize')}>
              <FineToggle
                checked={selectedRegionStyle.autoFontSize}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, autoFontSize: v, fontSize: DEFAULT_RENDER_STYLE.fontSize, minFontSize: DEFAULT_RENDER_STYLE.minFontSize }))}
                text={selectedRegionStyle.autoFontSize ? t('renderPreview.autoFit') : t('renderPreview.fixed')}
              />
            </FineField>
            {/* Hyphenation */}
            <FineField label={t('renderPreview.hyphenation')}>
              <FineToggle
                checked={selectedRegionStyle.hyphenationEnabled}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, hyphenationEnabled: v }))}
                text={selectedRegionStyle.hyphenationEnabled ? t('renderPreview.enabled') : t('renderPreview.disabled')}
              />
            </FineField>
            {/* Max Font */}
            <FineField label={t('renderPreview.maxSize')}>
              <FineRange min={8} max={160} step={1} value={Math.round(selectedRegionStyle.fontSize)}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, fontSize: v, minFontSize: Math.min(Math.round(s.minFontSize), v) }))}
                display={`${Math.round(selectedRegionStyle.fontSize)}px`} />
            </FineField>
            {/* Min Font */}
            <FineField label={t('renderPreview.minSize')}>
              <FineRange min={6} max={Math.max(6, Math.round(selectedRegionStyle.fontSize))} step={1} value={Math.round(selectedRegionStyle.minFontSize)}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, minFontSize: clamp(v, 6, Math.max(6, Math.round(s.fontSize))) }))}
                display={`${Math.round(selectedRegionStyle.minFontSize)}px`} />
            </FineField>
            {/* Line Spacing */}
            <FineField label={t('renderPreview.lineSpacing')}>
              <FineRange min={0.65} max={2.2} step={0.05} value={selectedRegionStyle.lineSpacing}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, lineSpacing: v }))} display={selectedRegionStyle.lineSpacing.toFixed(2)} />
            </FineField>
            {/* Opacity */}
            <FineField label={t('renderPreview.opacity')}>
              <FineRange min={0.05} max={1} step={0.01} value={selectedRegionStyle.opacity}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, opacity: v }))} display={`${Math.round(selectedRegionStyle.opacity * 100)}%`} />
            </FineField>
            {/* Skew X */}
            <FineField label={t('renderPreview.skewX')}>
              <FineRange min={-45} max={45} step={0.5} value={selectedRegionStyle.skewX || 0}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, skewX: normalizeRenderSkew(v) }))} display={`${(selectedRegionStyle.skewX || 0).toFixed(1)}°`} />
            </FineField>
            {/* Skew Y */}
            <FineField label={t('renderPreview.skewY')}>
              <FineRange min={-45} max={45} step={0.5} value={selectedRegionStyle.skewY || 0}
                onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, skewY: normalizeRenderSkew(v) }))} display={`${(selectedRegionStyle.skewY || 0).toFixed(1)}°`} />
            </FineField>
          </div>

          {/* ═══ Effects Row ═══ */}
          <div className="koma-effects-row relative mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-paper/10 pt-2.5">
            <FillStylePopover
              label={t('renderPreview.fill')}
              value={buildFillPickerValue(selectedRegionStyle)}
              swatches={textFillSwatches}
              onBeforeOpen={saveCurrentSelection}
              onClose={clearPickerState}
              onChange={(nextValue) => {
                updateSelectedRegionStyle((style) => {
                  const nextFill = parseFillPickerValue(nextValue, style.color || '#111111');
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

            <RenderEffectPopover
              label={t('renderPreview.outline')}
              value={selectedRegionStyle.outlineColor}
              enabled={selectedRegionStyle.outlineWidth > 0}
              summary={`${selectedRegionStyle.outlineWidth.toFixed(1)}px`}
              onEnabledChange={(enabled) => updateSelectedRegionStyle((s) => ({ ...s, outlineWidth: enabled ? (s.outlineWidth > 0 ? s.outlineWidth : 2) : 0 }))}
              onColorChange={(nextValue) => updateSelectedRegionStyle((s) => ({ ...s, outlineColor: nextValue }))}
            >
              <div className="koma-effect-popover__field">
                <label htmlFor={`rtp-ol-op-${selectedRegionId}`}>{t('renderPreview.opacity')}</label>
                <input id={`rtp-ol-op-${selectedRegionId}`} type="range" min={0} max={1} step={0.01} value={selectedRegionStyle.outlineOpacity ?? 1} disabled={selectedRegionStyle.outlineWidth <= 0}
                  onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, outlineOpacity: Number(e.target.value) }))} />
                <span className="koma-effect-popover__value">{Math.round((selectedRegionStyle.outlineOpacity ?? 1) * 100)}%</span>
              </div>
              <div className="koma-effect-popover__field">
                <label htmlFor={`rtp-ol-w-${selectedRegionId}`}>{t('settings.modePresets.outlineWidth')}</label>
                <input id={`rtp-ol-w-${selectedRegionId}`} type="range" min={0} max={10} step={0.25} value={selectedRegionStyle.outlineWidth} disabled={selectedRegionStyle.outlineWidth <= 0}
                  onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, outlineWidth: Number(e.target.value) }))} />
                <span className="koma-effect-popover__value">{selectedRegionStyle.outlineWidth.toFixed(2)}</span>
              </div>
            </RenderEffectPopover>

            <RenderEffectPopover
              label={t('renderPreview.shadow')}
              value={buildShadowFillPickerValue(selectedRegionStyle)}
              enabled={selectedRegionStyle.shadowEnabled}
              summary={selectedRegionStyle.shadowLayers?.length
                ? t('renderPreview.shadowLayersCount', { count: selectedRegionStyle.shadowLayers.length })
                : t('renderPreview.shadowBlurSummary', { value: selectedRegionStyle.shadowBlur.toFixed(0) })}
              allowGradient swatches={textFillSwatches}
              onEnabledChange={(enabled) => updateSelectedRegionStyle((s) => ({ ...s, shadowEnabled: enabled }))}
              onColorChange={(nextValue) => updateSelectedRegionStyle((s) => applyShadowFillPickerValueToStyle(s, nextValue))}
            >
              <div className="koma-effect-popover__field-pair">
                <div className="koma-effect-popover__field">
                  <label htmlFor={`rtp-sh-op-${selectedRegionId}`}>{t('renderPreview.opacity')}</label>
                  <input id={`rtp-sh-op-${selectedRegionId}`} type="range" min={0} max={1} step={0.01} value={selectedRegionStyle.shadowOpacity ?? 1} disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowOpacity: Number(e.target.value) }))} />
                  <span className="koma-effect-popover__value">{Math.round((selectedRegionStyle.shadowOpacity ?? 1) * 100)}%</span>
                </div>
                <div className="koma-effect-popover__field">
                  <label htmlFor={`rtp-sh-blur-${selectedRegionId}`}>{t('renderPreview.blur')}</label>
                  <input id={`rtp-sh-blur-${selectedRegionId}`} type="range" min={0} max={30} step={0.5} value={selectedRegionStyle.shadowBlur} disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowBlur: Number(e.target.value) }))} />
                  <span className="koma-effect-popover__value">{selectedRegionStyle.shadowBlur.toFixed(1)}</span>
                </div>
              </div>
              <div className="koma-effect-popover__field-pair">
                <div className="koma-effect-popover__field">
                  <label htmlFor={`rtp-sh-ox-${selectedRegionId}`}>{t('renderPreview.offsetX')}</label>
                  <input id={`rtp-sh-ox-${selectedRegionId}`} type="range" min={-24} max={24} step={1} value={selectedRegionStyle.shadowOffsetX} disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowOffsetX: Number(e.target.value) }))} />
                  <span className="koma-effect-popover__value">{selectedRegionStyle.shadowOffsetX.toFixed(0)}px</span>
                </div>
                <div className="koma-effect-popover__field">
                  <label htmlFor={`rtp-sh-oy-${selectedRegionId}`}>{t('renderPreview.offsetY')}</label>
                  <input id={`rtp-sh-oy-${selectedRegionId}`} type="range" min={-24} max={24} step={1} value={selectedRegionStyle.shadowOffsetY} disabled={!selectedRegionStyle.shadowEnabled}
                    onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowOffsetY: Number(e.target.value) }))} />
                  <span className="koma-effect-popover__value">{selectedRegionStyle.shadowOffsetY.toFixed(0)}px</span>
                </div>
              </div>

              {/* Shadow Layers */}
              <div className="koma-effect-popover__layers">
                <div className="koma-effect-popover__layersHead">
                  <span>{t('renderPreview.shadowLayers')}</span>
                  <button
                    type="button"
                    className="panel-cut-sm bg-crimson px-2 py-1 font-mono text-[9px] font-bold uppercase text-ink transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-gold"
                    onClick={() => updateSelectedRegionStyle((s) => ({ ...s, shadowLayers: [...(s.shadowLayers ?? []), createDefaultShadowLayer()] }))}
                  >
                    {t('renderPreview.addLayer')}
                  </button>
                </div>
                {(selectedRegionStyle.shadowLayers ?? []).map((layer, idx) => (
                  <div
                    key={`shadow-layer-${layer.fillCssValue}-${layer.blur}-${layer.offsetX}-${layer.offsetY}-${idx}`}
                    className="panel-cut-sm mt-1.5 border border-paper/10 bg-ink-3/60 p-2"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <strong className="font-display text-[10px] font-black uppercase tracking-tight text-crimson">{t('renderPreview.layerN', { count: idx + 1 })}</strong>
                      <button
                        type="button"
                        className="panel-cut-sm grid h-5 w-5 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink"
                        onClick={() => updateSelectedRegionStyle((s) => ({ ...s, shadowLayers: (s.shadowLayers ?? []).filter((_, i) => i !== idx) }))}
                        aria-label={t('renderPreview.removeLayerN', { count: idx + 1 })}
                      >
                        <X size={10} />
                      </button>
                    </div>
                    <div className="koma-effect-popover__field koma-effect-popover__field--fill">
                      <span>{t('renderPreview.fill')}</span>
                      <FillStylePopover
                        label={t('renderPreview.shadowLayerN', { count: idx + 1 })}
                        value={layer.fillCssValue} allowGradient swatches={textFillSwatches}
                        onBeforeOpen={saveCurrentSelection} onClose={clearPickerState}
                        onChange={(v) => updateSelectedRegionStyle((s) => ({ ...s, shadowLayers: (s.shadowLayers ?? []).map((entry, i) => i === idx ? { ...entry, fillCssValue: v } : entry) }))}
                      />
                    </div>
                    <div className="koma-effect-popover__field-pair">
                      <div className="koma-effect-popover__field">
                        <label htmlFor={`rtp-sl-op-${selectedRegionId}-${idx}`}>{t('renderPreview.opacity')}</label>
                        <input id={`rtp-sl-op-${selectedRegionId}-${idx}`} type="range" min={0} max={1} step={0.01} value={layer.opacity}
                          onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowLayers: (s.shadowLayers ?? []).map((entry, i) => i === idx ? { ...entry, opacity: Number(e.target.value) } : entry) }))} />
                        <span className="koma-effect-popover__value">{Math.round(layer.opacity * 100)}%</span>
                      </div>
                      <div className="koma-effect-popover__field">
                        <label htmlFor={`rtp-sl-blur-${selectedRegionId}-${idx}`}>{t('renderPreview.blur')}</label>
                        <input id={`rtp-sl-blur-${selectedRegionId}-${idx}`} type="range" min={0} max={40} step={0.5} value={layer.blur}
                          onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowLayers: (s.shadowLayers ?? []).map((entry, i) => i === idx ? { ...entry, blur: Number(e.target.value) } : entry) }))} />
                        <span className="koma-effect-popover__value">{layer.blur.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="koma-effect-popover__field-pair">
                      <div className="koma-effect-popover__field">
                        <label htmlFor={`rtp-sl-ox-${selectedRegionId}-${idx}`}>{t('renderPreview.offsetX')}</label>
                        <input id={`rtp-sl-ox-${selectedRegionId}-${idx}`} type="range" min={-24} max={24} step={1} value={layer.offsetX}
                          onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowLayers: (s.shadowLayers ?? []).map((entry, i) => i === idx ? { ...entry, offsetX: Number(e.target.value) } : entry) }))} />
                        <span className="koma-effect-popover__value">{layer.offsetX.toFixed(0)}px</span>
                      </div>
                      <div className="koma-effect-popover__field">
                        <label htmlFor={`rtp-sl-oy-${selectedRegionId}-${idx}`}>{t('renderPreview.offsetY')}</label>
                        <input id={`rtp-sl-oy-${selectedRegionId}-${idx}`} type="range" min={-24} max={24} step={1} value={layer.offsetY}
                          onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, shadowLayers: (s.shadowLayers ?? []).map((entry, i) => i === idx ? { ...entry, offsetY: Number(e.target.value) } : entry) }))} />
                        <span className="koma-effect-popover__value">{layer.offsetY.toFixed(0)}px</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RenderEffectPopover>

            <TextEffectPopover
              value={selectedRegionStyle.textEffectPreset ?? 'none'}
              presets={NATIVE_TEXT_EFFECT_PRESETS}
              intensity={selectedRegionStyle.textEffectIntensity ?? 1}
              onChange={handleTextEffectChange}
              onIntensityChange={handleTextEffectIntensity}
            />

            <CircularTextPopover
              enabled={selectedRegionStyle.textPathMode === 'circular'}
              summary={`${((selectedRegionStyle.circularRadiusScale || 0.78) * 100).toFixed(0)}%`}
              onEnabledChange={(enabled) => updateSelectedRegionStyle((s) => ({ ...s, textPathMode: enabled ? 'circular' : 'normal' }))}
            >
              <div className="koma-effect-popover__field">
                <label htmlFor={`rtp-circ-r-${selectedRegionId}`}>{t('renderPreview.radius')}</label>
                <input id={`rtp-circ-r-${selectedRegionId}`} type="range" min={0.2} max={1.2} step={0.01} value={selectedRegionStyle.circularRadiusScale || 0.78} disabled={selectedRegionStyle.textPathMode !== 'circular'}
                  onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, circularRadiusScale: Number(e.target.value) }))} />
                <span className="koma-effect-popover__value">{((selectedRegionStyle.circularRadiusScale || 0.78) * 100).toFixed(0)}%</span>
              </div>
              <div className="koma-effect-popover__field">
                <label htmlFor={`rtp-circ-sa-${selectedRegionId}`}>{t('renderPreview.startAngle')}</label>
                <input id={`rtp-circ-sa-${selectedRegionId}`} type="range" min={-180} max={180} step={1} value={selectedRegionStyle.circularStartAngle || -90} disabled={selectedRegionStyle.textPathMode !== 'circular'}
                  onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, circularStartAngle: normalizeRenderRotation(Number(e.target.value)) }))} />
                <span className="koma-effect-popover__value">{(selectedRegionStyle.circularStartAngle || -90).toFixed(0)}°</span>
              </div>
              <div className="koma-effect-popover__field">
                <label htmlFor={`rtp-circ-sp-${selectedRegionId}`}>{t('renderPreview.spacing')}</label>
                <input id={`rtp-circ-sp-${selectedRegionId}`} type="range" min={0.5} max={2.5} step={0.05} value={selectedRegionStyle.circularLetterSpacing || 1} disabled={selectedRegionStyle.textPathMode !== 'circular'}
                  onChange={(e) => updateSelectedRegionStyle((s) => ({ ...s, circularLetterSpacing: Number(e.target.value) }))} />
                <span className="koma-effect-popover__value">{(selectedRegionStyle.circularLetterSpacing || 1).toFixed(2)}x</span>
              </div>
            </CircularTextPopover>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default React.memo(RenderTextPreviewTypeDockNoir);
