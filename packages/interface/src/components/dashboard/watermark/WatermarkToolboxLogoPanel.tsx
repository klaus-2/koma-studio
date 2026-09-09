import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';

import { AioSection } from '@/pages/AioSection.js';
import { useI18n } from '../../../i18n';
import type { WatermarkDraft } from './watermarkTypes';

type WatermarkLogoPanelProps = {
  draft: WatermarkDraft;
  setDraft: Dispatch<SetStateAction<WatermarkDraft>>;
  watermarkImageFile: File | null;
  watermarkImagePreview: string | null;
  setWatermarkImageFile: Dispatch<SetStateAction<File | null>>;
  setWatermarkImagePreview: Dispatch<SetStateAction<string | null>>;
  onWatermarkImageChange: (ev: ChangeEvent<HTMLInputElement>) => void;
};

export default function WatermarkLogoPanel({
  draft,
  setDraft,
  watermarkImageFile,
  watermarkImagePreview,
  setWatermarkImageFile,
  setWatermarkImagePreview,
  onWatermarkImageChange,
}: WatermarkLogoPanelProps) {
  const { t } = useI18n();
  const updateImageLayer = (patch: Partial<WatermarkDraft['imageLayer']>) =>
    setDraft((current) => ({
      ...current,
      imageLayer: { ...current.imageLayer, ...patch },
    }));

  return (
    <AioSection icon={ImageIcon} title={t('watermark.panel.logo')} defaultOpen={false}>
      <div className="koma-wm-logo-row">
        <label className="koma-wm-layer-toggle">
          <input
            type="checkbox"
            checked={draft.imageLayer.enabled}
            onChange={(e) => updateImageLayer({ enabled: e.target.checked })}
          />
          <span>{t('watermark.logo.enable')}</span>
        </label>
        <label className="koma-btn koma-btn--ghost koma-btn--sm">
          <Upload size={10} />
          <span>{watermarkImageFile ? t('watermark.logo.change') : t('watermark.logo.upload')}</span>
          <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={onWatermarkImageChange} />
        </label>
        {watermarkImagePreview && (
          <div className="koma-wm-logo-preview">
            <img src={watermarkImagePreview} alt={t('watermark.logo.alt')} />
            <button
              type="button"
              className="koma-wm-logo-preview__remove"
              onClick={() => {
                setWatermarkImageFile(null);
                setWatermarkImagePreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return null;
                });
                updateImageLayer({ enabled: false });
              }}
              aria-label={t('watermark.logo.remove')}
            >
              <X size={8} />
            </button>
          </div>
        )}
      </div>
      <div className="koma-wm-fields">
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.logo.scale')}</label>
          <input type="range" min={4} max={48} step={1} className="koma-range" value={draft.imageLayer.scalePercent} onChange={(e) => updateImageLayer({ scalePercent: Number(e.target.value) })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.logo.opacity')}</label>
          <input type="range" min={0.05} max={1} step={0.01} className="koma-range" value={draft.imageLayer.opacity} onChange={(e) => updateImageLayer({ opacity: Number(e.target.value) })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.logo.brightness')}</label>
          <input type="range" min={40} max={160} step={1} className="koma-range" value={draft.imageLayer.brightness} onChange={(e) => updateImageLayer({ brightness: Number(e.target.value) })} />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('watermark.logo.saturation')}</label>
          <input type="range" min={0} max={160} step={1} className="koma-range" value={draft.imageLayer.saturation} onChange={(e) => updateImageLayer({ saturation: Number(e.target.value) })} />
        </div>
      </div>
    </AioSection>
  );
}
