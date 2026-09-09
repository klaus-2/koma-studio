import { FileImage, RotateCw, Sparkles, TrendingDown } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { OptimizationRecipe } from '../../../types';
import { savingsColor } from './ChapterOptimizerWorkspace.utils';

type OptimizerTotals = {
  savings: number;
  savingsPercent: number;
};

type ChapterOptimizerHeroProps = {
  imageCount: number;
  resultCount: number;
  recipe: OptimizationRecipe;
  totals: OptimizerTotals;
  formatBytes: (value: number) => string;
};

export default function ChapterOptimizerHero({
  imageCount,
  resultCount,
  recipe,
  totals,
  formatBytes,
}: ChapterOptimizerHeroProps) {
  const { t } = useI18n();

  return (
    <div className="koma-optim__hero">
      <div className="koma-optim__hero-info">
        <div className="koma-optim__hero-title">
          <span className="koma-optim__hero-title-icon" aria-hidden="true">
            <Sparkles size={12} />
          </span>
          {t('optimizer.hero.title')}
        </div>
        <p className="koma-optim__hero-desc">{t('optimizer.hero.desc')}</p>
      </div>
      <div className="koma-optim__summary">
        <div className="koma-optim__summary-chip">
          <FileImage size={11} className="koma-optim__summary-icon" />
          <span className="koma-optim__summary-val">{imageCount}</span>
          <span className="koma-optim__summary-label">{t('optimizer.hero.pages')}</span>
        </div>
        <div className="koma-optim__summary-chip">
          <TrendingDown size={11} className="koma-optim__summary-icon" />
          <span
            className="koma-optim__summary-val"
            style={resultCount > 0 ? { color: savingsColor(totals.savingsPercent) } : undefined}
          >
            {resultCount > 0 ? `${totals.savingsPercent}%` : '\u2014'}
          </span>
          <span className="koma-optim__summary-label">{t('optimizer.hero.savings')}</span>
        </div>
        <div className="koma-optim__summary-chip">
          <span className="koma-optim__summary-val">
            {resultCount > 0 ? formatBytes(totals.savings) : '\u2014'}
          </span>
          <span className="koma-optim__summary-label">{t('optimizer.hero.saved')}</span>
        </div>
        <div className="koma-optim__summary-chip">
          <span className="koma-optim__summary-val">
            {recipe.outputFormat.toUpperCase()}
          </span>
          <span className="koma-optim__summary-label">{t('optimizer.hero.output')}</span>
        </div>
        {recipe.rotation !== 0 && (
          <div className="koma-optim__summary-chip">
            <RotateCw size={11} className="koma-optim__summary-icon" />
            <span className="koma-optim__summary-val">{recipe.rotation}&deg;</span>
            <span className="koma-optim__summary-label">{t('optimizer.config.rotation')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
