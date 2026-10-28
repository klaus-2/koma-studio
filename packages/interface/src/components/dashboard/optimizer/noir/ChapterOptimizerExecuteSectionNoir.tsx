import { m, useReducedMotion } from 'framer-motion';
import {
  Download,
  FolderOutput,
  RefreshCw,
} from 'lucide-react';

import { useI18n } from '../../../../i18n';
import { EASE } from '../../../system/v2/kit';

interface ChapterOptimizerExecuteSectionNoirProps {
  imageCount: number;
  busy: boolean;
  batchProgress: {
    current: number;
    total: number;
  } | null;
  directoryPickerAvailable: boolean;
  onOptimizeAll: (saveToDirectory: boolean) => void;
}

export default function ChapterOptimizerExecuteSectionNoir({
  imageCount,
  busy,
  batchProgress,
  directoryPickerAvailable,
  onOptimizeAll,
}: ChapterOptimizerExecuteSectionNoirProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <div className="bg-ink/55 p-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy || imageCount === 0}
          onClick={() =>
            void onOptimizeAll(false)
          }
        >
          {busy ? (
            <>
              <RefreshCw
                size={14}
                className="animate-spin"
                aria-hidden="true"
              />
              {batchProgress
                ? `${batchProgress.current}/${batchProgress.total}`
                : t(
                  'optimizer.action.optimizing',
                )}
            </>
          ) : (
            <>
              <Download
                size={14}
                aria-hidden="true"
              />
              ZIP
            </>
          )}
        </button>

        {directoryPickerAvailable ? (
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={
              busy || imageCount === 0
            }
            onClick={() =>
              void onOptimizeAll(true)
            }
          >
            <FolderOutput
              size={14}
              aria-hidden="true"
            />
            {t('optimizer.action.folder')}
          </button>
        ) : null}
      </div>

      {batchProgress ? (
        <div
          className="mt-4"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={
            batchProgress.total
          }
          aria-valuenow={
            batchProgress.current
          }
        >
          <div className="h-1.5 overflow-hidden bg-paper/[0.055] panel-cut-sm">
            <m.div
              className="h-full w-full origin-left bg-crimson"
              animate={{
                scaleX: batchProgress.current /
                  batchProgress.total,
              }}
              transition={{
                duration: reduceMotion
                  ? 0
                  : 0.28,
                ease: EASE,
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.09em] text-paper/38">
            <span>
              {t(
                'optimizer.action.optimizing',
              )}
            </span>
            <span className="text-crimson">
              {batchProgress.current}/
              {batchProgress.total}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
