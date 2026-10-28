import { useI18n } from '../../../../i18n';
import type { OptimizerPreviewStats } from '../ChapterOptimizerWorkspace.types';
import { savingsPercent } from '../ChapterOptimizerWorkspace.utils';
import { formatDelta, savingsColor } from './optimizerFormat';

interface ChapterOptimizerPreviewStatsNoirProps {
  previewStats: OptimizerPreviewStats | null;
  formatBytes: (value: number) => string;
}

export default function ChapterOptimizerPreviewStatsNoir({
  previewStats,
  formatBytes,
}: ChapterOptimizerPreviewStatsNoirProps) {
  const { t } = useI18n();

  return previewStats ? (
    <div className="grid grid-cols-2 gap-px border-t border-paper/[0.065] bg-paper/[0.065] sm:grid-cols-4">
      <div className="bg-ink-2/95 p-3">
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
          {t(
            'optimizer.preview.before',
          )}
        </span>
        <strong className="mt-1 block font-display text-base font-black text-paper">
          {formatBytes(
            previewStats.originalBytes,
          )}
        </strong>
      </div>

      <div className="bg-ink-2/95 p-3">
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
          {t(
            'optimizer.preview.after',
          )}
        </span>
        <strong className="mt-1 block font-display text-base font-black text-paper">
          {formatBytes(
            previewStats.optimizedBytes,
          )}
        </strong>
      </div>

      <div className="bg-ink-2/95 p-3">
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
          {t(
            'optimizer.preview.reduction',
          )}
        </span>
        <strong
          className="mt-1 block font-display text-base font-black"
          style={{
            color: savingsColor(
              savingsPercent(
                previewStats.originalBytes,
                previewStats.optimizedBytes,
              ),
            ),
          }}
        >
          {formatDelta(
            savingsPercent(
              previewStats.originalBytes,
              previewStats.optimizedBytes,
            ),
          )}
        </strong>
      </div>

      <div className="bg-ink-2/95 p-3">
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
          {t(
            'optimizer.preview.dimensions',
          )}
        </span>
        <strong className="mt-1 block font-display text-base font-black text-paper">
          {previewStats.width}×
          {previewStats.height}
        </strong>
      </div>
    </div>
  ) : null;
}
