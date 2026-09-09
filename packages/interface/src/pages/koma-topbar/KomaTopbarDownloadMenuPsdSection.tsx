import { AlertTriangle, Layers } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { PsdCompression } from './KomaTopbar.shared';

type KomaTopbarDownloadMenuPsdSectionProps = {
  modeIsAio: boolean;
  canExportPsd: boolean;
  downloadPsdLoading: boolean;
  downloadPsdCompression: PsdCompression;
  onDownloadPsdCompressionChange: (v: PsdCompression) => void;
  downloadPsdDpi: number;
  onDownloadPsdDpiChange: (v: number) => void;
  downloadPsdIncludeOcrOverlay: boolean;
  onDownloadPsdIncludeOcrOverlayChange: (v: boolean) => void;
  downloadPsdIncludeIndividualCrops: boolean;
  onDownloadPsdIncludeIndividualCropsChange: (v: boolean) => void;
  downloadPsdIncludeRawTextLayer: boolean;
  onDownloadPsdIncludeRawTextLayerChange: (v: boolean) => void;
  downloadPsdIncludeTranslatedTextLayer: boolean;
  onDownloadPsdIncludeTranslatedTextLayerChange: (v: boolean) => void;
  downloadPsdUsePhotoshopTextLayers: boolean;
  onDownloadPsdUsePhotoshopTextLayersChange: (v: boolean) => void;
  downloadPsdIncludeMetadataJson: boolean;
  onDownloadPsdIncludeMetadataJsonChange: (v: boolean) => void;
  hasAioRenderRegionsForPsd: boolean;
  onDownloadPsd: () => void;
};

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export default function KomaTopbarDownloadMenuPsdSection({
  modeIsAio,
  canExportPsd,
  downloadPsdLoading,
  downloadPsdCompression,
  onDownloadPsdCompressionChange,
  downloadPsdDpi,
  onDownloadPsdDpiChange,
  downloadPsdIncludeOcrOverlay,
  onDownloadPsdIncludeOcrOverlayChange,
  downloadPsdIncludeIndividualCrops,
  onDownloadPsdIncludeIndividualCropsChange,
  downloadPsdIncludeRawTextLayer,
  onDownloadPsdIncludeRawTextLayerChange,
  downloadPsdIncludeTranslatedTextLayer,
  onDownloadPsdIncludeTranslatedTextLayerChange,
  downloadPsdUsePhotoshopTextLayers,
  onDownloadPsdUsePhotoshopTextLayersChange,
  downloadPsdIncludeMetadataJson,
  onDownloadPsdIncludeMetadataJsonChange,
  hasAioRenderRegionsForPsd,
  onDownloadPsd,
}: KomaTopbarDownloadMenuPsdSectionProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="koma-dlmenu__divider" />
      <div className="koma-dlmenu__section">
        <div className="koma-dlmenu__section-head">
          <Layers size={13} />
          <span>{t('dashboard.topbar.layeredPsd')}</span>
        </div>
        <p className="koma-dlmenu__hint">{t('dashboard.topbar.layeredPsdHint')}</p>
        <label className="koma-dlfield">
          <span className="koma-dlfield__label">{t('dashboard.topbar.compression')}</span>
          <select
            className="koma-dlfield__select"
            value={downloadPsdCompression}
            onChange={(e) => onDownloadPsdCompressionChange(e.target.value as PsdCompression)}
          >
            <option value="rle">{t('dashboard.topbar.compressionRle')}</option>
            <option value="zip">{t('dashboard.topbar.compressionZip')}</option>
            <option value="raw">{t('dashboard.topbar.compressionRaw')}</option>
          </select>
        </label>
        <label className="koma-dlfield">
          <span className="koma-dlfield__label">{t('dashboard.topbar.dpi')}</span>
          <input
            type="number"
            min={72}
            max={1200}
            value={downloadPsdDpi}
            onChange={(e) => onDownloadPsdDpiChange(clamp(Number(e.target.value) || 300, 72, 1200))}
            className="koma-dlfield__input"
          />
        </label>
        <div className="koma-dlmenu__checks">
          <CheckRow checked={downloadPsdIncludeOcrOverlay} onChange={onDownloadPsdIncludeOcrOverlayChange} label={t('dashboard.topbar.ocrOverlay')} />
          <CheckRow checked={downloadPsdIncludeIndividualCrops} onChange={onDownloadPsdIncludeIndividualCropsChange} label={t('dashboard.topbar.crops')} />
          <CheckRow checked={downloadPsdIncludeRawTextLayer} disabled={!modeIsAio || !hasAioRenderRegionsForPsd} onChange={onDownloadPsdIncludeRawTextLayerChange} label={t('dashboard.topbar.rawTextLayer')} />
          <CheckRow checked={downloadPsdIncludeTranslatedTextLayer} disabled={!modeIsAio || !hasAioRenderRegionsForPsd} onChange={onDownloadPsdIncludeTranslatedTextLayerChange} label={t('dashboard.topbar.translatedLayer')} />
          <CheckRow checked={downloadPsdUsePhotoshopTextLayers} onChange={onDownloadPsdUsePhotoshopTextLayersChange} label={t('dashboard.topbar.psTextLayers')} />
          <CheckRow checked={downloadPsdIncludeMetadataJson} onChange={onDownloadPsdIncludeMetadataJsonChange} label={t('dashboard.topbar.metadataJson')} />
        </div>
        {downloadPsdUsePhotoshopTextLayers && (
          <div className="koma-dlmenu__warn">
            <AlertTriangle size={11} />
            <span>{t('dashboard.topbar.photoshopRequired')}</span>
          </div>
        )}
        <button
          type="button"
          className="koma-dlmenu__action koma-dlmenu__action--ghost"
          disabled={!canExportPsd || downloadPsdLoading}
          onClick={onDownloadPsd}
        >
          <Layers size={12} />
          {downloadPsdLoading
            ? t('dashboard.topbar.generating')
            : downloadPsdIncludeMetadataJson
              ? t('dashboard.topbar.psdWithMeta')
              : t('dashboard.topbar.exportPsd')}
        </button>
      </div>
    </>
  );
}

function CheckRow({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="koma-dlcheck">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
