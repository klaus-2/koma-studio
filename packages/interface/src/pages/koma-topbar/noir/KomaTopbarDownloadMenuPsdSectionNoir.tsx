import { AlertTriangle, Layers } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { PsdCompression } from '../KomaTopbar.shared';
import { cn } from '../KomaTopbar.shared';
import { CheckRow, Field, inputCls, selectCls } from './KomaTopbarDownloadMenuNoir';

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

export default function KomaTopbarDownloadMenuPsdSectionNoir({
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
    <div className="mt-3 flex flex-col gap-2.5 border-t-2 border-dashed border-azure/25 pt-3">
      <div className="flex items-center gap-2">
        <Layers size={13} className="text-azure" />
        <span className="kicker !text-azure">// {t('dashboard.topbar.layeredPsd')}</span>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-paper-dim">{t('dashboard.topbar.layeredPsdHint')}</p>

      <Field label={t('dashboard.topbar.compression')}>
        <select className={selectCls} value={downloadPsdCompression} onChange={(e) => onDownloadPsdCompressionChange(e.target.value as PsdCompression)}>
          <option value="rle">{t('dashboard.topbar.compressionRle')}</option>
          <option value="zip">{t('dashboard.topbar.compressionZip')}</option>
          <option value="raw">{t('dashboard.topbar.compressionRaw')}</option>
        </select>
      </Field>
      <Field label={t('dashboard.topbar.dpi')}>
        <input
          type="number"
          min={72}
          max={1200}
          value={downloadPsdDpi}
          onChange={(e) => onDownloadPsdDpiChange(clamp(Number(e.target.value) || 300, 72, 1200))}
          className={inputCls}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <CheckRow checked={downloadPsdIncludeOcrOverlay} onChange={onDownloadPsdIncludeOcrOverlayChange} label={t('dashboard.topbar.ocrOverlay')} />
        <CheckRow checked={downloadPsdIncludeIndividualCrops} onChange={onDownloadPsdIncludeIndividualCropsChange} label={t('dashboard.topbar.crops')} />
        <CheckRow checked={downloadPsdIncludeRawTextLayer} disabled={!modeIsAio || !hasAioRenderRegionsForPsd} onChange={onDownloadPsdIncludeRawTextLayerChange} label={t('dashboard.topbar.rawTextLayer')} />
        <CheckRow checked={downloadPsdIncludeTranslatedTextLayer} disabled={!modeIsAio || !hasAioRenderRegionsForPsd} onChange={onDownloadPsdIncludeTranslatedTextLayerChange} label={t('dashboard.topbar.translatedLayer')} />
        <CheckRow checked={downloadPsdUsePhotoshopTextLayers} onChange={onDownloadPsdUsePhotoshopTextLayersChange} label={t('dashboard.topbar.psTextLayers')} />
        <CheckRow checked={downloadPsdIncludeMetadataJson} onChange={onDownloadPsdIncludeMetadataJsonChange} label={t('dashboard.topbar.metadataJson')} />
      </div>

      {downloadPsdUsePhotoshopTextLayers && (
        <div className="panel-cut-sm flex items-center gap-2 bg-gold/15 px-2.5 py-1.5">
          <AlertTriangle size={12} className="shrink-0 text-gold" />
          <span className="font-mono text-[10px] text-gold">{t('dashboard.topbar.photoshopRequired')}</span>
        </div>
      )}

      <button
        type="button"
        disabled={!canExportPsd || downloadPsdLoading}
        onClick={onDownloadPsd}
        className={cn(
          'panel-cut-sm flex items-center justify-center gap-2 border border-azure/40 bg-azure/10 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-azure transition-all duration-200',
          'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-azure hover:text-ink hover:shadow-hard-gold',
          (!canExportPsd || downloadPsdLoading) && 'cursor-not-allowed opacity-30 hover:translate-x-0 hover:translate-y-0 hover:bg-azure/10 hover:text-azure hover:shadow-none',
        )}
      >
        <Layers size={12} />
        {downloadPsdLoading
          ? t('dashboard.topbar.generating')
          : downloadPsdIncludeMetadataJson
            ? t('dashboard.topbar.psdWithMeta')
            : t('dashboard.topbar.exportPsd')}
      </button>
    </div>
  );
}
