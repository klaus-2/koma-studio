import {
  AlertTriangle,
  ArrowLeftRight,
  Info,
  Layers3,
  Maximize2,
  MoveHorizontal,
  MoveVertical,
  RefreshCcw,
  ScissorsLineDashed,
  Settings,
} from 'lucide-react';

import type {
  StitchAlignMode,
  StitchBatchPlan,
  StitchBatchStrategy,
  StitchExportFormat,
  StitchLayoutMode,
} from './types';
import { cn } from '../../../utils/dashboard.utils';
import { AioSection } from '../../../pages/AioSection';
import KlSlider from '../KlSlider';
import '../../../pages/UtilityToolsPanel.css';
import { useI18n } from '../../../i18n';

interface StitchSidebarToolboxProps {
  imagesCount: number;
  layoutMode: StitchLayoutMode;
  onLayoutModeChange: (value: StitchLayoutMode) => void;
  batchStrategy: StitchBatchStrategy;
  onBatchStrategyChange: (value: StitchBatchStrategy) => void;
  batchSize: number;
  onBatchSizeChange: (value: number) => void;
  targetPrimaryAxis: number;
  targetAxisLabel: string;
  onTargetPrimaryAxisChange: (value: number) => void;
  gap: number;
  onGapChange: (value: number) => void;
  alignMode: StitchAlignMode;
  onAlignModeChange: (value: StitchAlignMode) => void;
  background: string;
  onBackgroundChange: (value: string) => void;
  singleExportFormat: Exclude<StitchExportFormat, 'zip'>;
  onSingleExportFormatChange: (
    value: Exclude<StitchExportFormat, 'zip'>,
  ) => void;
  fileBaseName: string;
  onFileBaseNameChange: (value: string) => void;
  selectedBatchIndex: number;
  batchPlans: StitchBatchPlan[];
  onMoveLastToNext: () => void;
  onPullFirstFromNext: () => void;
  onResetPlanning: () => void;
}

