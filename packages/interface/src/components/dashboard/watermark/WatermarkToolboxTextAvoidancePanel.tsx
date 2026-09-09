import type { Dispatch, SetStateAction } from 'react';
import { ScanSearch, ShieldCheck } from 'lucide-react';

import { AioSection } from '@/pages/AioSection.js';
import { useI18n } from '../../../i18n';
import type { WatermarkDraft, WatermarkLoadedImage } from './watermarkTypes';

type WatermarkTextAvoidancePanelProps = {
  draft: WatermarkDraft;
  setDraft: Dispatch<SetStateAction<WatermarkDraft>>;
  activeImage: WatermarkLoadedImage | null;
  imagesCount: number;
  activeTextZonesCount: number;
  detectingTextZones: boolean;
  showTextZoneOverlay: boolean;
  setShowTextZoneOverlay: Dispatch<SetStateAction<boolean>>;
  onDetectTextZones: (image: WatermarkLoadedImage) => Promise<void>;
  onDetectAllTextZones: () => Promise<void>;
};

export default function WatermarkTextAvoidancePanel({
  draft,
  setDraft,
  activeImage,
  imagesCount,
  activeTextZonesCount,
  detectingTextZones,
  showTextZoneOverlay,
  setShowTextZoneOverlay,
  onDetectTextZones,
  onDetectAllTextZones,
}: WatermarkTextAvoidancePanelProps) {
  const { t } = useI18n();

  return (
    <AioSection icon={ShieldCheck} title={t('watermark.panel.textAvoidance')} defaultOpen={false}>
      <label className="koma-wm-layer-toggle">
        <input
          type="checkbox"
          checked={draft.avoidTextRegions}
          onChange={(e) => setDraft((current) => ({ ...current, avoidTextRegions: e.target.checked }))}
        />
        <span>{t('watermark.textAvoidance.enable')}</span>
      </label>
      <p className="koma-wm-avoidance-desc">{t('watermark.textAvoidance.desc')}</p>
      <div className="koma-wm-avoidance-actions">
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={() => activeImage && void onDetectTextZones(activeImage)}
          disabled={!activeImage || detectingTextZones}
        >
          <ScanSearch size={11} />
          {detectingTextZones
            ? t('watermark.textAvoidance.detecting')
            : t('watermark.textAvoidance.detectCurrent')}
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={() => void onDetectAllTextZones()}
          disabled={detectingTextZones || !imagesCount}
        >
          <ScanSearch size={11} /> {t('watermark.textAvoidance.detectAll')}
        </button>
      </div>
      {activeTextZonesCount > 0 && (
        <div className="koma-wm-avoidance-status">
          <span className="koma-wm-avoidance-status__badge">
            {activeTextZonesCount} {t('watermark.textAvoidance.zonesFound')}
          </span>
          <label className="koma-wm-layer-toggle">
            <input
              type="checkbox"
              checked={showTextZoneOverlay}
              onChange={(e) => setShowTextZoneOverlay(e.target.checked)}
            />
            <span>{t('watermark.textAvoidance.showOverlay')}</span>
          </label>
        </div>
      )}
    </AioSection>
  );
}
