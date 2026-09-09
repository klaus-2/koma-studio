import { Copy, Layers, Pencil, Save, Trash2 } from 'lucide-react';

import { AioSection } from '@/pages/AioSection.js';
import { useI18n } from '../../../i18n';
import type { WatermarkPresetV1 } from './watermarkTypes';

type WatermarkPresetPanelProps = {
  allPresets: WatermarkPresetV1[];
  selectedPresetId: string;
  isUserPreset: boolean;
  onApplyPreset: (preset: WatermarkPresetV1) => void;
  onSaveCurrentPreset: () => void;
  onDuplicateSelectedPreset: () => void;
  onRenameSelectedPreset: () => void;
  onDeleteSelectedPreset: () => void;
};

export default function WatermarkPresetPanel({
  allPresets,
  selectedPresetId,
  isUserPreset,
  onApplyPreset,
  onSaveCurrentPreset,
  onDuplicateSelectedPreset,
  onRenameSelectedPreset,
  onDeleteSelectedPreset,
}: WatermarkPresetPanelProps) {
  const { t } = useI18n();

  return (
    <AioSection icon={Layers} title={t('watermark.panel.presets')} defaultOpen={false}>
      <div className="koma-wm-presets">
        {allPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`koma-wm-preset${selectedPresetId === preset.id ? ' koma-wm-preset--active' : ''}`}
            onClick={() => onApplyPreset(preset)}
          >
            <span className="koma-wm-preset__name">{preset.name}</span>
            <span className="koma-wm-preset__kind">
              {preset.kind === 'builtin'
                ? t('watermark.presets.builtin')
                : t('watermark.presets.user')}
            </span>
          </button>
        ))}
      </div>
      <div className="koma-wm-preset-actions">
        <button type="button" className="koma-btn koma-btn--ghost" onClick={onSaveCurrentPreset}>
          <Save size={10} /> {t('watermark.action.save')}
        </button>
        <button type="button" className="koma-btn koma-btn--ghost" onClick={onDuplicateSelectedPreset}>
          <Copy size={10} /> {t('watermark.action.duplicate')}
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={onRenameSelectedPreset}
          disabled={!isUserPreset}
        >
          <Pencil size={10} />
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={onDeleteSelectedPreset}
          disabled={!isUserPreset}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </AioSection>
  );
}
