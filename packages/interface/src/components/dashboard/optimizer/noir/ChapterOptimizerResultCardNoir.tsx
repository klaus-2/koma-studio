import { useMemo } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { ArrowDownToLine } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { OptimizationResult } from '../../../../types';
import { EASE } from '../../../system/v2/kit';
import { savingsPercent } from '../ChapterOptimizerWorkspace.utils';
import { formatDelta, savingsColor } from './optimizerFormat';

interface ChapterOptimizerResultCardNoirProps {
  result: OptimizationResult;
  index: number;
  formatBytes: (value: number) => string;
  onDownload: (result: OptimizationResult) => void;
}

export default function ChapterOptimizerResultCardNoir({
  result,
  index,
  formatBytes,
  onDownload,
}: ChapterOptimizerResultCardNoirProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  const cardVariants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        y: 14,
      },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.42,
          ease: EASE,
        },
      },
    }),
    [reduceMotion],
  );

  const percentage =
    savingsPercent(
      result.originalBytes,
      result.optimizedBytes,
    );

  const remainingWidth = Math.min(
    100,
    Math.max(
      3,
      100 - Math.max(0, percentage),
    ),
  );

  return (
    <m.article
      variants={cardVariants}
      className="offset-card panel-cut-sm relative overflow-hidden border border-paper/10 bg-ink/50 p-4"
    >
      <span
        className="text-outline pointer-events-none absolute right-3 top-0 font-display text-5xl font-black leading-none"
        aria-hidden="true"
      >
        {String(index + 1).padStart(
          2,
          '0',
        )}
      </span>

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="kicker block text-[0.55rem]">
            Export file
          </span>

          <strong className="mt-2 block truncate font-mono text-[0.7rem] text-paper">
            {result.fileName}
          </strong>
        </div>

        <button
          type="button"
          className="panel-cut-sm grid size-9 shrink-0 place-items-center border border-paper/10 bg-paper/[0.035] text-paper/45 transition hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson"
          title={t(
            'optimizer.results.download',
          )}
          aria-label={`${t(
            'optimizer.results.download',
          )}: ${result.fileName}`}
          onClick={() =>
            onDownload(result)
          }
        >
          <ArrowDownToLine
            size={14}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between gap-4 font-mono text-[0.6rem] text-paper/38">
        <span>
          {formatBytes(
            result.originalBytes,
          )}{' '}
          →{' '}
          {formatBytes(
            result.optimizedBytes,
          )}
        </span>

        <span>
          {result.width}×{result.height}
        </span>
      </div>

      <div className="relative z-10 mt-3 h-1.5 overflow-hidden bg-paper/[0.055] panel-cut-sm">
        <m.div
          initial={
            reduceMotion
              ? false
              : {
                scaleX: 1,
              }
          }
          whileInView={{
            scaleX: remainingWidth / 100,
          }}
          viewport={{ once: true }}
          transition={{
            duration: reduceMotion
              ? 0
              : 0.72,
            delay: reduceMotion
              ? 0
              : index * 0.04,
            ease: EASE,
          }}
          className="h-full w-full origin-left"
          style={{
            background:
              savingsColor(percentage),
          }}
        />
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between">
        <strong
          className="font-display text-lg font-black"
          style={{
            color:
              savingsColor(percentage),
          }}
        >
          {formatDelta(percentage)}
        </strong>

        <span className="font-mono text-[0.6rem] text-paper/32">
          {formatBytes(
            Math.max(
              0,
              result.originalBytes -
              result.optimizedBytes,
            ),
          )}{' '}
          saved
        </span>
      </div>
    </m.article>
  );
}
