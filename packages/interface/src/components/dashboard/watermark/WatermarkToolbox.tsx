import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Stamp } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type {
  WatermarkDraft,
  WatermarkLoadedImage,
  WatermarkPresetV1,
} from './watermarkTypes';
import WatermarkDistributionPanel from './WatermarkToolboxDistributionPanel';
import WatermarkExecuteBar from './WatermarkToolboxExecuteBar';
import WatermarkLogoPanel from './WatermarkToolboxLogoPanel';
import WatermarkPresetPanel from './WatermarkToolboxPresetPanel';
import WatermarkShadowPanel from './WatermarkToolboxShadowPanel';
import WatermarkTextAvoidancePanel from './WatermarkToolboxTextAvoidancePanel';
import WatermarkTextPanel from './WatermarkToolboxTextPanel';

type WatermarkToolboxProps = {
  allPresets: WatermarkPresetV1[];
  selectedPresetId: string;
  isUserPreset: boolean;
  draft: WatermarkDraft;
  watermarkImageFile: File | null;
  watermarkImagePreview: string | null;
  activeImage: WatermarkLoadedImage | null;
  imagesCount: number;
  activeTextZonesCount: number;
  detectingTextZones: boolean;
  showTextZoneOverlay: boolean;
  processing: boolean;
  hasRenderableLayer: boolean;
  setDraft: Dispatch<SetStateAction<WatermarkDraft>>;
  setWatermarkImageFile: Dispatch<SetStateAction<File | null>>;
  setWatermarkImagePreview: Dispatch<SetStateAction<string | null>>;
  onApplyPreset: (preset: WatermarkPresetV1) => void;
  onSaveCurrentPreset: () => void;
  onDuplicateSelectedPreset: () => void;
  onRenameSelectedPreset: () => void;
  onDeleteSelectedPreset: () => void;
  onWatermarkImageChange: (ev: ChangeEvent<HTMLInputElement>) => void;
  onApplySmartSuggestion: () => Promise<void>;
  onDetectTextZones: (image: WatermarkLoadedImage) => Promise<void>;
  onDetectAllTextZones: () => Promise<void>;
  setShowTextZoneOverlay: Dispatch<SetStateAction<boolean>>;
  onProcessBatch: () => Promise<void>;
  onCancelBatch: () => void;
};

export default function WatermarkToolbox({
  allPresets,
  selectedPresetId,
  isUserPreset,
  draft,
  watermarkImageFile,
  watermarkImagePreview,
  activeImage,
  imagesCount,
  activeTextZonesCount,
  detectingTextZones,
  showTextZoneOverlay,
  processing,
  hasRenderableLayer,
  setDraft,
  setWatermarkImageFile,
  setWatermarkImagePreview,
  onApplyPreset,
  onSaveCurrentPreset,
  onDuplicateSelectedPreset,
  onRenameSelectedPreset,
  onDeleteSelectedPreset,
  onWatermarkImageChange,
  onApplySmartSuggestion,
  onDetectTextZones,
  onDetectAllTextZones,
  setShowTextZoneOverlay,
  onProcessBatch,
  onCancelBatch,
}: WatermarkToolboxProps) {
  const { t } = useI18n();

  return (
    <div className="koma-wm-toolbox">
      <div className="koma-wm-header">
        <div className="koma-wm-header__title-group">
          <span className="koma-wm-header__eyebrow">{t('watermark.header.eyebrow')}</span>
          <h2 className="koma-wm-header__title">{t('watermark.header.title')}</h2>
        </div>
        <span className="koma-wm-header__badge">
          <Stamp size={10} /> {t('watermark.header.badge')}
        </span>
      </div>

      <WatermarkPresetPanel
        allPresets={allPresets}
        selectedPresetId={selectedPresetId}
        isUserPreset={isUserPreset}
        onApplyPreset={onApplyPreset}
        onSaveCurrentPreset={onSaveCurrentPreset}
        onDuplicateSelectedPreset={onDuplicateSelectedPreset}
        onRenameSelectedPreset={onRenameSelectedPreset}
        onDeleteSelectedPreset={onDeleteSelectedPreset}
      />
      <WatermarkTextPanel draft={draft} setDraft={setDraft} />
      <WatermarkLogoPanel
        draft={draft}
        setDraft={setDraft}
        watermarkImageFile={watermarkImageFile}
        watermarkImagePreview={watermarkImagePreview}
        setWatermarkImageFile={setWatermarkImageFile}
        setWatermarkImagePreview={setWatermarkImagePreview}
        onWatermarkImageChange={onWatermarkImageChange}
      />
      <WatermarkShadowPanel draft={draft} setDraft={setDraft} />
      <WatermarkDistributionPanel
        draft={draft}
        setDraft={setDraft}
        activeImage={activeImage}
        onApplySmartSuggestion={onApplySmartSuggestion}
      />
      <WatermarkTextAvoidancePanel
        draft={draft}
        setDraft={setDraft}
        activeImage={activeImage}
        imagesCount={imagesCount}
        activeTextZonesCount={activeTextZonesCount}
        detectingTextZones={detectingTextZones}
        showTextZoneOverlay={showTextZoneOverlay}
        setShowTextZoneOverlay={setShowTextZoneOverlay}
        onDetectTextZones={onDetectTextZones}
        onDetectAllTextZones={onDetectAllTextZones}
      />
      <WatermarkExecuteBar
        processing={processing}
        imagesCount={imagesCount}
        hasRenderableLayer={hasRenderableLayer}
        onProcessBatch={onProcessBatch}
        onCancelBatch={onCancelBatch}
      />
    </div>
  );
}
