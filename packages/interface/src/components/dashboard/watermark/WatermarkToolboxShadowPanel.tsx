import type { Dispatch, SetStateAction } from 'react';
import { Sparkles } from 'lucide-react';

import { AioSection } from '@/pages/AioSection.js';
import { useI18n } from '../../../i18n';
import { createDefaultWatermarkDraft } from './watermark-core.js';
import type { WatermarkDraft } from './watermarkTypes';

type WatermarkShadowPanelProps = {
  draft: WatermarkDraft;
  setDraft: Dispatch<SetStateAction<WatermarkDraft>>;
};

export default function WatermarkShadowPanel({ draft, setDraft }: WatermarkShadowPanelProps) {
  const { t } = useI18n();
  const updateShadowLayer = (patch: Partial<WatermarkDraft['shadowLayer']>) =>
    setDraft((current) => ({
      ...current,
      shadowLayer: {
        ...(current.shadowLayer ?? createDefaultWatermarkDraft().shadowLayer),
        ...patch,
      },
    }));

  return (
    <AioSection icon={Sparkles} title={t('watermark.panel.shadow')} defaultOpen={false}>
      <label className="koma-wm-layer-toggle">
        <input
          type="checkbox"
          checked={draft.shadowLayer?.enabled ?? false}
          onChange={(e) => updateShadowLayer({ enabled: e.target.checked })}
        />
        <span>{t('watermark.shadow.enable')}</span>
      </label>
      <div className="koma-wm-fields">
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.shadow.blur')}</label>
          <input type="range" min={0} max={40} step={1} className="koma-range" value={draft.shadowLayer?.blur ?? 12} onChange={(e) => updateShadowLayer({ blur: Number(e.target.value) })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.shadow.opacity')}</label>
          <input type="range" min={0.05} max={1} step={0.01} className="koma-range" value={draft.shadowLayer?.opacity ?? 0.4} onChange={(e) => updateShadowLayer({ opacity: Number(e.target.value) })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.shadow.color')}</label>
          <input type="color" className="koma-wm-color-input" value={draft.shadowLayer?.color ?? '#000000'} onChange={(e) => updateShadowLayer({ color: e.target.value })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.shadow.offsetY')}</label>
          <input type="range" min={-20} max={20} step={1} className="koma-range" value={draft.shadowLayer?.offsetY ?? 4} onChange={(e) => updateShadowLayer({ offsetY: Number(e.target.value) })} />
        </div>
      </div>
    </AioSection>
  );
}
