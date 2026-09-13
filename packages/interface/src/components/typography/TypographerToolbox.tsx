import {
  Circle,
  Square,
  ScanSearch,
  Copy,
  Trash2,
  Save,
  Library,
  Paintbrush,
  RotateCcw,
} from 'lucide-react';
import { useI18n } from '../../i18n';

import type {
  TypographyRegion,
  TypographyShapeKind,
  TypographyStyleFolder,
  TypographyStylePreset,
  TypographySession,
} from '../../typography/types';

import { TypographerTextQueue } from './TypographerTextQueue';
import { TypographerPresetBrowser } from './TypographerPresetBrowser';
import { AioSection } from '@/pages/AioSection';

type TypographerSelectionTool = 'select' | 'draw-square' | 'draw-rounded';

// ponytail: stable module-scope defaults so the `= []` default props don't
// create new arrays every render and redraw children that compare props.
const EMPTY_MULTI_BUBBLE_REGIONS: Array<{ id: string; label: string }> = [];
const EMPTY_FOLDERS: TypographyStyleFolder[] = [];
const EMPTY_FONTS: string[] = [];

interface TypographerToolboxProps {
  activeImageName: string | null;
  activeRegion: TypographyRegion | null;
  regionsCount: number;
  session: TypographySession | null;
  queueSelectedId: string | null;
  availablePresets: TypographyStylePreset[];
  selectedPresetId: string | null;
  selectedTool: TypographerSelectionTool;
  snapshotName: string;
  selectedSnapshotId: string | null;
  onSelectedToolChange: (tool: TypographerSelectionTool) => void;
  onPresetChange: (presetId: string | null) => void;
  onRefineShape: () => void;
  onConvertShape: (kind: TypographyShapeKind) => void;
  onDuplicateRegion: () => void;
  onDeleteRegion: () => void;
  onApplyPresetToSelection: () => void;
  onApplyPresetToImage: () => void;
  onSnapshotNameChange: (value: string) => void;
  onSaveSnapshot: () => void;
  onSelectSnapshot: (snapshotId: string | null) => void;
  onRestoreSnapshot: () => void;
  onDraftTextChange: (value: string) => void;
  onBuildQueue: () => void;
  onClearQueue: () => void;
  onApplySelectedQueueItem: () => void;
  onApplyNextQueueItem: () => void;
  onSelectQueueItem: (queueItemId: string | null) => void;
  onToggleMultiBubble: () => void;
  onImportQueueText: (value: string) => void;
  multiBubbleRegions?: Array<{ id: string; label: string }>;
  onReorderMultiBubbleRegions?: (nextOrder: string[]) => void;
  availableFolders?: TypographyStyleFolder[];
  availableFonts?: string[];
  onUpdatePreset?: (presetId: string, patch: Partial<TypographyStylePreset>) => void;
}

