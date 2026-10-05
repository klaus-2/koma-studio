import type { ReactNode, RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Download } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import { useI18n } from '../../../i18n';
import type {
  DownloadBundleFormat,
  PsdCompression,
} from '../KomaTopbar.shared';
import { cn } from '../KomaTopbar.shared';
import KomaTopbarDownloadMenuPsdSectionNoir from './KomaTopbarDownloadMenuPsdSectionNoir';

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

export default function KomaTopbarDownloadMenuNoir({
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
    <div className="relative" ref={dropdownRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-tour="topbar-download-trigger"
            onClick={onToggle}
            disabled={!hasDownloadActions}
            aria-label={t('dashboard.topbar.export')}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            className={cn(
              'panel-cut-sm flex h-8 items-center gap-1 px-2.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all duration-200',
              isOpen
                ? 'bg-mint text-ink shadow-hard-paper'
                : 'bg-crimson text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-gold',
              !hasDownloadActions && 'cursor-not-allowed opacity-30 hover:translate-x-0 hover:translate-y-0 hover:shadow-none',
            )}
          >
            <Download size={13} />
            <ChevronDown size={9} className={cn('transition-transform', isOpen && 'rotate-180')} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="glass panel-cut-sm">{t('dashboard.topbar.export')}</TooltipContent>
      </Tooltip>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            aria-label={t('dashboard.topbar.export')}
            data-tour="topbar-download-panel"
            className="glass panel-cut absolute right-0 top-[calc(100%+10px)] z-50 w-80 border-crimson/30 shadow-hard-crimson"
          >
            <div className="halftone-red pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
            <div className="relative max-h-[70vh] overflow-y-auto p-3">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 border-b border-paper/10 pb-2">
                  <Download size={13} className="text-crimson" />
                  <span className="kicker">
                    {translatorTextMode
                      ? t('dashboard.topbar.textFile')
                      : translatorVisualMode
                        ? t('dashboard.topbar.textPackage')
                        : t('dashboard.topbar.imagePackage')}
                  </span>
                </div>

                {translatorTextMode ? (
                  <p className="font-mono text-[11px] text-paper-dim">{t('dashboard.topbar.downloadTextAsTxt')}</p>
                ) : translatorVisualMode ? (
                  <p className="font-mono text-[11px] text-paper-dim">{t('dashboard.topbar.downloadVisualZip')}</p>
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
                  <div className="flex flex-col gap-1.5 border-t border-paper/10 pt-2">
                    <CheckRow checked={downloadIncludeRawText} disabled={downloadBundleFormat === 'pdf'} onChange={onDownloadIncludeRawTextChange} label={t('dashboard.topbar.rawText')} />
                    <CheckRow checked={downloadIncludeTranslatedText} disabled={downloadBundleFormat === 'pdf'} onChange={onDownloadIncludeTranslatedTextChange} label={t('dashboard.topbar.translated')} />
                    <CheckRow checked={downloadIncludeInpaintedImage} disabled={downloadBundleFormat === 'pdf' || !hasInpaintedOutputs} onChange={onDownloadIncludeInpaintedImageChange} label={t('dashboard.topbar.inpainted')} />
                  </div>
                )}

                <button
                  type="button"
                  disabled={!hasDownloads || !activeDownloadScope}
                  onClick={() => onDownload(activeDownloadScope)}
                  className={cn(
                    'panel-cut-sm mt-1 flex items-center justify-center gap-2 bg-crimson px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-all duration-200',
                    'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-gold',
                    (!hasDownloads || !activeDownloadScope) && 'cursor-not-allowed opacity-30 hover:translate-x-0 hover:translate-y-0 hover:shadow-none',
                  )}
                >
                  <Download size={13} />
                  {translatorTextMode
                    ? t('dashboard.topbar.downloadTxt')
                    : translatorVisualMode
                      ? t('dashboard.topbar.downloadZip')
                      : t('dashboard.topbar.downloadPackage')}
                </button>
              </div>

              {standardImagePackage && !cleanerMode && (
                <KomaTopbarDownloadMenuPsdSectionNoir
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
          </motion.div>
        )}
      </AnimatePresence>
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
      <Field label={t('dashboard.topbar.format')}>
        <select className={selectCls} value={outFormat} onChange={(e) => onOutFormatChange(e.target.value)}>
          <option value="image/png">{t('dashboard.topbar.optionPng')}</option>
          <option value="image/jpeg">{t('dashboard.topbar.optionJpeg')}</option>
          <option value="image/webp">{t('dashboard.topbar.optionWebp')}</option>
        </select>
      </Field>
      {outFormat !== 'image/png' && (
        <Field label={t('dashboard.topbar.quality')}>
          <input
            type="number"
            min={0.1}
            max={1}
            step={0.05}
            value={outQuality}
            onChange={(e) => onOutQualityChange(clamp(Number(e.target.value) || 0.9, 0.1, 1))}
            className={inputCls}
          />
        </Field>
      )}
      <Field label={t('dashboard.topbar.package')}>
        <select className={selectCls} value={downloadBundleFormat} onChange={(e) => onDownloadBundleFormatChange(e.target.value as DownloadBundleFormat)}>
          <option value="pdf">{t('dashboard.topbar.optionPdf')}</option>
          <option value="cbz">{t('dashboard.topbar.optionCbz')}</option>
          <option value="cb7">{t('dashboard.topbar.optionCb7')}</option>
          <option value="zip">{t('dashboard.topbar.optionZip')}</option>
        </select>
      </Field>
    </>
  );
}

export const selectCls = 'panel-cut-sm bg-ink-3 px-2 py-1.5 font-mono text-[11px] text-paper outline-none border border-paper/10 focus:border-crimson';
export const inputCls = 'panel-cut-sm w-20 bg-ink-3 px-2 py-1.5 font-mono text-[11px] text-paper outline-none border border-paper/10 focus:border-crimson';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-paper-dim">{label}</span>
      {children}
    </label>
  );
}

export function CheckRow({ checked, disabled, onChange, label }: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className={cn('group flex cursor-pointer items-center gap-2', disabled && 'cursor-not-allowed opacity-40')}>
      <span
        className={cn(
          'panel-cut-sm grid h-4 w-4 place-items-center border transition-colors',
          checked ? 'border-crimson bg-crimson' : 'border-paper/25 bg-ink-3 group-hover:border-crimson',
        )}
      >
        {checked && <span className="h-1.5 w-1.5 bg-ink" />}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="font-mono text-[11px] text-paper">{label}</span>
    </label>
  );
}
