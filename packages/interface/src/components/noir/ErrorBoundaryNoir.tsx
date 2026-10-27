import { m } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  RefreshCcw,
  RotateCcw,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import type { ErrorFallbackProps } from '../ErrorBoundary.types';
import { EASE, btnGhost, btnPrimary } from '../system/v2/kit';

const CROP_MARKS = [
  'left-4 top-4 border-l border-t',
  'right-4 top-4 border-r border-t',
  'bottom-4 left-4 border-b border-l',
  'bottom-4 right-4 border-b border-r',
] as const;

export const ErrorBoundaryNoir = ({
  errorName,
  errorText,
  detailsOpen,
  copied,
  onToggleDetails,
  onCopy,
  onRetry,
  onReload,
}: ErrorFallbackProps) => {
  const { t } = useI18n();

  return (
    <div
      role="alert"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-14"
    >
      <span
        aria-hidden
        className="halftone-red pointer-events-none absolute inset-0 opacity-40"
      />
      {CROP_MARKS.map((pos) => (
        <span key={pos} aria-hidden className={`absolute h-5 w-5 border-paper/20 ${pos}`} />
      ))}
      <span
        aria-hidden
        className="v-text pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 select-none font-display text-3xl font-black tracking-[0.3em] text-paper/[0.05] lg:block"
      >
        クラッシュ
      </span>

      <m.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="panel-cut relative w-full max-w-[560px] border border-paper/12 bg-ink-2/80 p-8 backdrop-blur-[14px]"
      >
        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-crimson" />

        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="panel-cut-sm mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-crimson/45 bg-crimson/10 text-crimson"
          >
            <AlertTriangle size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-crimson">
              <span aria-hidden>// </span>
              {errorName}
            </p>
            <h2 className="mt-2 font-display text-2xl font-black uppercase leading-[1.05] text-paper">
              {t('errorBoundary.title')}
            </h2>
            <p className="mt-3 max-w-[42ch] font-display text-[13px] leading-relaxed text-paper/60">
              {t('errorBoundary.description')}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={onToggleDetails}
          className="mt-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-paper/45 transition-colors hover:text-paper"
        >
          <ChevronRight
            size={13}
            aria-hidden
            className={`transition-transform duration-200 ${detailsOpen ? 'rotate-90' : ''}`}
          />
          <span aria-hidden className="text-crimson">
            //
          </span>
          {t(detailsOpen ? 'errorBoundary.hideDetails' : 'errorBoundary.details')}
        </button>

        {detailsOpen && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="mt-3"
          >
            <pre className="panel-cut-sm max-w-full overflow-x-hidden border border-paper/12 bg-ink px-3.5 py-3 font-mono text-[10.5px] leading-[1.7] break-words whitespace-pre-wrap text-paper/70">
              {errorText}
            </pre>
            <button
              type="button"
              onClick={onCopy}
              className="mt-2.5 inline-flex items-center gap-1.5 border border-paper/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-paper/60 transition-colors hover:border-crimson hover:text-crimson"
            >
              {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
              {t(copied ? 'errorBoundary.copied' : 'errorBoundary.copy')}
            </button>
          </m.div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className={btnPrimary} onClick={onRetry}>
            <RotateCcw size={13} aria-hidden />
            {t('errorBoundary.retry')}
          </button>
          <button type="button" className={btnGhost} onClick={onReload}>
            <RefreshCcw size={13} aria-hidden />
            {t('errorBoundary.reload')}
          </button>
        </div>
      </m.div>
    </div>
  );
};
