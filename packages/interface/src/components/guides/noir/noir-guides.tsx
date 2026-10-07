import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── Accent tone mapping (data accentColor → noir) ── */
export type NoirTone = 'crimson' | 'gold' | 'azure' | 'mint';

const TONE_FALLBACK: Record<string, NoirTone> = {
  purple: 'crimson', violet: 'crimson', red: 'crimson', pink: 'crimson', rose: 'crimson',
  amber: 'gold', yellow: 'gold', orange: 'gold',
  cyan: 'azure', blue: 'azure', sky: 'azure',
  emerald: 'mint', green: 'mint', teal: 'mint',
};

export const resolveTone = (accent?: string): NoirTone =>
  (accent && (TONE_FALLBACK[accent] ?? (accent as NoirTone))) || 'crimson';

export const TONE_CLASSES: Record<
  NoirTone,
  { text: string; border: string; bg: string; shadow: string }
> = {
  crimson: { text: 'text-crimson', border: 'border-crimson/45', bg: 'bg-crimson/10', shadow: 'drop-shadow-[5px_5px_0_rgba(255,46,99,0.55)]' },
  gold: { text: 'text-gold', border: 'border-gold/45', bg: 'bg-gold/10', shadow: 'drop-shadow-[5px_5px_0_rgba(255,200,87,0.55)]' },
  azure: { text: 'text-azure', border: 'border-azure/45', bg: 'bg-azure/10', shadow: 'drop-shadow-[5px_5px_0_rgba(77,201,255,0.55)]' },
  mint: { text: 'text-mint', border: 'border-mint/45', bg: 'bg-mint/10', shadow: 'drop-shadow-[5px_5px_0_rgba(62,242,176,0.55)]' },
};

/* ── Difficulty stamp ───────────────────────────── */
const DIFFICULTY_TONE: Record<string, NoirTone> = {
  beginner: 'mint',
  intermediate: 'gold',
  advanced: 'crimson',
};

export function DifficultyStamp({ level, label }: { level: string; label: ReactNode }) {
  const t = TONE_CLASSES[DIFFICULTY_TONE[level] ?? 'crimson'];
  return (
    <span
      className={`panel-cut-sm inline-flex items-center border ${t.border} ${t.bg} ${t.text} px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.2em]`}
    >
      {label}
    </span>
  );
}

export function TimeBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper/45">
      <Clock size={10} aria-hidden /> {children}
    </span>
  );
}

/* ── Breadcrumb noir ────────────────────────────── */
export function NoirBreadcrumb({
  items,
  right,
}: {
  items: Array<{ label: ReactNode; onClick?: () => void }>;
  right?: ReactNode;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-crimson">
                //
              </span>
            )}
            {item.onClick && !last ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-paper/45 transition-colors hover:text-crimson"
              >
                {item.label}
              </button>
            ) : (
              <span className={last ? 'text-paper' : 'text-paper/45'}>{item.label}</span>
            )}
          </span>
        );
      })}
      {right && <span className="ml-auto">{right}</span>}
    </nav>
  );
}

/* ── Guide row (list item) ──────────────────────── */
export function GuideRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  completed,
  completedLabel,
  meta,
  onSelect,
}: {
  icon: LucideIcon;
  tone: NoirTone;
  title: ReactNode;
  subtitle: ReactNode;
  completed?: boolean;
  completedLabel?: ReactNode;
  meta?: ReactNode;
  onSelect: () => void;
}) {
  const t = TONE_CLASSES[tone];
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKey}
      className="panel-cut-sm group flex cursor-pointer items-center gap-3.5 border border-paper/10 bg-ink-2/60 p-3.5 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-paper/25 hover:drop-shadow-[4px_4px_0_rgba(255,200,87,0.5)]"
    >
      <span
        className={`panel-cut-sm grid h-9 w-9 flex-none place-items-center border ${t.border} ${t.bg} ${t.text}`}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="flex items-center gap-2 truncate font-display text-[13px] font-extrabold uppercase tracking-wide text-paper">
          {title}
          {completed && (
            <span className="flex-none font-mono text-[9px] normal-case tracking-[0.14em] text-mint">
              ✓ {completedLabel}
            </span>
          )}
        </h4>
        <p className="mt-0.5 truncate text-[11px] text-paper/45">{subtitle}</p>
      </div>
      {meta && <div className="hidden flex-none flex-col items-end gap-1.5 sm:flex">{meta}</div>}
      <ChevronRight
        size={14}
        aria-hidden
        className="flex-none text-paper/30 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-crimson"
      />
    </div>
  );
}
