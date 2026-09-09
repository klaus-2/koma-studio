import {
  ChevronDown,
  ChevronUp,
  Contrast,
  Palette,
  Sparkles,
  SunMedium,
  Wand2,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { OptimizationRecipe } from '../../../types';
import type { OptimizerRecipeUpdate } from './ChapterOptimizerWorkspace.types';

type ChapterOptimizerFilterSectionProps = {
  recipe: OptimizationRecipe;
  expanded: boolean;
  onRecipeChange: OptimizerRecipeUpdate;
  onToggle: () => void;
};

export default function ChapterOptimizerFilterSection({
  recipe,
  expanded,
  onRecipeChange,
  onToggle,
}: ChapterOptimizerFilterSectionProps) {
  const { t } = useI18n();

  return (
    <div className="koma-optim__section">
      <button
        type="button"
        className="koma-optim__section-head koma-optim__section-head--toggle"
        onClick={onToggle}
      >
        <span className="koma-optim__section-icon" aria-hidden="true">
          <Wand2 size={11} />
        </span>
        {t('optimizer.panel.filters')}
        <span className="koma-optim__section-chevron">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {expanded && (
        <div className="koma-optim__config koma-optim__config--filters">
          <label className="koma-field koma-field--span-2">
            <div className="koma-field__label-row">
              <span className="koma-field__label">
                <SunMedium size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {t('optimizer.config.brightness')}
              </span>
              <span className="koma-field__value">
                {recipe.brightness > 0 ? '+' : ''}
                {recipe.brightness}
              </span>
            </div>
            <input
              className="koma-optim__slider"
              type="range"
              min={-50}
              max={50}
              step={1}
              value={recipe.brightness}
              onChange={(e) => onRecipeChange('brightness', Number(e.target.value))}
            />
          </label>
          <label className="koma-field koma-field--span-2">
            <div className="koma-field__label-row">
              <span className="koma-field__label">
                <Contrast size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {t('optimizer.config.contrast')}
              </span>
              <span className="koma-field__value">
                {recipe.contrast > 0 ? '+' : ''}
                {recipe.contrast}
              </span>
            </div>
            <input
              className="koma-optim__slider"
              type="range"
              min={-50}
              max={50}
              step={1}
              value={recipe.contrast}
              onChange={(e) => onRecipeChange('contrast', Number(e.target.value))}
            />
          </label>
          <label className="koma-field koma-field--toggle">
            <input type="checkbox" checked={recipe.sharpen} onChange={(e) => onRecipeChange('sharpen', e.target.checked)} />
            <span className="koma-optim__toggle-track"><span className="koma-optim__toggle-thumb" /></span>
            <span className="koma-optim__filter-label"><Contrast size={11} />{t('optimizer.config.sharpen')}</span>
          </label>
          {recipe.sharpen && (
            <label className="koma-field koma-field--span-2">
              <div className="koma-field__label-row">
                <span className="koma-field__label">{t('optimizer.config.sharpenStrength')}</span>
                <span className="koma-field__value">{recipe.sharpenStrength.toFixed(1)}</span>
              </div>
              <input
                className="koma-optim__slider"
                type="range"
                min={10}
                max={200}
                step={5}
                value={Math.round(recipe.sharpenStrength * 100)}
                onChange={(e) => onRecipeChange('sharpenStrength', Number(e.target.value) / 100)}
              />
            </label>
          )}
          <label className="koma-field koma-field--toggle">
            <input type="checkbox" checked={recipe.noiseReduction} onChange={(e) => onRecipeChange('noiseReduction', e.target.checked)} />
            <span className="koma-optim__toggle-track"><span className="koma-optim__toggle-thumb" /></span>
            <span className="koma-optim__filter-label"><Sparkles size={11} />{t('optimizer.config.noiseReduction')}</span>
          </label>
          {recipe.noiseReduction && (
            <label className="koma-field koma-field--span-2">
              <div className="koma-field__label-row">
                <span className="koma-field__label">{t('optimizer.config.noiseReductionStrength')}</span>
                <span className="koma-field__value">{recipe.noiseReductionStrength.toFixed(1)}</span>
              </div>
              <input
                className="koma-optim__slider"
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(recipe.noiseReductionStrength * 100)}
                onChange={(e) => onRecipeChange('noiseReductionStrength', Number(e.target.value) / 100)}
              />
            </label>
          )}
          <label className="koma-field koma-field--toggle">
            <input type="checkbox" checked={recipe.grayscale} onChange={(e) => onRecipeChange('grayscale', e.target.checked)} />
            <span className="koma-optim__toggle-track"><span className="koma-optim__toggle-thumb" /></span>
            <span className="koma-optim__filter-label"><Palette size={11} />{t('optimizer.config.grayscale')}</span>
          </label>
          <label className="koma-field koma-field--toggle">
            <input type="checkbox" checked={recipe.autoLevels} onChange={(e) => onRecipeChange('autoLevels', e.target.checked)} />
            <span className="koma-optim__toggle-track"><span className="koma-optim__toggle-thumb" /></span>
            <span className="koma-optim__filter-label"><SunMedium size={11} />{t('optimizer.config.autoLevels')}</span>
          </label>
        </div>
      )}
    </div>
  );
}
