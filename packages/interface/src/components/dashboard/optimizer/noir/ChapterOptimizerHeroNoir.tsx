import { m, useReducedMotion } from 'framer-motion';
import {
  FileImage,
  Layers3,
  Sparkles,
  TrendingDown,
} from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { OptimizationRecipe } from '../../../../types';
import { EASE } from '../../../system/v2/kit';
import { formatDelta, savingsColor } from './optimizerFormat';

type OptimizerTotals = {
  savings: number;
  savingsPercent: number;
};

interface ChapterOptimizerHeroNoirProps {
  imageCount: number;
  resultCount: number;
  recipe: OptimizationRecipe;
  totals: OptimizerTotals;
  formatBytes: (value: number) => string;
}

export default function ChapterOptimizerHeroNoir({
  imageCount,
  resultCount,
  recipe,
  totals,
  formatBytes,
}: ChapterOptimizerHeroNoirProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <m.header
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            y: 22,
            clipPath: 'inset(0 0 100% 0)',
          }
      }
      animate={{
        opacity: 1,
        y: 0,
        clipPath: 'inset(0 0 0% 0)',
      }}
      transition={{
        duration: reduceMotion ? 0 : 0.68,
        ease: EASE,
      }}
      className="glass panel-cut manga-grid-bg relative overflow-hidden p-5 sm:p-7"
    >
      <div className="halftone-red absolute inset-0 opacity-40" aria-hidden />
      <span aria-hidden className="v-text absolute right-4 top-3 text-crimson/60  font-accent italic text-2xl leading-none select-none">最適化</span>
      <div
        className="absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,46,99,0.35), transparent)' }}
        aria-hidden
      />

      <span
        className="text-outline pointer-events-none absolute right-8 top-0 font-display text-[7rem] font-black leading-none"
        aria-hidden="true"
      >
        02
      </span>

      <div
        className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-2/5 bg-crimson"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="stamp">
              <span
                className="koma-blink size-1.5 bg-crimson"
                aria-hidden="true"
              />
              Export press / V2
            </span>

            <span className="kicker text-paper/35">
              KOMA // Chapter lab
            </span>
          </div>

          <h1
            id="optimizer-v2-title"
            className="font-display text-3xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-paper sm:text-5xl lg:text-6xl"
          >
            {t('optimizer.hero.title')}
            <span
              className="font-accent font-normal italic text-crimson"
              aria-hidden="true"
            >
              {' '}
              press
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/48">
            {t('optimizer.hero.desc')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden border border-paper/10 bg-paper/10 panel-cut-sm sm:grid-cols-4">
          <div className="min-w-28 bg-ink-2/95 p-3">
            <FileImage
              size={14}
              className="mb-2 text-crimson"
              aria-hidden="true"
            />
            <strong className="block font-display text-xl font-black text-paper">
              {imageCount}
            </strong>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
              {t('optimizer.hero.pages')}
            </span>
          </div>

          <div className="min-w-28 bg-ink-2/95 p-3">
            <TrendingDown
              size={14}
              className="mb-2 text-mint"
              aria-hidden="true"
            />
            <strong
              className="block font-display text-xl font-black"
              style={{
                color:
                  resultCount > 0
                    ? savingsColor(
                      totals.savingsPercent,
                    )
                    : undefined,
              }}
            >
              {resultCount > 0
                ? formatDelta(
                  totals.savingsPercent,
                )
                : '—'}
            </strong>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
              {t('optimizer.hero.savings')}
            </span>
          </div>

          <div className="min-w-28 bg-ink-2/95 p-3">
            <Sparkles
              size={14}
              className="mb-2 text-gold"
              aria-hidden="true"
            />
            <strong className="block font-display text-xl font-black text-paper">
              {resultCount > 0
                ? formatBytes(totals.savings)
                : '—'}
            </strong>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
              {t('optimizer.hero.saved')}
            </span>
          </div>

          <div className="min-w-28 bg-ink-2/95 p-3">
            <Layers3
              size={14}
              className="mb-2 text-azure"
              aria-hidden="true"
            />
            <strong className="block font-display text-xl font-black uppercase text-paper">
              {recipe.outputFormat}
            </strong>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
              {t('optimizer.hero.output')}
            </span>
          </div>
        </div>
      </div>
    </m.header>
  );
}
