import type React from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { useI18n } from '../../../i18n';
import '../DashboardLazyFallback.css';

export interface DashboardLazyFallbackProps {
  label?: string;
}

export const DashboardLazyFallbackNoir: React.FC<
  DashboardLazyFallbackProps
> = ({ label }) => {
  const { t } = useI18n();
  const displayLabel = label?.trim() || t('dashboard.workspace.loadingTitle');

  return (
    <div
      className="koma-ws-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={displayLabel}
    >
      <div className="glass panel-cut relative w-full max-w-3xl overflow-hidden border border-paper/14 bg-ink-2/95 p-5 shadow-hard-crimson sm:p-7">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--noir-crimson)_0_68%,var(--noir-gold)_68%_84%,transparent_84%)]"
        />
        <span
          aria-hidden="true"
          className="halftone-red pointer-events-none absolute -right-12 -top-12 size-52 opacity-25"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="panel-cut-sm grid size-10 shrink-0 place-items-center border border-crimson/40 bg-crimson/12 text-crimson">
              <Layers size={17} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="kicker block !text-[9px]">
                // {t('dashboard.workspace.loadingBadge')}
              </span>
              <h3 className="truncate font-display text-sm font-black uppercase tracking-tight text-paper sm:text-base">
                {displayLabel}
              </h3>
              <p className="mt-0.5 truncate font-mono text-[11px] text-paper-dim">
                {t('dashboard.workspace.loadingSubtitle')}
              </p>
            </div>
          </div>

          <span className="stamp inline-flex shrink-0 items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            {t('common.loading')}
          </span>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="panel-cut-sm border border-paper/10 bg-ink/60 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="h-2 w-2/3 animate-pulse bg-crimson/35" />
                <span className="font-mono text-[9px] text-paper-faint">
                  0{index + 1}
                </span>
              </div>
              <div className="mt-3 h-20 border border-dashed border-paper/12 bg-ink-3/55" />
              <div className="mt-3 h-1.5 w-1/2 animate-pulse bg-paper/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
