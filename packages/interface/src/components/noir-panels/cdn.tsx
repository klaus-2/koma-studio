'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, type LucideIcon } from 'lucide-react';
import { EASE } from './NoirPrimitives';

/* ── Alerts (warn / error / success) ────────────── */
type AlertTone = 'warn' | 'error' | 'success';

const ALERT_STYLES: Record<AlertTone, { border: string; bg: string; text: string; icon: LucideIcon }> = {
  warn: { border: 'border-l-gold', bg: 'bg-gold/8', text: 'text-gold', icon: AlertTriangle },
  error: { border: 'border-l-crimson', bg: 'bg-crimson/8', text: 'text-crimson', icon: AlertTriangle },
  success: { border: 'border-l-mint', bg: 'bg-mint/8', text: 'text-mint', icon: Check },
};

export function NoirAlert({
  tone,
  title,
  children,
}: {
  tone: AlertTone;
  title?: ReactNode;
  children: ReactNode;
}) {
  const s = ALERT_STYLES[tone];
  const Icon = s.icon;
  const reduce = useReducedMotion();
  return (
    <motion.div
      role={tone === 'success' ? 'status' : 'alert'}
      initial={reduce ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: 12 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`panel-cut-sm flex items-start gap-2.5 border-l-[3px] ${s.border} ${s.bg} px-3.5 py-2.5`}
    >
      <Icon size={13} className={`mt-0.5 flex-none ${s.text}`} aria-hidden />
      <div className="text-[11.5px] leading-relaxed text-paper/75">
        {title && (
          <strong className={`block font-display text-[11px] font-extrabold uppercase tracking-wide ${s.text}`}>
            {title}
          </strong>
        )}
        {children}
      </div>
    </motion.div>
  );
}

export function NoirAlertStack({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">{children}</AnimatePresence>
    </div>
  );
}

/* ── Queue status badge ─────────────────────────── */
export type QueueStatus = 'queued' | 'processing' | 'uploaded' | 'error';

const STATUS_STYLES: Record<QueueStatus, string> = {
  queued: 'border-paper/25 text-paper/55',
  processing: 'border-azure/50 bg-azure/10 text-azure',
  uploaded: 'border-mint/50 bg-mint/10 text-mint',
  error: 'border-crimson/50 bg-crimson/10 text-crimson',
};

export function QueueBadge({ status, label }: { status: QueueStatus; label: ReactNode }) {
  return (
    <span
      className={`panel-cut-sm inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.2em] ${STATUS_STYLES[status]}`}
    >
      {status === 'processing' && <span aria-hidden className="h-1 w-1 bg-azure blink" />}
      {label}
    </span>
  );
}

/* ── Mini action button ─────────────────────────── */
export function MiniBtn({
  danger,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`panel-cut-sm inline-flex items-center gap-1 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${danger
          ? 'border-crimson/40 text-crimson/80 hover:bg-crimson hover:text-ink'
          : 'border-paper/18 text-paper/60 hover:-translate-x-px hover:-translate-y-px hover:border-paper/50 hover:text-paper hover:drop-shadow-[2px_2px_0_rgba(255,200,87,0.5)]'
        } ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Toggle card (option with description) ──────── */
export function ToggleCard({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  desc: ReactNode;
}) {
  return (
    <label
      className={`panel-cut-sm flex cursor-pointer items-start gap-3 border p-3 transition-all duration-150 ${checked
          ? 'border-crimson/60 bg-crimson/8 -translate-x-px -translate-y-px drop-shadow-[3px_3px_0_rgba(255,200,87,0.45)]'
          : 'border-paper/12 hover:border-paper/30'
        }`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`mt-0.5 grid h-4 w-4 flex-none place-items-center border transition-colors ${checked ? 'border-crimson bg-crimson text-ink' : 'border-paper/30'
          }`}
        style={{ clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)' }}
      >
        {checked && <Check size={10} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0">
        <strong className="block font-display text-[11px] font-extrabold uppercase tracking-wide text-paper">
          {title}
        </strong>
        <span className="mt-0.5 block text-[10px] leading-snug text-paper/45">{desc}</span>
      </span>
    </label>
  );
}

/* ── Readonly result field ──────────────────────── */
export function ResultField({ label, value }: { label: ReactNode; value: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-paper/40">{label}</span>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="noir-input !text-[10px] !text-azure"
      />
    </label>
  );
}

/* ── Section head (CDN surfaces) ────────────────── */
export function SurfaceHead({
  icon: Icon,
  title,
  desc,
  right,
}: {
  icon: LucideIcon;
  title: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-paper/10 pb-3">
      <div className="flex items-start gap-2.5">
        <span className="panel-cut-sm mt-0.5 grid h-6 w-6 flex-none place-items-center bg-crimson text-ink">
          <Icon size={12} strokeWidth={2.5} />
        </span>
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/80">{title}</h3>
          {desc && <p className="mt-1 text-[10.5px] leading-relaxed text-paper/45">{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