export const StitchSidebarToolbox = ({
  imagesCount,
  layoutMode,
  onLayoutModeChange,
  batchStrategy,
  onBatchStrategyChange,
  batchSize,
  onBatchSizeChange,
  targetPrimaryAxis,
  targetAxisLabel,
  onTargetPrimaryAxisChange,
  gap,
  onGapChange,
  alignMode,
  onAlignModeChange,
  background,
  onBackgroundChange,
  singleExportFormat,
  onSingleExportFormatChange,
  fileBaseName,
  onFileBaseNameChange,
  selectedBatchIndex,
  batchPlans,
  onMoveLastToNext,
  onPullFirstFromNext,
  onResetPlanning,
}: StitchSidebarToolboxProps) => {
  const { t } = useI18n();
  const selectedBatch = batchPlans[selectedBatchIndex] ?? null;
  const hasNext = selectedBatchIndex < batchPlans.length - 1;

  return (
    <div className="koma-mode-tools">
      <span className="koma-mode-tag" aria-hidden="true">
      <span className="koma-mode-tag__dot" />
        {t('stitch.sidebar.title')}
      </span>

      {/* ═══ Layout ═══ */}
      <AioSection
        icon={Maximize2}
        title={t('stitch.sidebar.layout')}
        badge={<span className="koma-aio-section__badge">{imagesCount}</span>}
      >
        <div
          className="koma-stitch-layout"
          role="tablist"
          aria-label={t('stitch.sidebar.layoutMode')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={layoutMode === 'webtoon'}
            className={cn(
              'koma-stitch-layout__btn',
              layoutMode === 'webtoon' && 'koma-stitch-layout__btn--active',
            )}
            onClick={() => onLayoutModeChange('webtoon')}
          >
            <MoveVertical size={13} /> {t('stitch.sidebar.vertical')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={layoutMode === 'horizontal'}
            className={cn(
              'koma-stitch-layout__btn',
              layoutMode === 'horizontal' && 'koma-stitch-layout__btn--active',
            )}
            onClick={() => onLayoutModeChange('horizontal')}
          >
            <MoveHorizontal size={13} /> {t('stitch.sidebar.horizontal')}
          </button>
        </div>

        <div className="koma-field">
          <label className="koma-field__label">{t('stitch.sidebar.strategy')}</label>
          <select
            value={batchStrategy}
            onChange={(e) =>
              onBatchStrategyChange(e.target.value as StitchBatchStrategy)
            }
            className="koma-select"
          >
            <option value="fixed-count">{t('stitch.sidebar.fixedCount')}</option>
            <option value="target-height">{t('stitch.sidebar.targetAxis')}</option>
            <option value="single">{t('stitch.sidebar.single')}</option>
          </select>
        </div>

        {batchStrategy === 'fixed-count' && (
          <div className="koma-field">
            <label className="koma-field__label">{t('stitch.sidebar.imagesPerBatch')}</label>
            <input
              type="number"
              min={1}
              max={99}
              value={batchSize}
              onChange={(e) =>
                onBatchSizeChange(Math.max(1, Number(e.target.value) || 1))
              }
              className="koma-input"
            />
          </div>
        )}

        {batchStrategy === 'target-height' && (
          <div className="koma-field">
            <label className="koma-field__label">{targetAxisLabel}</label>
            <input
              type="number"
              min={1000}
              step={500}
              value={targetPrimaryAxis}
              onChange={(e) =>
                onTargetPrimaryAxisChange(
                  Math.max(1000, Number(e.target.value) || 1000),
                )
              }
              className="koma-input"
            />
          </div>
        )}

        <KlSlider
          label={t('stitch.sidebar.spacing', { value: gap })}
          value={gap}
          min={0}
          max={200}
          step={1}
          onChange={onGapChange}
          resetVal={0}
        />

        <div className="koma-field">
          <label className="koma-field__label">{t('stitch.sidebar.alignment')}</label>
          <div
            className="koma-align-strip"
            role="group"
            aria-label={t('stitch.sidebar.alignment')}
          >
            {(['start', 'center', 'end'] as StitchAlignMode[]).map((v) => (
              <button
                key={v}
                type="button"
                className={cn(
                  'koma-align-strip__btn',
                  alignMode === v && 'koma-align-strip__btn--active',
                )}
                onClick={() => onAlignModeChange(v)}
              >
                {v === 'start' ? t('stitch.sidebar.start') : v === 'center' ? t('stitch.sidebar.center') : t('stitch.sidebar.end')}
              </button>
            ))}
          </div>
        </div>
      </AioSection>

      {/* ═══ Output ═══ */}
      <AioSection icon={Settings} title={t('stitch.sidebar.output')} defaultOpen={false}>
        <div className="koma-color-select-row">
          <div className="koma-field">
            <label className="koma-field__label">{t('stitch.sidebar.background')}</label>
            <input
              type="color"
              value={background}
              onChange={(e) => onBackgroundChange(e.target.value)}
              className="koma-color-swatch"
              aria-label={t('stitch.sidebar.backgroundColor')}
            />
          </div>
          <div className="koma-field">
            <label className="koma-field__label">{t('common.format')}</label>
            <select
              value={singleExportFormat}
              onChange={(e) =>
                onSingleExportFormatChange(
                  e.target.value as Exclude<StitchExportFormat, 'zip'>,
                )
              }
              className="koma-select"
            >
              <option value="png">{t("settings.downloadFormat.png")}</option>
              <option value="jpeg">{t("settings.downloadFormat.jpeg")}</option>
              <option value="webp">{t("settings.downloadFormat.webp")}</option>
            </select>
          </div>
        </div>

        <div className="koma-field">
            <label className="koma-field__label">{t('stitch.sidebar.baseName')}</label>
          <input
            type="text"
            value={fileBaseName}
            onChange={(e) => onFileBaseNameChange(e.target.value)}
            className="koma-input"
            placeholder={t('stitch.sidebar.baseNamePlaceholder')}
          />
        </div>

        <div
          className="koma-info-note koma-info-note--info"
          role="status"
          aria-hidden="true"
        >
          <Info size={12} className="koma-info-note__icon" />
          <span>{t('stitch.sidebar.imagesInfo', { count: imagesCount })}</span>
        </div>

        <button
          type="button"
          className="koma-btn koma-btn--ghost koma-btn--full"
          onClick={onResetPlanning}
        >
          <RefreshCcw size={12} /> {t('stitch.sidebar.recalculate')}
        </button>
      </AioSection>

      {/* ═══ Boundary ═══ */}
      <AioSection
        icon={ScissorsLineDashed}
        title={t('stitch.sidebar.boundary')}
        defaultOpen={false}
      >
        <div className="koma-batch-card">
          <div className="koma-batch-card__head">
            <span className="koma-batch-card__head-icon" aria-hidden="true">
              <ScissorsLineDashed size={9} />
            </span>
            {selectedBatch
              ? t('stitch.sidebar.boundaryBatch', { current: selectedBatchIndex + 1, total: batchPlans.length, count: selectedBatch.count })
              : t('stitch.sidebar.noBatch')}
          </div>

          <div className="koma-batch-card__actions">
            <button
              type="button"
              className="koma-btn koma-btn--ghost"
              disabled={!hasNext || !selectedBatch || selectedBatch.count <= 1}
              onClick={onMoveLastToNext}
            >
              <ArrowLeftRight size={11} /> {t('stitch.sidebar.moveLastToNext')}
            </button>
            <button
              type="button"
              className="koma-btn koma-btn--ghost"
              disabled={!hasNext}
              onClick={onPullFirstFromNext}
            >
              <Layers3 size={11} /> {t('stitch.sidebar.pullFromNext')}
            </button>
          </div>
        </div>

        {selectedBatch?.warnings.length ? (
          <div className="koma-info-note koma-info-note--warning" role="alert">
            <AlertTriangle size={12} className="koma-info-note__icon" />
            <span>{selectedBatch.warnings[0]}</span>
          </div>
        ) : null}
      </AioSection>
    </div>
  );
};

export default StitchSidebarToolbox;
