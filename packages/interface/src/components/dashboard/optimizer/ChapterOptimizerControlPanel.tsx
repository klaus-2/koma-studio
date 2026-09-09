import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FolderOutput,
  Gauge,
  Globe,
  Image as ImageIcon,
  Layers3,
  MonitorSmartphone,
  RefreshCw,
  Settings2,
  Type,
  ZoomIn,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { OptimizationPreset, OptimizationRecipe, RawOutputFormat } from '../../../types';
import ChapterOptimizerFilterSection from './ChapterOptimizerFilterSection';
import { ROTATION_OPTIONS } from './ChapterOptimizerWorkspace.utils';
import type { OptimizerRecipeUpdate } from './ChapterOptimizerWorkspace.types';

type BatchProgress = { current: number; total: number } | null;

type ChapterOptimizerControlPanelProps = {
  recipe: OptimizationRecipe;
  selectedPreset: OptimizationPreset;
  presetKeys: OptimizationPreset[];
  imageCount: number;
  busy: boolean;
  batchProgress: BatchProgress;
  filtersExpanded: boolean;
  advancedExpanded: boolean;
  canExportToFolder: boolean;
  onPresetChange: (preset: OptimizationPreset) => void;
  onRecipeChange: OptimizerRecipeUpdate;
  onToggleFilters: () => void;
  onToggleAdvanced: () => void;
  onOptimizeAll: (saveToDirectory: boolean) => void;
};

const PRESET_META: Record<OptimizationPreset, { icon: typeof Globe; descKey: string }> = {
  'web-light': { icon: Globe, descKey: 'optimizer.presets.webLight.desc' },
  reading: { icon: Eye, descKey: 'optimizer.presets.reading.desc' },
  archive: { icon: Layers3, descKey: 'optimizer.presets.archive.desc' },
  social: { icon: MonitorSmartphone, descKey: 'optimizer.presets.social.desc' },
  custom: { icon: Settings2, descKey: 'optimizer.presets.custom.desc' },
};

