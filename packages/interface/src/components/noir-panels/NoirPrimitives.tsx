'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import { HardDrive, ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from 'react';

export const staggerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export function useNoirMotion() {
  const reduce = useReducedMotion();
  return {
    container: reduce ? undefined : staggerVariants,
    item: reduce ? undefined : revealVariants,
    initial: reduce ? undefined : ('hidden' as const),
    animate: reduce ? undefined : ('show' as const),
  };
}

type Tone = 'crimson' | 'gold' | 'azure' | 'mint';

const TONES: Record<Tone, { text: string; border: string; bg: string; dot: string }> = {
  crimson: { text: 'text-crimson', border: 'border-crimson/45', bg: 'bg-crimson/10', dot: 'bg-crimson' },
  gold: { text: 'text-gold', border: 'border-gold/45', bg: 'bg-gold/10', dot: 'bg-gold' },
  azure: { text: 'text-azure', border: 'border-azure/45', bg: 'bg-azure/10', dot: 'bg-azure' },
  mint: { text: 'text-mint', border: 'border-mint/45', bg: 'bg-mint/10', dot: 'bg-mint' },
};

export function Stamp({
  tone = 'crimson',
  blink,
  children,
}: {
  tone?: Tone;
  blink?: boolean;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`panel-cut-sm inline-flex items-center gap-1.5 border ${t.border} ${t.bg} ${t.text} px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em]`}
    >
      {blink && <span aria-hidden className={`h-1.5 w-1.5 ${t.dot} blink`} />}
      {children}
    </span>
  );
}

