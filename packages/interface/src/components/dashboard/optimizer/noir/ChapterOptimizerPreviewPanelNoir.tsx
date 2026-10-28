/* eslint-disable @next/next/no-img-element */

import type { RefObject } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import {
  Eye,
  Image as ImageIcon,
  Minus,
  Plus,
  RotateCw,
  Scissors,
} from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { RawOutputFormat } from '../../../../types';
import { EASE } from '../../../system/v2/kit';
import type {
  OptimizerImageInput,
  OptimizerPreviewStats,
} from '../ChapterOptimizerWorkspace.types';
import { ZOOM_LEVELS } from '../ChapterOptimizerWorkspace.utils';
import ChapterOptimizerPreviewStageNoir from './ChapterOptimizerPreviewStageNoir';
import ChapterOptimizerPreviewStatsNoir from './ChapterOptimizerPreviewStatsNoir';

interface ChapterOptimizerPreviewPanelNoirProps {
  activeImage: OptimizerImageInput | null;
  activeImageIndex: number;
  images: OptimizerImageInput[];
  previewUrl: string | null;
  originalPreviewUrl: string | null;
  previewStats: OptimizerPreviewStats | null;
  previewLoading: boolean;
  showCompare: boolean;
  comparePosition: number;
  scheduleComparePosition: (value: number) => void;
  thumbStripRef: RefObject<HTMLDivElement | null>;
  zoomLevel: number;
  rotation: number;
  outputFormat: RawOutputFormat;
  formatBytes: (value: number) => string;
  onActiveImageChange: (imageId: string) => void;
  onCompareToggle: () => void;
  onCycleRotation: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export default function ChapterOptimizerPreviewPanelNoir({
  activeImage,
  activeImageIndex,
  images,
  previewUrl,
  originalPreviewUrl,
  previewStats,
  previewLoading,
  showCompare,
  comparePosition,
  scheduleComparePosition,
  thumbStripRef,
  zoomLevel,
  rotation,
  outputFormat,
  formatBytes,
  onActiveImageChange,
  onCompareToggle,
  onCycleRotation,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ChapterOptimizerPreviewPanelNoirProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <m.main
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            x: 20,
          }
      }
      animate={{
        opacity: 1,
        x: 0,
      }}
      transition={{
        duration: reduceMotion ? 0 : 0.55,
        delay: reduceMotion ? 0 : 0.12,
        ease: EASE,
      }}
      className="glass panel-cut overflow-hidden"
    >
      <header className="flex flex-col gap-3 border-b border-paper/[0.065] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 place-items-center border border-azure/30 bg-azure/10 text-azure panel-cut-sm"
            aria-hidden="true"
          >
            <Eye size={15} />
          </span>

          <span>
            <span className="kicker block">
              // B01 / Proof
            </span>

            <strong className="mt-1 block font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
              {t('optimizer.panel.preview')}
            </strong>
          </span>

          {activeImageIndex >= 0 ? (
            <span className="stamp !border-paper/15 !bg-paper/[0.035] !text-paper/45">
              {activeImageIndex + 1}/
              {images.length}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {previewUrl &&
            originalPreviewUrl ? (
            <button
              type="button"
              className={[
                'btn-ghost !min-h-9 !px-3 !py-2',
                showCompare
                  ? '!border-crimson/60 !bg-crimson/10 !text-crimson'
                  : '',
              ].join(' ')}
              aria-pressed={showCompare}
              onClick={onCompareToggle}
            >
              <Scissors
                size={13}
                aria-hidden="true"
              />
              {t(
                'optimizer.preview.compare',
              )}
            </button>
          ) : null}

          <button
            type="button"
            className="btn-ghost !min-h-9 !px-3 !py-2"
            title={t(
              'optimizer.config.rotation',
            )}
            onClick={onCycleRotation}
          >
            <RotateCw
              size={13}
              aria-hidden="true"
            />
            {rotation}°
          </button>

          <div className="flex border border-paper/10 bg-ink/60 panel-cut-sm">
            <button
              type="button"
              className="panel-cut-sm grid size-9 place-items-center text-paper/45 transition hover:bg-paper/[0.05] hover:text-paper disabled:opacity-25"
              aria-label="Zoom out"
              disabled={
                zoomLevel <= (ZOOM_LEVELS[0] ?? 0)
              }
              onClick={onZoomOut}
            >
              <Minus
                size={13}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className="panel-cut-sm min-w-14 border-x border-paper/10 px-2 font-mono text-[0.62rem] font-bold text-paper/55 hover:bg-paper/[0.05] hover:text-paper"
              title="Reset zoom"
              onClick={onZoomReset}
            >
              {Math.round(zoomLevel * 100)}%
            </button>

            <button
              type="button"
              className="panel-cut-sm grid size-9 place-items-center text-paper/45 transition hover:bg-paper/[0.05] hover:text-paper disabled:opacity-25"
              aria-label="Zoom in"
              disabled={
                zoomLevel >=
                (ZOOM_LEVELS[
                  ZOOM_LEVELS.length - 1
                ] ?? 0)
              }
              onClick={onZoomIn}
            >
              <Plus
                size={13}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </header>

      {activeImage ? (
        <>
          {images.length > 1 ? (
            <div
              ref={thumbStripRef}
              className="koma-scrollbar flex gap-2 overflow-x-auto border-b border-paper/[0.065] bg-ink/35 p-3"
            >
              {images.map((image, index) => {
                const active =
                  image.id === activeImage.id;

                return (
                  <button
                    key={image.id}
                    type="button"
                    data-thumb-id={image.id}
                    title={image.file.name}
                    aria-label={`${index + 1}: ${image.file.name}`}
                    aria-pressed={active}
                    className={[
                      'panel-cut-sm relative h-16 w-12 shrink-0 overflow-hidden border transition',
                      active
                        ? 'border-crimson drop-shadow-[3px_3px_0_rgba(255,46,99,0.38)]'
                        : 'border-paper/10 opacity-48 hover:border-paper/30 hover:opacity-100',
                    ].join(' ')}
                    onClick={() =>
                      onActiveImageChange(image.id)
                    }
                  >
                    <img
                      src={image.url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />

                    <span className="absolute bottom-0 left-0 bg-ink/90 px-1.5 py-0.5 font-mono text-[0.52rem] font-bold text-paper">
                      {String(index + 1).padStart(
                        2,
                        '0',
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <ChapterOptimizerPreviewStageNoir
            activeImage={activeImage}
            previewUrl={previewUrl}
            originalPreviewUrl={originalPreviewUrl}
            previewLoading={previewLoading}
            showCompare={showCompare}
            comparePosition={comparePosition}
            scheduleComparePosition={scheduleComparePosition}
            zoomLevel={zoomLevel}
            outputFormat={outputFormat}
          />

          <ChapterOptimizerPreviewStatsNoir
            previewStats={previewStats}
            formatBytes={formatBytes}
          />
        </>
      ) : (
        <div className="halftone grid min-h-[560px] place-items-center bg-ink/50 text-center">
          <div>
            <ImageIcon
              size={44}
              strokeWidth={1.2}
              className="mx-auto text-paper/16"
              aria-hidden="true"
            />

            <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-paper/34">
              {t('optimizer.preview.empty')}
            </p>
          </div>
        </div>
      )}
    </m.main>
  );
}
