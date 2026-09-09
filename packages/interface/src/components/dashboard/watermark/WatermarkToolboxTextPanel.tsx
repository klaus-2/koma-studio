import type { Dispatch, SetStateAction } from 'react';
import { Type } from 'lucide-react';

import { AioSection } from '@/pages/AioSection.js';
import { useI18n } from '../../../i18n';
import type { WatermarkDraft } from './watermarkTypes';
import { FONT_OPTIONS } from './watermark-ui-constants';

type WatermarkTextPanelProps = {
  draft: WatermarkDraft;
  setDraft: Dispatch<SetStateAction<WatermarkDraft>>;
};

export default function WatermarkTextPanel({ draft, setDraft }: WatermarkTextPanelProps) {
  const { t } = useI18n();
  const updateTextLayer = (patch: Partial<WatermarkDraft['textLayer']>) =>
    setDraft((current) => ({
      ...current,
      textLayer: { ...current.textLayer, ...patch },
    }));

  return (
    <AioSection icon={Type} title={t('watermark.panel.text')}>
      <label className="koma-wm-layer-toggle">
        <input
          type="checkbox"
          checked={draft.textLayer.enabled}
          onChange={(e) => updateTextLayer({ enabled: e.target.checked })}
        />
        <span>{t('watermark.text.enable')}</span>
      </label>
      <div className="koma-wm-fields--full">
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.content')}</label>
          <input
            type="text"
            className="koma-input"
            value={draft.textLayer.text}
            onChange={(e) => updateTextLayer({ text: e.target.value })}
            placeholder={t('watermark.text.placeholder')}
          />
        </div>
      </div>
      <div className="koma-wm-fields">
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.font')}</label>
          <select
            className="koma-select"
            value={draft.textLayer.fontFamily}
            onChange={(e) => updateTextLayer({ fontFamily: e.target.value })}
          >
            {FONT_OPTIONS.map((fontFamily) => (
              <option key={fontFamily} value={fontFamily}>{fontFamily}</option>
            ))}
          </select>
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.size')}</label>
          <input
            type="number"
            min={12}
            max={160}
            className="koma-input"
            value={draft.textLayer.fontSize}
            onChange={(e) => updateTextLayer({ fontSize: Number(e.target.value) || draft.textLayer.fontSize })}
          />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.color')}</label>
          <input type="color" className="koma-wm-color-input" value={draft.textLayer.color} onChange={(e) => updateTextLayer({ color: e.target.value })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.outline')}</label>
          <input type="number" min={0} max={12} className="koma-input" value={draft.textLayer.outlineWidth} onChange={(e) => updateTextLayer({ outlineWidth: Number(e.target.value) || 0 })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.outlineColor')}</label>
          <input type="color" className="koma-wm-color-input" value={draft.textLayer.outlineColor} onChange={(e) => updateTextLayer({ outlineColor: e.target.value })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.opacity')}</label>
          <input type="range" min={0.05} max={1} step={0.01} className="koma-range" value={draft.textLayer.opacity} onChange={(e) => updateTextLayer({ opacity: Number(e.target.value) })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.shadowBlur')}</label>
          <input type="range" min={0} max={40} step={1} className="koma-range" value={draft.textLayer.shadowBlur} onChange={(e) => updateTextLayer({ shadowBlur: Number(e.target.value) })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.text.shadowColor')}</label>
          <input type="color" className="koma-wm-color-input" value={draft.textLayer.shadowColor} onChange={(e) => updateTextLayer({ shadowColor: e.target.value })} />
        </div>
      </div>
    </AioSection>
  );
}
