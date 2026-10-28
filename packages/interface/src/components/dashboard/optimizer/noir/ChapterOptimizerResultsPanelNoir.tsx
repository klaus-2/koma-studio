import { useMemo } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { Layers3, Sparkles } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { OptimizationResult } from '../../../../types';
import { formatDelta, savingsColor } from './optimizerFormat';
import ChapterOptimizerResultCardNoir from './ChapterOptimizerResultCardNoir';

type OptimizerTotals = {
  original: number;
  optimized: number;
  savingsPercent: number;
};

interface ChapterOptimizerResultsPanelNoirProps {
  results: OptimizationResult[];
  totals: OptimizerTotals;
  formatBytes: (value: number) => string;
  onDownloadSingle: (result: OptimizationResult) => void;
}

export default function ChapterOptimizerResultsPanelNoir({
  results,
  totals,
  formatBytes,
  onDownloadSingle,
}: ChapterOptimizerResultsPanelNoirProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  const listVariants = useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: {
          staggerChildren: reduceMotion ? 0 : 0.055,
        },
      },
    }),
    [reduceMotion],
  );

  return (
    <section className="glass panel-cut overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-paper/[0.065] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 place-items-center border border-mint/30 bg-mint/10 text-mint panel-cut-sm"
            aria-hidden="true"
          >
            <Layers3 size={15} />
          </span>

          <span>
            <span className="kicker block">
              // C01 / Output manifest
            </span>

            <strong className="mt-1 block font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
              {t('optimizer.results.title')}
              {results.length > 0
                ? ` / ${results.length}`
                : ''}
            </strong>
          </span>
        </div>

        {results.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] text-paper/42">
            <span>
              {formatBytes(totals.original)}
            </span>
            <span className="text-crimson">→</span>
            <span>
              {formatBytes(totals.optimized)}
            </span>

            <span
              className="stamp"
              style={{
                color: savingsColor(
                  totals.savingsPercent,
                ),
                borderColor: savingsColor(
                  totals.savingsPercent,
                ),
              }}
            >
              {formatDelta(
                totals.savingsPercent,
              )}
            </span>
          </div>
        ) : null}
      </header>

      {results.length > 0 ? (
        <m.div
          variants={listVariants}
          initial={
            reduceMotion ? false : 'hidden'
          }
          whileInView="visible"
          viewport={{
            once: true,
            amount: 0.08,
          }}
          className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {results.map((result, index) => (
            <ChapterOptimizerResultCardNoir
              key={result.sourceImageId}
              result={result}
              index={index}
              formatBytes={formatBytes}
              onDownload={onDownloadSingle}
            />
          ))}
        </m.div>
      ) : (
        <div className="halftone grid min-h-52 place-items-center p-6 text-center">
          <div>
            <Sparkles
              size={28}
              strokeWidth={1.2}
              className="mx-auto text-paper/16"
              aria-hidden="true"
            />

            <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-paper/32">
              {t('optimizer.results.empty')}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
