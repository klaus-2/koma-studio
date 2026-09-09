import type { RefObject } from 'react';
import { ChevronDown, Download } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import { useI18n } from '../../i18n';
import type {
  DownloadBundleFormat,
  PsdCompression,
} from './KomaTopbar.shared';
import { cn } from './KomaTopbar.shared';
import KomaTopbarDownloadMenuPsdSection from './KomaTopbarDownloadMenuPsdSection';

type KomaTopbarDownloadMenuProps = {
  isOpen: boolean;
  dropdownRef: RefObject<HTMLDivElement | null>;
  cleanerMode: boolean;
  translatorTextMode: boolean;
  translatorVisualMode: boolean;
  hasDownloadActions: boolean;
  hasDownloads: boolean;
  activeDownloadScope: string | null;
  outFormat: string;
  onOutFormatChange: (v: string) => void;
  outQuality: number;
  onOutQualityChange: (v: number) => void;
  downloadBundleFormat: DownloadBundleFormat;
  onDownloadBundleFormatChange: (v: DownloadBundleFormat) => void;
  canExportAioMetadata: boolean;
  downloadIncludeRawText: boolean;
  onDownloadIncludeRawTextChange: (v: boolean) => void;
  downloadIncludeTranslatedText: boolean;
  onDownloadIncludeTranslatedTextChange: (v: boolean) => void;
  downloadIncludeInpaintedImage: boolean;
  onDownloadIncludeInpaintedImageChange: (v: boolean) => void;
  hasInpaintedOutputs: boolean;
  onDownload: (scope: string | null) => void;
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
  modeIsAio: boolean;
  onDownloadPsd: () => void;
  onToggle: () => void;
};

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export default function KomaTopbarDownloadMenu({
  isOpen,
  dropdownRef,
  cleanerMode,
  translatorTextMode,
  translatorVisualMode,
  hasDownloadActions,
  hasDownloads,
  activeDownloadScope,
  outFormat,
  onOutFormatChange,
  outQuality,
  onOutQualityChange,
  downloadBundleFormat,
  onDownloadBundleFormatChange,
  canExportAioMetadata,
  downloadIncludeRawText,
  onDownloadIncludeRawTextChange,
  downloadIncludeTranslatedText,
  onDownloadIncludeTranslatedTextChange,
  downloadIncludeInpaintedImage,
  onDownloadIncludeInpaintedImageChange,
  hasInpaintedOutputs,
  onDownload,
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
  modeIsAio,
  onDownloadPsd,
  onToggle,
}: KomaTopbarDownloadMenuProps) {
  const { t } = useI18n();
  const standardImagePackage = !translatorTextMode && !translatorVisualMode;

  return (
    <div className="koma-navdrop koma-navdrop--right" ref={dropdownRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-tour="topbar-download-trigger"
            className={cn('koma-topbar__iconbtn koma-topbar__iconbtn--accent', isOpen && 'koma-topbar__iconbtn--open')}
            onClick={onToggle}
            disabled={!hasDownloadActions}
            aria-label={t('dashboard.topbar.export')}
            aria-haspopup="menu"
            aria-expanded={isOpen}
          >
            <Download size={13} />
            <ChevronDown size={9} className="koma-topbar__iconbtn-caret" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('dashboard.topbar.export')}</TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="koma-dlmenu" data-tour="topbar-download-panel" role="menu" aria-label={t('dashboard.topbar.export')}>
          <div className="koma-dlmenu__arrow" aria-hidden="true" />
          <div className="koma-dlmenu__scroll">
            <div className="koma-dlmenu__section">
              <div className="koma-dlmenu__section-head">
                <Download size={13} />
                <span>
                  {translatorTextMode
                    ? t('dashboard.topbar.textFile')
                    : translatorVisualMode
                      ? t('dashboard.topbar.textPackage')
                      : t('dashboard.topbar.imagePackage')}
                </span>
              </div>

              {translatorTextMode ? (
                <p className="koma-dlmenu__hint">{t('dashboard.topbar.downloadTextAsTxt')}</p>
              ) : translatorVisualMode ? (
                <p className="koma-dlmenu__hint">{t('dashboard.topbar.downloadVisualZip')}</p>
              ) : (
                <ImagePackageControls
                  outFormat={outFormat}
                  onOutFormatChange={onOutFormatChange}
                  outQuality={outQuality}
                  onOutQualityChange={onOutQualityChange}
                  downloadBundleFormat={downloadBundleFormat}
                  onDownloadBundleFormatChange={onDownloadBundleFormatChange}
                />
              )}

              {canExportAioMetadata && standardImagePackage && (
                <div className="koma-dlmenu__checks">
                  <CheckRow checked={downloadIncludeRawText} disabled={downloadBundleFormat === 'pdf'} onChange={onDownloadIncludeRawTextChange} label={t('dashboard.topbar.rawText')} />
                  <CheckRow checked={downloadIncludeTranslatedText} disabled={downloadBundleFormat === 'pdf'} onChange={onDownloadIncludeTranslatedTextChange} label={t('dashboard.topbar.translated')} />
                  <CheckRow checked={downloadIncludeInpaintedImage} disabled={downloadBundleFormat === 'pdf' || !hasInpaintedOutputs} onChange={onDownloadIncludeInpaintedImageChange} label={t('dashboard.topbar.inpainted')} />
                </div>
              )}

              <button
                type="button"
                className="koma-dlmenu__action koma-dlmenu__action--primary"
                disabled={!hasDownloads || !activeDownloadScope}
                onClick={() => onDownload(activeDownloadScope)}
              >
                <Download size={12} />
                {translatorTextMode
                  ? t('dashboard.topbar.downloadTxt')
                  : translatorVisualMode
                    ? t('dashboard.topbar.downloadZip')
                    : t('dashboard.topbar.downloadPackage')}
              </button>
            </div>

            {standardImagePackage && !cleanerMode && (
              <KomaTopbarDownloadMenuPsdSection
                modeIsAio={modeIsAio}
                canExportPsd={canExportPsd}
                downloadPsdLoading={downloadPsdLoading}
                downloadPsdCompression={downloadPsdCompression}
                onDownloadPsdCompressionChange={onDownloadPsdCompressionChange}
                downloadPsdDpi={downloadPsdDpi}
                onDownloadPsdDpiChange={onDownloadPsdDpiChange}
                downloadPsdIncludeOcrOverlay={downloadPsdIncludeOcrOverlay}
                onDownloadPsdIncludeOcrOverlayChange={onDownloadPsdIncludeOcrOverlayChange}
                downloadPsdIncludeIndividualCrops={downloadPsdIncludeIndividualCrops}
                onDownloadPsdIncludeIndividualCropsChange={onDownloadPsdIncludeIndividualCropsChange}
                downloadPsdIncludeRawTextLayer={downloadPsdIncludeRawTextLayer}
                onDownloadPsdIncludeRawTextLayerChange={onDownloadPsdIncludeRawTextLayerChange}
                downloadPsdIncludeTranslatedTextLayer={downloadPsdIncludeTranslatedTextLayer}
                onDownloadPsdIncludeTranslatedTextLayerChange={onDownloadPsdIncludeTranslatedTextLayerChange}
                downloadPsdUsePhotoshopTextLayers={downloadPsdUsePhotoshopTextLayers}
                onDownloadPsdUsePhotoshopTextLayersChange={onDownloadPsdUsePhotoshopTextLayersChange}
                downloadPsdIncludeMetadataJson={downloadPsdIncludeMetadataJson}
                onDownloadPsdIncludeMetadataJsonChange={onDownloadPsdIncludeMetadataJsonChange}
                hasAioRenderRegionsForPsd={hasAioRenderRegionsForPsd}
                onDownloadPsd={onDownloadPsd}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ImagePackageControls({
  outFormat,
  onOutFormatChange,
  outQuality,
  onOutQualityChange,
  downloadBundleFormat,
  onDownloadBundleFormatChange,
}: Pick<KomaTopbarDownloadMenuProps, 'outFormat' | 'onOutFormatChange' | 'outQuality' | 'onOutQualityChange' | 'downloadBundleFormat' | 'onDownloadBundleFormatChange'>) {
  const { t } = useI18n();
  return (
    <>
      <label className="koma-dlfield">
        <span className="koma-dlfield__label">{t('dashboard.topbar.format')}</span>
        <select className="koma-dlfield__select" value={outFormat} onChange={(e) => onOutFormatChange(e.target.value)}>
          <option value="image/png">{t('dashboard.topbar.optionPng')}</option>
          <option value="image/jpeg">{t('dashboard.topbar.optionJpeg')}</option>
          <option value="image/webp">{t('dashboard.topbar.optionWebp')}</option>
        </select>
      </label>
      {outFormat !== 'image/png' && (
        <label className="koma-dlfield">
          <span className="koma-dlfield__label">{t('dashboard.topbar.quality')}</span>
          <input type="number" min={0.1} max={1} step={0.05} value={outQuality} onChange={(e) => onOutQualityChange(clamp(Number(e.target.value) || 0.9, 0.1, 1))} className="koma-dlfield__input" />
        </label>
      )}
      <label className="koma-dlfield">
        <span className="koma-dlfield__label">{t('dashboard.topbar.package')}</span>
        <select className="koma-dlfield__select" value={downloadBundleFormat} onChange={(e) => onDownloadBundleFormatChange(e.target.value as DownloadBundleFormat)}>
          <option value="pdf">{t('dashboard.topbar.optionPdf')}</option>
          <option value="cbz">{t('dashboard.topbar.optionCbz')}</option>
          <option value="cb7">{t('dashboard.topbar.optionCb7')}</option>
          <option value="zip">{t('dashboard.topbar.optionZip')}</option>
        </select>
      </label>
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