export function NoirNote({
  tone = 'azure',
  icon: Icon,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      className={`panel-cut-sm flex items-start gap-2 border-l-2 ${t.border.replace('/45', '')} ${t.bg} px-3 py-2 text-[11px] leading-relaxed text-paper/70`}
    >
      {Icon && <Icon size={12} className={`mt-0.5 flex-none ${t.text}`} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

export function NoirSection({
  no,
  icon: Icon,
  title,
  jp,
  collapsible,
  open,
  onToggle,
  children,
}: {
  no?: string;
  icon: LucideIcon;
  title: ReactNode;
  jp?: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(true);
  const isOpen = collapsible ? (open ?? internalOpen) : true;
  const reduce = useReducedMotion();

  const head = (
    <>
      <span className="panel-cut-sm grid h-6 w-6 flex-none place-items-center bg-crimson text-ink">
        <Icon size={12} strokeWidth={2.5} />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/75">
        {title}
      </span>
      {jp && (
        <span aria-hidden className="font-mono text-[9px] tracking-[0.2em] text-paper/25">
          {jp}
        </span>
      )}
      {no && (
        <span aria-hidden className="text-outline ml-auto select-none font-display text-xl font-black leading-none">
          {no}
        </span>
      )}
      {collapsible && (
        <ChevronDown
          size={13}
          className={`${no ? '' : 'ml-auto'} text-paper/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      )}
    </>
  );

  return (
    <section className="glass panel-cut p-4">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle ?? (() => setInternalOpen((p) => !p))}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-2.5 text-left"
        >
          {head}
        </button>
      ) : (
        <div className="flex items-center gap-2.5">{head}</div>
      )}

      {collapsible ? (
        <div
          className={cn(
            'grid',
            reduce
              ? isOpen
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              : [
                  'transition-[grid-template-rows,opacity] duration-300',
                  '[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
                  isOpen
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0 pointer-events-none',
                ],
          )}
          aria-hidden={!isOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="pt-4">{children}</div>
          </div>
        </div>
      ) : (
        <div className="pt-4">{children}</div>
      )}
    </section>
  );
}

export function NoirField({
  label,
  value,
  as = 'label',
  className = '',
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  as?: 'label' | 'div';
  className?: string;
  children: ReactNode;
}) {
  const Tag = as;
  return (
    <Tag className={`flex flex-col gap-1.5 ${className}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-paper/45">
          {label}
        </span>
        {value != null && <span className="font-mono text-[10px] text-crimson">{value}</span>}
      </span>
      {children}
    </Tag>
  );
}

export function NoirSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...props} className="noir-select" />
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-crimson"
        aria-hidden
      />
    </span>
  );
}

export function NoirInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="noir-input" />;
}

export function NoirSlider({
  label,
  icon: Icon,
  display,
  min,
  max,
  step = 1,
  value,
  onChange,
  className = '',
}: {
  label: ReactNode;
  icon?: LucideIcon;
  display: ReactNode;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <NoirField
      className={className}
      label={
        <>
          {Icon && <Icon size={11} aria-hidden />}
          {label}
        </>
      }
      value={display}
    >
      <input
        type="range"
        className="noir-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </NoirField>
  );
}

export function NoirToggle({
  checked,
  onChange,
  icon: Icon,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label className="noir-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="noir-toggle__track" aria-hidden>
        <span className="noir-toggle__thumb" />
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-paper/70">
        {Icon && <Icon size={11} aria-hidden />}
        {children}
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" className="flex gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`panel-cut-sm flex-1 px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${active
              ? 'bg-crimson font-bold text-ink -translate-x-px -translate-y-px drop-shadow-[3px_3px_0_rgba(255,200,87,0.9)]'
              : 'border border-paper/15 text-paper/55 hover:border-paper/45 hover:text-paper'
              }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}


export const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Mode tag (blinking hanko dot) ── */
export function ModeTag({ children }: { children: ReactNode }) {
  return (
    <span className="stamp mb-3 inline-flex" aria-hidden="true">
      <span className="h-1.5 w-1.5 rounded-full bg-crimson animate-blink" />
      {children}
    </span>
  );
}

/* ── Field wrapper ── */
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="kicker !text-paper-dim">{label}</span>
      {children}
    </label>
  );
}

/* ── Hint text ── */
export function Hint({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'crimson' | 'mint' }) {
  const c = tone === 'crimson' ? 'text-crimson' : tone === 'mint' ? 'text-mint' : 'text-paper-dim';
  return <p className={`font-mono text-[10.5px] leading-relaxed ${c}`}>{children}</p>;
}

/* ── Custom checkbox ── */
export function Check({ label, checked, disabled, onChange }: {
  label: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-2.5 font-mono text-[11px] ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <span className={`flex h-4 w-4 items-center justify-center panel-cut-sm border transition-colors ${checked ? 'border-crimson bg-crimson text-ink' : 'border-paper/25 bg-ink'
        }`}>
        {checked && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="text-paper">{label}</span>
    </label>
  );
}

/* ── Model slot (select + manage button + meta) ── */
export function ModelSlot({
  icon: Icon, title, onManage, manageLabel, children, meta, hint,
}: {
  icon: LucideIcon; title: ReactNode; onManage?: () => void; manageLabel?: string;
  children: ReactNode; meta?: ReactNode; hint?: ReactNode;
}) {
  return (
    <div className="glass panel-cut-sm space-y-2 border-l-2 border-l-crimson/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-tight text-paper">
          <span className="flex h-5 w-5 items-center justify-center panel-cut-sm bg-crimson/12 text-crimson">
            <Icon size={11} />
          </span>
          {title}
        </span>
        {onManage && (
          <button type="button" onClick={onManage} aria-label={manageLabel}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-paper-dim transition-colors hover:text-crimson">
            <HardDrive size={9} /> {manageLabel}
          </button>
        )}
      </div>
      {children}
      {meta && <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-paper-dim">{meta}</div>}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

export function MetaDot() {
  return <span className="h-1 w-1 rounded-full bg-crimson/50" aria-hidden="true" />;
}

/* ── Segmented toggle (submode / workspace) ── */
export interface SegItem { key: string; label: string; icon?: LucideIcon; title?: string; }
export function SegToggle({ items, value, onChange, ariaLabel }: {
  items: SegItem[]; value: string; onChange: (v: string) => void; ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="relative flex gap-1 p-1 panel-cut-sm bg-ink border border-paper/10">
      {items.map((it) => {
        const active = it.key === value;
        const Icon = it.icon;
        return (
          <button key={it.key} type="button" role="tab" aria-selected={active} title={it.title}
            onClick={() => onChange(it.key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 px-2.5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${active ? 'text-ink' : 'text-paper-dim hover:text-paper'
              }`}>
            {active && (
              <motion.span layoutId={`seg-${ariaLabel ?? 'x'}`} className="absolute inset-0 panel-cut-sm bg-crimson"
                transition={{ duration: 0.28, ease: EASE }} />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon size={12} />} {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Region inspector row ── */
export function InspectRow({ k, v, muted, mono }: { k: string; v: ReactNode; muted?: boolean; mono?: boolean }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-crimson/80">{k}</dt>
      <dd className={`truncate text-[11px] ${mono ? 'font-mono' : ''} ${muted ? 'italic text-paper-dim' : 'text-paper'}`}>{v}</dd>
    </>
  );
}

/* ── Stat card ── */
export function StatCard({ value, label, tone = 'crimson' }: { value: ReactNode; label: string; tone?: 'crimson' | 'mint' | 'gold' }) {
  const c = tone === 'mint' ? 'text-mint' : tone === 'gold' ? 'text-gold' : 'text-crimson';
  return (
    <div className="glass panel-cut-sm halftone flex flex-1 flex-col items-center gap-0.5 p-3">
      <span className={`font-display text-2xl font-black leading-none ${c}`}>{value}</span>
      <span className="font-mono text-[9px] uppercase tracking-wider text-paper-dim">{label}</span>
    </div>
  );
}

/* ── Backend chip ── */
export function BackendChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 panel-cut-sm bg-ink px-2.5 py-1 font-mono text-[9.5px] text-mint border border-mint/20">
      <span className="h-1.5 w-1.5 rounded-full bg-mint animate-blink" aria-hidden="true" />
      {children}
    </span>
  );
}

/* ── Execute bar button ── */
export function ExecuteButton({ processing, disabled, title, onClick, children, ariaBusy }: {
  processing?: boolean; disabled?: boolean; title?: string; onClick?: () => void; children: ReactNode; ariaBusy?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-busy={ariaBusy}
      className={`btn-primary panel-cut-sm relative w-full !py-3.5 !text-sm ${processing ? 'animate-pulse' : ''}`}>
      {children}
    </button>
  );
}

/* ══════════════════ V2 additions (Stitch / Splitter) ════════════════ */

/* ── Number input field ── */
export function NumberField({ label, value, onChange, min, max, step }: {
  label: ReactNode; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="kicker !text-paper-dim">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="noir-input panel-cut-sm" />
    </label>
  );
}

/* ── Color swatch ── */
export function ColorField({ label, value, onChange, ariaLabel }: {
  label: ReactNode; value: string; onChange: (v: string) => void; ariaLabel?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="kicker !text-paper-dim">{label}</span>
      <div className="flex items-center gap-2">
        <span className="relative h-9 w-9 shrink-0 overflow-hidden panel-cut-sm border border-paper/15" style={{ backgroundColor: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </span>
        <span className="font-mono text-[11px] uppercase text-paper-dim">{value}</span>
      </div>
    </label>
  );
}

/* ── Info note (colored left border) ── */
export function InfoNote({ children, icon: Icon, tone = 'azure', role = 'status' }: {
  children: ReactNode; icon: LucideIcon; tone?: 'azure' | 'gold' | 'crimson' | 'mint'; role?: 'status' | 'alert';
}) {
  const map = {
    azure: 'border-l-azure text-azure', gold: 'border-l-gold text-gold',
    crimson: 'border-l-crimson text-crimson', mint: 'border-l-mint text-mint',
  } as const;
  return (
    <div role={role} className={`glass panel-cut-sm flex items-start gap-2 border-l-2 p-2.5 ${map[tone]}`}>
      <Icon size={13} className="mt-0.5 shrink-0" />
      <span className="font-mono text-[10.5px] leading-relaxed text-paper">{children}</span>
    </div>
  );
}

/* ── Ghost icon button (toolbar) ── */
export function ToolBtn({ children, onClick, disabled, title, ariaLabel, active, tone }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string; ariaLabel?: string;
  active?: boolean; tone?: 'crimson' | 'mint' | 'gold';
}) {
  const toneCls = active
    ? tone === 'mint' ? 'bg-mint text-ink' : tone === 'gold' ? 'bg-gold text-ink' : 'bg-crimson text-ink'
    : 'bg-ink text-paper-dim hover:text-paper border border-paper/12';
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}
      className={`flex h-8 items-center justify-center gap-1.5 panel-cut-sm px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-30 ${toneCls}`}>
      {children}
    </button>
  );
}

/* ── Section panel wrapper (workspace cards) ── */
export function WsPanel({ children, className = '', accent = 'crimson' }: {
  children: ReactNode; className?: string; accent?: 'crimson' | 'mint' | 'azure' | 'gold';
}) {
  const map = { crimson: 'border-l-crimson', mint: 'border-l-mint', azure: 'border-l-azure', gold: 'border-l-gold' } as const;
  return <div className={`glass panel-cut border-l-2 ${map[accent]} ${className}`}>{children}</div>;
}

/* ── Panel eyebrow header ── */
export function WsHead({ eyebrow, title, subtitle, right, icon: Icon }: {
  eyebrow: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; icon?: LucideIcon;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-paper/8 p-4">
      <div className="min-w-0">
        <span className="kicker flex items-center gap-1.5">
          {Icon && <Icon size={11} />} // {eyebrow}
        </span>
        <h2 className="mt-1 font-display text-base font-black uppercase tracking-tight text-paper">{title}</h2>
        {subtitle && <p className="mt-0.5 font-mono text-[10px] text-paper-dim">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ══════════════════ V2 additions (Watermark form kit) ══════════════════ */

/* ── Layer on/off toggle (hanko switch) ── */
export function LayerToggle({ label, checked, onChange }: {
  label: ReactNode; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 panel-cut-sm border border-paper/10 bg-ink px-3 py-2.5">
      <span className="font-display text-[11px] font-bold uppercase tracking-tight text-paper">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 panel-cut-sm border transition-colors duration-200 ${checked ? 'border-crimson bg-crimson/20' : 'border-paper/20 bg-ink'}`}>
        <span className={`absolute top-0.5 h-3.5 w-3.5 panel-cut-sm transition-all duration-200 ${checked ? 'left-[18px] bg-crimson' : 'left-0.5 bg-paper/40'}`} />
      </button>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
    </label>
  );
}

/* ── Range slider (native, noir-styled) ── */
export function RangeField({ label, value, min, max, step, onChange, suffix }: {
  label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between">
        <span className="kicker !text-paper-dim">{label}</span>
        <span className="font-mono text-[10px] text-crimson">{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}{suffix}</span>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))}
        className="noir-range h-1.5 w-full cursor-pointer appearance-none bg-ink"
        style={{ background: `linear-gradient(to right, var(--color-crimson) ${pct}%, color-mix(in srgb, var(--color-paper) 12%, transparent) ${pct}%)` }} />
    </label>
  );
}

/* ── Inline color swatch (compact, for form grids) ── */
export function ColorInput({ label, value, onChange }: { label: ReactNode; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="kicker !text-paper-dim">{label}</span>
      <span className="relative block h-8 w-full overflow-hidden panel-cut-sm border border-paper/15" style={{ backgroundColor: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </span>
    </label>
  );
}