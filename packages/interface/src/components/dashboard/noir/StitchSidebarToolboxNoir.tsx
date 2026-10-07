'use client';

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
} from '../stitch/types';
import { AioSection } from '../../../pages/AioSection';
import KlSlider from '../KlSlider';
import { useI18n } from '../../../i18n';
import {
  ModeTag, Field, NumberField, ColorField, SegToggle, InfoNote,
} from '../../noir-panels/NoirPrimitives';

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
  onSingleExportFormatChange: (value: Exclude<StitchExportFormat, 'zip'>) => void;
  fileBaseName: string;
  onFileBaseNameChange: (value: string) => void;
  selectedBatchIndex: number;
  batchPlans: StitchBatchPlan[];
  onMoveLastToNext: () => void;
  onPullFirstFromNext: () => void;
  onResetPlanning: () => void;
}

export const StitchSidebarToolboxNoir = (props: StitchSidebarToolboxProps) => {
  const {
    imagesCount, layoutMode, onLayoutModeChange, batchStrategy, onBatchStrategyChange,
    batchSize, onBatchSizeChange, targetPrimaryAxis, targetAxisLabel, onTargetPrimaryAxisChange,
    gap, onGapChange, alignMode, onAlignModeChange, background, onBackgroundChange,
    singleExportFormat, onSingleExportFormatChange, fileBaseName, onFileBaseNameChange,
    selectedBatchIndex, batchPlans, onMoveLastToNext, onPullFirstFromNext, onResetPlanning,
  } = props;

  const { t } = useI18n();
  const selectedBatch = batchPlans[selectedBatchIndex] ?? null;
  const hasNext = selectedBatchIndex < batchPlans.length - 1;

  return (
    <div className="font-display text-paper">
      <ModeTag>{t('stitch.sidebar.title')}</ModeTag>

      {/* ── LAYOUT ── */}
      <AioSection icon={Maximize2} title={t('stitch.sidebar.layout')} badge={<span className="stamp !py-0.5">{imagesCount}</span>}>
        <SegToggle
          ariaLabel={t('stitch.sidebar.layoutMode')}
          value={layoutMode}
          onChange={(v) => onLayoutModeChange(v as StitchLayoutMode)}
          items={[
            { key: 'webtoon', label: t('stitch.sidebar.vertical'), icon: MoveVertical },
            { key: 'horizontal', label: t('stitch.sidebar.horizontal'), icon: MoveHorizontal },
          ]}
        />

        <Field label={t('stitch.sidebar.strategy')}>
          <select value={batchStrategy} onChange={(e) => onBatchStrategyChange(e.target.value as StitchBatchStrategy)} className="noir-select panel-cut-sm">
            <option value="fixed-count">{t('stitch.sidebar.fixedCount')}</option>
            <option value="target-height">{t('stitch.sidebar.targetAxis')}</option>
            <option value="single">{t('stitch.sidebar.single')}</option>
          </select>
        </Field>

        {batchStrategy === 'fixed-count' && (
          <NumberField label={t('stitch.sidebar.imagesPerBatch')} value={batchSize} min={1} max={99} onChange={(v) => onBatchSizeChange(Math.max(1, v || 1))} />
        )}
        {batchStrategy === 'target-height' && (
          <NumberField label={targetAxisLabel} value={targetPrimaryAxis} min={1000} step={500} onChange={(v) => onTargetPrimaryAxisChange(Math.max(1000, v || 1000))} />
        )}

        <KlSlider label={t('stitch.sidebar.spacing', { value: gap })} value={gap} min={0} max={200} step={1} onChange={onGapChange} resetVal={0} />

        <Field label={t('stitch.sidebar.alignment')}>
          <SegToggle
            ariaLabel={t('stitch.sidebar.alignment')}
            value={alignMode}
            onChange={(v) => onAlignModeChange(v as StitchAlignMode)}
            items={[
              { key: 'start', label: t('stitch.sidebar.start') },
              { key: 'center', label: t('stitch.sidebar.center') },
              { key: 'end', label: t('stitch.sidebar.end') },
            ]}
          />
        </Field>
      </AioSection>

      {/* ── OUTPUT ── */}
      <AioSection icon={Settings} title={t('stitch.sidebar.output')} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label={t('stitch.sidebar.background')} value={background} onChange={onBackgroundChange} ariaLabel={t('stitch.sidebar.backgroundColor')} />
          <Field label={t('common.format')}>
            <select value={singleExportFormat} onChange={(e) => onSingleExportFormatChange(e.target.value as Exclude<StitchExportFormat, 'zip'>)} className="noir-select panel-cut-sm">
              <option value="png">{t('settings.downloadFormat.png')}</option>
              <option value="jpeg">{t('settings.downloadFormat.jpeg')}</option>
              <option value="webp">{t('settings.downloadFormat.webp')}</option>
            </select>
          </Field>
        </div>
        <Field label={t('stitch.sidebar.baseName')}>
          <input type="text" value={fileBaseName} onChange={(e) => onFileBaseNameChange(e.target.value)} className="noir-input panel-cut-sm" placeholder={t('stitch.sidebar.baseNamePlaceholder')} />
        </Field>
        <InfoNote icon={Info} tone="azure">{t('stitch.sidebar.imagesInfo', { count: imagesCount })}</InfoNote>
        <button type="button" className="btn-ghost panel-cut-sm w-full" onClick={onResetPlanning}>
          <RefreshCcw size={12} /> {t('stitch.sidebar.recalculate')}
        </button>
      </AioSection>

      {/* ── BOUNDARY ── */}
      <AioSection icon={ScissorsLineDashed} title={t('stitch.sidebar.boundary')} defaultOpen={false}>
        <div className="glass panel-cut-sm space-y-3 border-l-2 border-l-gold/50 p-3">
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-paper">
            <span className="flex h-5 w-5 items-center justify-center panel-cut-sm bg-gold/12 text-gold"><ScissorsLineDashed size={10} /></span>
            {selectedBatch
              ? t('stitch.sidebar.boundaryBatch', { current: selectedBatchIndex + 1, total: batchPlans.length, count: selectedBatch.count })
              : t('stitch.sidebar.noBatch')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost panel-cut-sm" disabled={!hasNext || !selectedBatch || selectedBatch.count <= 1} onClick={onMoveLastToNext}>
              <ArrowLeftRight size={11} /> {t('stitch.sidebar.moveLastToNext')}
            </button>
            <button type="button" className="btn-ghost panel-cut-sm" disabled={!hasNext} onClick={onPullFirstFromNext}>
              <Layers3 size={11} /> {t('stitch.sidebar.pullFromNext')}
            </button>
          </div>
        </div>
        {selectedBatch?.warnings.length ? (
          <InfoNote icon={AlertTriangle} tone="gold" role="alert">{selectedBatch.warnings[0]}</InfoNote>
        ) : null}
      </AioSection>
    </div>
  );
};

export default StitchSidebarToolboxNoir;