export const TypographerToolbox = ({
  activeImageName,
  activeRegion,
  regionsCount,
  session,
  queueSelectedId,
  availablePresets,
  selectedPresetId,
  selectedTool,
  snapshotName,
  selectedSnapshotId,
  onSelectedToolChange,
  onPresetChange,
  onRefineShape,
  onConvertShape,
  onDuplicateRegion,
  onDeleteRegion,
  onApplyPresetToSelection,
  onApplyPresetToImage,
  onSnapshotNameChange,
  onSaveSnapshot,
  onSelectSnapshot,
  onRestoreSnapshot,
  onDraftTextChange,
  onBuildQueue,
  onClearQueue,
  onApplySelectedQueueItem,
  onApplyNextQueueItem,
  onSelectQueueItem,
  onToggleMultiBubble,
  onImportQueueText,
  multiBubbleRegions = EMPTY_MULTI_BUBBLE_REGIONS,
  onReorderMultiBubbleRegions,
  availableFolders = EMPTY_FOLDERS,
  availableFonts = EMPTY_FONTS,
  onUpdatePreset,
}: TypographerToolboxProps) => {
  const { t } = useI18n();

  return (
  <div className="koma-mode-tools">
    {/* Mode Tag */}
    <span className="koma-mode-tag" aria-hidden="true">
      <span className="koma-mode-tag__dot" />
      {t("typo.tag")}
    </span>

    {/* ═══ Session Tools ═══ */}
    <AioSection
      icon={Paintbrush}
      title={t("typo.session.title")}
      badge={<span className="koma-aio-section__badge">{regionsCount}</span>}
    >
      <p className="koma-tools-hint">
        {t("typo.session.image")} <strong>{activeImageName ?? '—'}</strong>
        {' · '}{t("typo.session.selection")} <strong>{activeRegion?.id ?? t("typo.session.none")}</strong>
      </p>

      {/* Tool Strip */}
      <div
        className="koma-typo-strip"
        role="group"
        aria-label={t("typo.tools.aria")}
      >
        <button
          type="button"
          className={`koma-typo-strip__btn${selectedTool === 'select' ? ' koma-typo-strip__btn--active' : ''}`}
          onClick={() => onSelectedToolChange('select')}
          aria-label={t("typo.tools.select")}
        >
          <ScanSearch size={13} /> {t("typo.tools.select")}
        </button>
        <button
          type="button"
          className={`koma-typo-strip__btn${selectedTool === 'draw-square' ? ' koma-typo-strip__btn--active' : ''}`}
          onClick={() => onSelectedToolChange('draw-square')}
          aria-label={t("typo.tools.rect")}
        >
          <Square size={13} /> {t("typo.tools.rect")}
        </button>
        <button
          type="button"
          className={`koma-typo-strip__btn${selectedTool === 'draw-rounded' ? ' koma-typo-strip__btn--active' : ''}`}
          onClick={() => onSelectedToolChange('draw-rounded')}
          aria-label={t("typo.tools.ellipse")}
        >
          <Circle size={13} /> {t("typo.tools.ellipse")}
        </button>
      </div>

      {/* Shape Actions */}
      <div className="koma-typo-actions">
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={onRefineShape}
          disabled={!activeRegion}
        >
          <ScanSearch size={12} /> {t("typo.actions.refine")}
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={() => onConvertShape('square')}
          disabled={!activeRegion}
        >
          <Square size={12} /> {t("typo.actions.toRect")}
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={() => onConvertShape('rounded')}
          disabled={!activeRegion}
        >
          <Circle size={12} /> {t("typo.actions.toEllipse")}
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={onDuplicateRegion}
          disabled={!activeRegion}
        >
          <Copy size={12} /> {t("typo.actions.duplicate")}
        </button>
      </div>

      {/* Delete */}
      <button
        type="button"
        className="koma-btn koma-btn--ghost koma-btn--full"
        onClick={onDeleteRegion}
        disabled={!activeRegion}
        style={{ color: activeRegion ? 'rgba(244, 63, 94, 0.8)' : undefined }}
      >
        <Trash2 size={12} /> {t("typo.actions.delete")}
      </button>
    </AioSection>

    {/* ═══ Presets ═══ */}
    <AioSection icon={Library} title={t("typo.presets.title")} defaultOpen={false}>
      <TypographerPresetBrowser
        presets={availablePresets}
        folders={availableFolders}
        selectedPresetId={selectedPresetId}
        availableFonts={availableFonts}
        onSelectPreset={onPresetChange}
        onApplyToSelection={onApplyPresetToSelection}
        onApplyToImage={onApplyPresetToImage}
        onUpdatePreset={onUpdatePreset}
        hasActiveRegion={!!activeRegion}
        regionsCount={regionsCount}
      />
    </AioSection>

    {/* ═══ Snapshots ═══ */}
    <AioSection
      icon={Save}
      title={t("typo.snapshots.title")}
      defaultOpen={false}
      badge={
        session?.snapshots.length ? (
          <span className="koma-aio-section__badge">
            {session.snapshots.length}
          </span>
        ) : undefined
      }
    >
      <p className="koma-tools-hint">
        {t("typo.snapshots.hint")}
      </p>

      <div className="koma-snapshot-row">
        <input
          type="text"
          className="koma-input"
          value={snapshotName}
          onChange={(e) => onSnapshotNameChange(e.target.value)}
          placeholder={t("typo.snapshots.placeholder")}
        />
        <button
          type="button"
          className="koma-btn koma-btn--primary"
          onClick={onSaveSnapshot}
          disabled={!snapshotName.trim()}
          aria-label={t("typo.snapshots.save")}
        >
          <Save size={12} />
        </button>
      </div>

      {(session?.snapshots.length ?? 0) > 0 && (
        <div className="koma-snapshot-restore">
          <select
            className="koma-select"
            value={selectedSnapshotId ?? ''}
            onChange={(e) => onSelectSnapshot(e.target.value || null)}
          >
            <option value="">{t("typo.snapshots.select")}</option>
            {(session?.snapshots ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            disabled={!selectedSnapshotId}
            onClick={onRestoreSnapshot}
          >
            <RotateCcw size={12} /> {t("typo.snapshots.restore")}
          </button>
        </div>
      )}
    </AioSection>

    {/* ═══ Text Queue ═══ */}
    <TypographerTextQueue
      draftText={session?.draftText ?? ''}
      queue={session?.queue ?? []}
      selectedQueueItemId={queueSelectedId}
      multiBubbleEnabled={session?.multiBubbleEnabled ?? false}
      onDraftTextChange={onDraftTextChange}
      onBuildQueue={onBuildQueue}
      onClearQueue={onClearQueue}
      onApplySelected={onApplySelectedQueueItem}
      onApplyNext={onApplyNextQueueItem}
      onSelectQueueItem={onSelectQueueItem}
      onToggleMultiBubble={onToggleMultiBubble}
      onImportText={onImportQueueText}
      multiBubbleRegions={multiBubbleRegions}
      onReorderMultiBubbleRegions={onReorderMultiBubbleRegions}
    />
  </div>
  );
};
