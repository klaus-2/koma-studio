import type { Dispatch, SetStateAction } from 'react';
import { Sparkles, Zap } from 'lucide-react';

import { AioSection } from '@/pages/AioSection.js';
import { useI18n } from '../../../i18n';
import type { WatermarkDraft, WatermarkLoadedImage } from './watermarkTypes';
import { ANCHOR_OPTIONS, BLEND_OPTIONS } from './watermark-ui-constants';

const PLACEMENT_MODES: Array<WatermarkDraft['placementMode']> = [
  'single',
  'tile',
  'grid',
  'smart',
  'multi',
];

type WatermarkDistributionPanelProps = {
  draft: WatermarkDraft;
  setDraft: Dispatch<SetStateAction<WatermarkDraft>>;
  activeImage: WatermarkLoadedImage | null;
  onApplySmartSuggestion: () => Promise<void>;
};

export default function WatermarkDistributionPanel({
  draft,
  setDraft,
  activeImage,
  onApplySmartSuggestion,
}: WatermarkDistributionPanelProps) {
  const { t } = useI18n();
  const labelForMode = (mode: WatermarkDraft['placementMode']) => {
    if (mode === 'single') return t('common.single');
    if (mode === 'tile') return t('common.tile');
    if (mode === 'grid') return t('common.grid');
    if (mode === 'smart') return t('common.smart');
    return 'Multi';
  };

  return (
    <AioSection icon={Zap} title={t('watermark.panel.distribution')}>
      <div className="koma-wm-distribution-row">
        <div className="koma-wm-anchor-grid" role="group" aria-label={t('watermark.distribution.position')}>
          {ANCHOR_OPTIONS.map((anchor) => (
            <button
              key={anchor.value}
              type="button"
              className={`koma-wm-anchor-btn${(
                draft.placementMode === 'multi'
                  ? (draft.multiAnchors ?? []).includes(anchor.value)
                  : draft.anchor === anchor.value
              ) ? ' koma-wm-anchor-btn--active' : ''}`}
              onClick={() =>
                setDraft((current) => {
                  if (current.placementMode === 'multi') {
                    const previous = current.multiAnchors ?? [];
                    const next = previous.includes(anchor.value)
                      ? previous.filter((value) => value !== anchor.value)
                      : [...previous, anchor.value];
                    return { ...current, multiAnchors: next, anchor: next[0] ?? current.anchor };
                  }
                  return {
                    ...current,
                    anchor: anchor.value,
                    placementMode: current.placementMode === 'smart' ? 'single' : current.placementMode,
                  };
                })
              }
            >
              {anchor.label}
            </button>
          ))}
        </div>
        <div className="koma-wm-placement-row">
          {PLACEMENT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`koma-wm-placement-chip${draft.placementMode === mode ? ' koma-wm-placement-chip--active' : ''}`}
              onClick={() => setDraft((current) => ({ ...current, placementMode: mode }))}
            >
              {labelForMode(mode)}
            </button>
          ))}
        </div>
      </div>
      <div className="koma-wm-fields">
        <WatermarkNumberField label={t('watermark.distribution.rotation')} value={draft.rotation} type="range" min={-180} max={180} onChange={(value) => setDraft((current) => ({ ...current, rotation: value }))} />
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.distribution.blend')}</label>
          <select
            className="koma-select"
            value={draft.blendMode}
            onChange={(e) => setDraft((current) => ({ ...current, blendMode: e.target.value as WatermarkDraft['blendMode'] }))}
          >
            {BLEND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </select>
        </div>
        <WatermarkNumberField label={t('watermark.distribution.gapX')} value={draft.gapX} min={40} max={640} onChange={(value) => setDraft((current) => ({ ...current, gapX: value || current.gapX }))} />
        <WatermarkNumberField label={t('watermark.distribution.gapY')} value={draft.gapY} min={40} max={640} onChange={(value) => setDraft((current) => ({ ...current, gapY: value || current.gapY }))} />
        <WatermarkNumberField label={t('watermark.distribution.padding')} value={draft.padding} min={0} max={160} onChange={(value) => setDraft((current) => ({ ...current, padding: value || current.padding }))} />
        <WatermarkNumberField label={t('watermark.distribution.offsetX')} value={draft.offsetX} min={-500} max={500} onChange={(value) => setDraft((current) => ({ ...current, offsetX: value || 0 }))} />
        <WatermarkNumberField label={t('watermark.distribution.offsetY')} value={draft.offsetY} min={-500} max={500} onChange={(value) => setDraft((current) => ({ ...current, offsetY: value || 0 }))} />
        <WatermarkNumberField label={t('watermark.distribution.density')} value={draft.density} type="range" min={2} max={8} onChange={(value) => setDraft((current) => ({ ...current, density: value }))} />
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.distribution.baseName')}</label>
          <input type="text" className="koma-input" value={draft.baseName} onChange={(e) => setDraft((current) => ({ ...current, baseName: e.target.value }))} />
        </div>
      </div>
      <button type="button" className="koma-btn koma-btn--ghost koma-btn--full" onClick={() => void onApplySmartSuggestion()} disabled={!activeImage}>
        <Sparkles size={11} /> {t('watermark.distribution.smartPlacement')}
      </button>
    </AioSection>
  );
}

function WatermarkNumberField({
  label,
  value,
  onChange,
  type = 'number',
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  type?: 'number' | 'range';
  min: number;
  max: number;
}) {
  return (
    <div className="koma-field">
      <label className="koma-field__label">{label}</label>
      <input
        type={type}
        min={min}
        max={max}
        step={1}
        className={type === 'range' ? 'koma-range' : 'koma-input'}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
