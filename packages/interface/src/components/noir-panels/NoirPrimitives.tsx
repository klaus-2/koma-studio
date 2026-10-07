'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, type LucideIcon } from 'lucide-react';

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