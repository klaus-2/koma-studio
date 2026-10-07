import type { ReactNode } from 'react';
import { Download, ExternalLink, SearchX } from 'lucide-react';
import { useI18n } from '../../../i18n';
import ResourceExternalAnchor from '../ResourceExternalAnchorNoir';

/* ── Tone system ────────────────────────────────── */
export type ResTone = 'crimson' | 'gold' | 'azure' | 'mint' | 'paper';

export const RES_TONE: Record<ResTone, { text: string; border: string; bg: string }> = {
  crimson: { text: 'text-crimson', border: 'border-crimson/45', bg: 'bg-crimson/10' },
  gold: { text: 'text-gold', border: 'border-gold/45', bg: 'bg-gold/10' },
  azure: { text: 'text-azure', border: 'border-azure/45', bg: 'bg-azure/10' },
  mint: { text: 'text-mint', border: 'border-mint/45', bg: 'bg-mint/10' },
  paper: { text: 'text-paper/60', border: 'border-paper/20', bg: 'bg-paper/5' },
};

/* Semantic mappings */
export const PLATFORM_TONE: Record<string, ResTone> = {
  discord: 'azure', reddit: 'crimson', forum: 'gold', website: 'mint', telegram: 'azure',
};

export const LICENSE_TONE: Record<string, ResTone> = {
  free: 'mint', 'open-source': 'azure', commercial: 'gold', mixed: 'paper',
};

export const SFX_TONE: Record<string, ResTone> = {
  impact: 'crimson', emotion: 'gold', ambient: 'azure', action: 'mint', voice: 'gold', misc: 'paper',
};

/* ── Micro stamp (semantic pill) ────────────────── */
export function ResStamp({ tone = 'crimson', children }: { tone?: ResTone; children: ReactNode }) {
  const t = RES_TONE[tone];
  return (
    <span
      className={`panel-cut-sm inline-flex items-center border ${t.border} ${t.bg} ${t.text} px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.18em]`}
    >
      {children}
    </span>
  );
}

/* ── Tag chip ───────────────────────────────────── */
export function ResTag({ children }: { children: ReactNode }) {
  return (
    <span className="border border-paper/12 bg-ink/50 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-paper/45">
      {children}
    </span>
  );
}

/* ── Filter pills (radiogroup) ──────────────────── */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`panel-cut-sm px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-all duration-150 ${active
                ? 'bg-crimson font-bold text-ink -translate-x-px -translate-y-px drop-shadow-[3px_3px_0_rgba(255,200,87,0.85)]'
                : 'border border-paper/15 text-paper/50 hover:border-paper/40 hover:text-paper'
              }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Result count ───────────────────────────────── */
export function SectionCount({ count, label }: { count: number; label: ReactNode }) {
  return (
    <p className="my-4 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-paper/40">
      <span className="text-crimson">[{String(count).padStart(2, '0')}]</span>
      {label}
      <span aria-hidden className="h-px flex-1 bg-paper/10" />
    </p>
  );
}

/* ── External action link (download / site) ─────── */
export function ResActionLink({
  href,
  kind,
  ariaLabel,
  children,
}: {
  href: string;
  kind?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <ResourceExternalAnchor
      href={href}
      aria-label={ariaLabel}
      className="panel-cut-sm inline-flex items-center gap-1.5 border border-paper/18 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper/60 transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:border-crimson/50 hover:text-paper hover:drop-shadow-[2px_2px_0_rgba(255,200,87,0.6)]"
    >
      {kind === 'download' ? <Download size={11} /> : <ExternalLink size={11} />}
      {children}
    </ResourceExternalAnchor>
  );
}

/* ── Empty state ────────────────────────────────── */
export function ResourcesEmptyState({ query, context }: { query: string; context: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="relative flex flex-col items-center gap-3 border border-dashed border-paper/15 py-14">
      <span
        aria-hidden
        className="text-outline pointer-events-none absolute right-6 top-3 select-none font-display text-6xl font-black"
      >
        無
      </span>
      <span className="panel-cut-sm grid h-11 w-11 place-items-center border border-crimson/40 bg-crimson/10 text-crimson">
        <SearchX size={20} />
      </span>
      <h4 className="font-display text-[13px] font-black uppercase tracking-wide text-paper">
        {query
          ? t('resources.empty.title.withQuery', { query })
          : t('resources.empty.title.noQuery')}
      </h4>
      <p className="max-w-sm text-center font-mono text-[10px] uppercase tracking-[0.14em] text-paper/40">
        {query
          ? t('resources.empty.desc.withQuery', { context })
          : t('resources.empty.desc.noQuery', { context })}
      </p>
    </div>
  );
}