export default function ChapterOptimizerControlPanel({
  recipe,
  selectedPreset,
  presetKeys,
  imageCount,
  busy,
  batchProgress,
  filtersExpanded,
  advancedExpanded,
  canExportToFolder,
  onPresetChange,
  onRecipeChange,
  onToggleFilters,
  onToggleAdvanced,
  onOptimizeAll,
}: ChapterOptimizerControlPanelProps) {
  const { t } = useI18n();

  return (
    <div className="koma-optim__panel koma-optim__panel--config">
      <div className="koma-optim__section">
        <div className="koma-optim__section-head">
          <span className="koma-optim__section-icon" aria-hidden="true">
            <Gauge size={11} />
          </span>
          {t('optimizer.panel.presets')}
        </div>
        <div className="koma-optim__presets">
          {presetKeys.map((key) => {
            const meta = PRESET_META[key];
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                className={`koma-optim__preset-card${selectedPreset === key ? ' koma-optim__preset-card--active' : ''}`}
                onClick={() => onPresetChange(key)}
              >
                <span className="koma-optim__preset-card-icon">
                  <Icon size={13} />
                </span>
                <span className="koma-optim__preset-card-name">
                  {t(`optimizer.presets.${key === 'web-light' ? 'webLight' : key}`)}
                </span>
                <span className="koma-optim__preset-card-desc">
                  {t(meta.descKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="koma-optim__section">
        <div className="koma-optim__section-head">
          <span className="koma-optim__section-icon" aria-hidden="true">
            <ImageIcon size={11} />
          </span>
          {t('optimizer.panel.output')}
        </div>
        <div className="koma-optim__config">
          <label className="koma-field">
            <span className="koma-field__label">{t('optimizer.config.format')}</span>
            <select
              className="koma-select"
              value={recipe.outputFormat}
              onChange={(e) =>
                onRecipeChange('outputFormat', e.target.value as RawOutputFormat)
              }
            >
              <option value="png">{t('settings.downloadFormat.png')}</option>
              <option value="jpeg">{t('settings.downloadFormat.jpeg')}</option>
              <option value="webp">{t('settings.downloadFormat.webp')}</option>
            </select>
          </label>
          <label className="koma-field">
            <div className="koma-field__label-row">
              <span className="koma-field__label">{t('optimizer.config.quality')}</span>
              <span className="koma-field__value">{Math.round(recipe.quality * 100)}%</span>
            </div>
            <input
              className="koma-optim__slider"
              type="range"
              min={30}
              max={100}
              step={1}
              value={Math.round(recipe.quality * 100)}
              onChange={(e) => onRecipeChange('quality', Number(e.target.value) / 100)}
            />
          </label>
        </div>
      </div>

      <div className="koma-optim__section">
        <div className="koma-optim__section-head">
          <span className="koma-optim__section-icon" aria-hidden="true">
            <ZoomIn size={11} />
          </span>
          {t('optimizer.panel.dimensions')}
        </div>
        <div className="koma-optim__config">
          <label className="koma-field koma-field--toggle">
            <input
              type="checkbox"
              checked={recipe.resizeEnabled}
              onChange={(e) => onRecipeChange('resizeEnabled', e.target.checked)}
            />
            <span className="koma-optim__toggle-track">
              <span className="koma-optim__toggle-thumb" />
            </span>
            <span>{t('optimizer.config.resize')}</span>
          </label>
          <label className="koma-field koma-field--toggle">
            <input
              type="checkbox"
              checked={recipe.trimBorders}
              onChange={(e) => onRecipeChange('trimBorders', e.target.checked)}
            />
            <span className="koma-optim__toggle-track">
              <span className="koma-optim__toggle-thumb" />
            </span>
            <span>{t('optimizer.config.trimBorders')}</span>
          </label>
          <label className="koma-field">
            <span className="koma-field__label">{t('optimizer.config.maxWidth')}</span>
            <input
              className="koma-input"
              type="number"
              min={320}
              max={4000}
              value={recipe.maxWidth}
              disabled={!recipe.resizeEnabled}
              onChange={(e) =>
                onRecipeChange('maxWidth', Math.max(320, Number(e.target.value) || recipe.maxWidth))
              }
            />
          </label>
          <label className="koma-field">
            <span className="koma-field__label">{t('optimizer.config.maxHeight')}</span>
            <input
              className="koma-input"
              type="number"
              min={320}
              max={6000}
              value={recipe.maxHeight}
              disabled={!recipe.resizeEnabled}
              onChange={(e) =>
                onRecipeChange('maxHeight', Math.max(320, Number(e.target.value) || recipe.maxHeight))
              }
            />
          </label>
          {recipe.trimBorders && (
            <label className="koma-field koma-field--span-2">
              <div className="koma-field__label-row">
                <span className="koma-field__label">{t('optimizer.config.trimTolerance')}</span>
                <span className="koma-field__value">{recipe.trimTolerance}</span>
              </div>
              <input
                className="koma-optim__slider"
                type="range"
                min={4}
                max={60}
                step={1}
                value={recipe.trimTolerance}
                onChange={(e) => onRecipeChange('trimTolerance', Number(e.target.value))}
              />
            </label>
          )}
          <div className="koma-field koma-field--span-2">
            <div className="koma-field__label-row">
              <span className="koma-field__label">{t('optimizer.config.rotation')}</span>
              <span className="koma-field__value">{recipe.rotation}&deg;</span>
            </div>
            <div className="koma-optim__rotation-group">
              {ROTATION_OPTIONS.map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className={`koma-optim__rotation-btn${recipe.rotation === deg ? ' koma-optim__rotation-btn--active' : ''}`}
                  onClick={() => onRecipeChange('rotation', deg)}
                >
                  {deg === 0 ? t('optimizer.config.rotationNone') : `${deg}\u00b0`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ChapterOptimizerFilterSection
        recipe={recipe}
        expanded={filtersExpanded}
        onRecipeChange={onRecipeChange}
        onToggle={onToggleFilters}
      />

      <div className="koma-optim__section">
        <button type="button" className="koma-optim__section-head koma-optim__section-head--toggle" onClick={onToggleAdvanced}>
          <span className="koma-optim__section-icon" aria-hidden="true"><Settings2 size={11} /></span>
          {t('optimizer.panel.advanced')}
          <span className="koma-optim__section-chevron">{advancedExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
        </button>
        {advancedExpanded && (
          <div className="koma-optim__config koma-optim__config--filters">
            <label className="koma-field koma-field--span-2">
              <div className="koma-field__label-row">
                <span className="koma-field__label">
                  <Type size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  {t('optimizer.config.renamePattern')}
                </span>
              </div>
              <input className="koma-input" type="text" value={recipe.renamePattern} placeholder="{name}" onChange={(e) => onRecipeChange('renamePattern', e.target.value)} />
              <span className="koma-optim__rename-hint">{t('optimizer.config.renameHint')}</span>
            </label>
          </div>
        )}
      </div>

      <div className="koma-optim__actions">
        <button type="button" className="koma-btn koma-btn--primary koma-optim__action-btn" disabled={busy || !imageCount} onClick={() => onOptimizeAll(false)}>
          {busy ? (
            <>
              <RefreshCw size={12} className="koma-optim__spin" />
              {batchProgress ? `${batchProgress.current}/${batchProgress.total}` : t('optimizer.action.optimizing')}
            </>
          ) : (
            <><Download size={12} /> ZIP</>
          )}
        </button>
        {canExportToFolder && (
          <button type="button" className="koma-btn koma-btn--ghost koma-optim__action-btn" disabled={busy || !imageCount} onClick={() => onOptimizeAll(true)}>
            <FolderOutput size={12} /> {t('optimizer.action.folder')}
          </button>
        )}
      </div>
      {batchProgress && (
        <div className="koma-optim__progress">
          <div className="koma-optim__progress-track">
            <div className="koma-optim__progress-fill" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
          </div>
          <span className="koma-optim__progress-label">
            {t('optimizer.action.optimizing')} {batchProgress.current}/{batchProgress.total}
          </span>
        </div>
      )}
    </div>
  );
}
