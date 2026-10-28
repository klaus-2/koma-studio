/* eslint-disable @next/next/no-img-element */

import {
  Image as ImageIcon,
  Scissors,
} from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { RawOutputFormat } from '../../../../types';
import type { OptimizerImageInput } from '../ChapterOptimizerWorkspace.types';

interface ChapterOptimizerPreviewStageNoirProps {
  activeImage: OptimizerImageInput;
  previewUrl: string | null;
  originalPreviewUrl: string | null;
  previewLoading: boolean;
  showCompare: boolean;
  comparePosition: number;
  scheduleComparePosition: (value: number) => void;
  zoomLevel: number;
  outputFormat: RawOutputFormat;
}

export default function ChapterOptimizerPreviewStageNoir({
  activeImage,
  previewUrl,
  originalPreviewUrl,
  previewLoading,
  showCompare,
  comparePosition,
  scheduleComparePosition,
  zoomLevel,
  outputFormat,
}: ChapterOptimizerPreviewStageNoirProps) {
  const { t } = useI18n();

  return (
    <div className="halftone relative grid min-h-[420px] place-items-center overflow-auto bg-ink/60 p-5 sm:min-h-[560px]">
      <div
        className="pointer-events-none absolute inset-4 border border-paper/[0.045] panel-cut"
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute left-6 top-5 z-10 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-paper/22">
        Proof frame / RGB /{' '}
        {outputFormat}
      </div>

      {previewLoading ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink/68 backdrop-blur-sm">
          <div className="panel-cut-sm flex items-center gap-3 border border-crimson/30 bg-ink-2 px-4 py-3 drop-shadow-[5px_5px_0_rgba(255,46,99,0.25)]">
            <span
              className="koma-spinner text-crimson"
              aria-hidden="true"
            />

            <span className="font-mono text-[0.66rem] font-bold uppercase tracking-[0.1em] text-paper/60">
              {t(
                'optimizer.preview.generating',
              )}
            </span>
          </div>
        </div>
      ) : null}

      {showCompare &&
        previewUrl &&
        originalPreviewUrl ? (
        <div
          className="relative max-w-full transition-transform duration-200 focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-crimson"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center',
          }}
        >
          <img
            src={originalPreviewUrl}
            alt={t(
              'optimizer.preview.before',
            )}
            className="block max-h-[68vh] max-w-full select-none object-contain"
            draggable={false}
          />

          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{
              clipPath: `inset(0 ${100 - comparePosition
                }% 0 0)`,
            }}
          >
            <img
              src={previewUrl}
              alt={t(
                'optimizer.preview.after',
              )}
              className="size-full select-none object-contain"
              draggable={false}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-crimson"
            style={{
              left: `${comparePosition}%`,
            }}
            aria-hidden="true"
          >
            <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-ink bg-crimson text-ink panel-cut-sm drop-shadow-[3px_3px_0_#ffc857]">
              <Scissors size={14} />
            </span>
          </div>

          <span className="stamp pointer-events-none absolute left-3 top-3 z-20 !border-paper/20 !bg-ink/80 !text-paper/65">
            {t(
              'optimizer.preview.original',
            )}
          </span>

          <span className="stamp pointer-events-none absolute right-3 top-3 z-20">
            {t(
              'optimizer.preview.optimized',
            )}
          </span>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={comparePosition}
            aria-label={t(
              'optimizer.preview.compare',
            )}
            aria-valuetext={`${Math.round(
              comparePosition,
            )}%`}
            className="panel-cut-sm absolute inset-0 z-30 size-full cursor-ew-resize appearance-none bg-transparent opacity-0"
            onChange={(event) =>
              scheduleComparePosition(
                Number(
                  event.target.value,
                ),
              )
            }
          />
        </div>
      ) : previewUrl ? (
        <img
          src={previewUrl}
          alt={activeImage.file.name}
          draggable={false}
          className="max-h-[68vh] max-w-full select-none object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center',
          }}
        />
      ) : !previewLoading ? (
        <div className="text-center">
          <ImageIcon
            size={34}
            className="mx-auto text-paper/16"
            aria-hidden="true"
          />

          <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-paper/32">
            {t(
              'optimizer.preview.generating',
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
