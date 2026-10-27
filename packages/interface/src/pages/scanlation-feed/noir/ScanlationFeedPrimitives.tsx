'use client';

import {
  memo,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Flag, X, type LucideIcon } from 'lucide-react';

import { useI18n } from '../../../i18n';
import { EASE } from '../../../components/noir-panels/NoirPrimitives';

export const feedBtn = {
  primary:
    'panel-cut-sm inline-flex items-center gap-1.5 bg-crimson px-4 py-2 font-display text-[11px] font-extrabold uppercase tracking-wider text-ink transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:drop-shadow-[4px_4px_0_#ffc857] disabled:cursor-not-allowed disabled:opacity-40',
  ghost:
    'panel-cut-sm inline-flex items-center gap-1.5 border border-paper/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60 transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:border-paper/50 hover:text-paper hover:drop-shadow-[3px_3px_0_rgba(242,237,227,0.25)] disabled:cursor-not-allowed disabled:opacity-40',
  confirm:
    'panel-cut-sm inline-flex items-center gap-1.5 border border-mint/50 bg-mint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mint transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:drop-shadow-[3px_3px_0_rgba(62,242,176,0.4)] disabled:opacity-40',
  sm: '!px-2.5 !py-1.5 !text-[9.5px]',
  full: 'w-full justify-center',
};

/* ══ Field primitives ══ */
export function FeedField({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/45">
        {label}
        {hint && <span className="ml-1.5 normal-case tracking-normal text-paper/30">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function FeedInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="noir-input" />;
}

export function FeedTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="noir-input min-h-0 resize-y !leading-relaxed"
    />
  );
}

export function FeedSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...props} className="noir-select" />
      <ChevronDown
        size={12}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-crimson"
      />
    </span>
  );
}

/* ══ Weekday pill ══ */
export function WeekdayPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`panel-cut-sm px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] transition-all duration-150 ${active
        ? 'bg-crimson font-bold text-ink drop-shadow-[2px_2px_0_#ffc857]'
        : 'border border-paper/15 text-paper/45 hover:border-paper/40 hover:text-paper'
        }`}
    >
      {children}
    </button>
  );
}

/* ══ Composer section shell ══ */
export function ComposerSection({
  icon: Icon,
  label,
  sub,
  children,
}: {
  icon: LucideIcon;
  label: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel-cut-sm flex flex-col gap-3 border border-paper/10 bg-ink/40 p-4">
      <div className="flex items-center gap-2.5 border-b border-paper/8 pb-2.5">
        <span className="panel-cut-sm grid h-6 w-6 flex-none place-items-center bg-crimson text-ink">
          <Icon size={12} strokeWidth={2.5} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/75">
          {label}
        </span>
        {sub && (
          <span className="font-mono text-[8.5px] normal-case tracking-[0.1em] text-paper/35">
            {sub}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/* ══ Sidebar card + list item ══ */
export function SideCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="glass panel-cut p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-paper/10 pb-2.5">
        <Icon size={13} className="flex-none text-crimson" aria-hidden />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.25em] text-paper/75">
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function SideItem({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="panel-cut-sm border border-paper/10 border-l-2 border-l-crimson/60 bg-ink/50 px-3 py-2.5">
      <div className="truncate font-display text-[11.5px] font-bold text-paper">{title}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper/40">
        {sub}
      </div>
      {actions && <div className="mt-2 flex gap-1.5">{actions}</div>}
    </div>
  );
}

export function SideEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-paper/12 px-3 py-4 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-paper/35">
      {children}
    </p>
  );
}

export const FeedModal = ({
  title,
  open,
  onClose,
  icon: Icon = Flag,
  wide = false,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  icon?: LucideIcon;
  wide?: boolean;
  children: ReactNode;
}) => {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <m.div
        aria-hidden
        onClick={onClose}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
      />
      <m.div
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: EASE }}
        className={`glass panel-cut relative flex max-h-[88vh] w-full flex-col border border-paper/15 ${wide ? 'max-w-3xl' : 'max-w-lg'
          }`}
      >
        {/* Risograph strip */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-[3px] bg-[linear-gradient(90deg,#ff2e63_0_68%,#ffc857_68%_82%,transparent_82%)]"
        />
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-4 right-6 select-none font-display text-5xl font-black leading-none"
        >
          投稿
        </span>

        <div className="flex items-center gap-3 border-b border-paper/10 px-5 py-4">
          <span className="panel-cut-sm grid h-8 w-8 flex-none place-items-center bg-crimson text-ink">
            <Icon size={14} strokeWidth={2.5} />
          </span>
          <h2 className="min-w-0 flex-1 truncate font-display text-[14px] font-black uppercase tracking-wide text-paper">
            {title}
          </h2>
          <button
            type="button"
            className="noir-icon-btn"
            onClick={onClose}
            aria-label={t('feed.modal.closeAria')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="noir-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      </m.div>
    </div>
  );
};

export const ToggleSwitch = memo(function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon: LucideIcon;
}) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`panel-cut-sm flex w-full items-center gap-3 border p-3 text-left transition-all duration-150 ${checked
        ? 'border-crimson/50 bg-crimson/8 -translate-x-px -translate-y-px drop-shadow-[3px_3px_0_rgba(255,200,87,0.5)]'
        : 'border-paper/12 hover:border-paper/30'
        }`}
    >
      <span
        className={`panel-cut-sm grid h-9 w-9 flex-none place-items-center border transition-colors ${checked ? 'border-crimson/50 bg-crimson/15 text-crimson' : 'border-paper/15 text-paper/45'
          }`}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[12px] font-extrabold uppercase tracking-wide text-paper">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[10px] leading-snug text-paper/45">{description}</span>
        )}
      </span>
      <span
        aria-hidden
        className={`relative h-[18px] w-9 flex-none border transition-colors ${checked ? 'border-crimson bg-crimson/15' : 'border-paper/25 bg-ink'
          }`}
        style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
      >
        <m.span
          className={`absolute left-[3px] top-[3px] h-2.5 w-2.5 ${checked ? 'bg-crimson' : 'bg-paper/35'}`}
          animate={{ x: checked ? 18 : 0 }}
          transition={
            reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }
          }
        />
      </span>
    </button>
  );
});

export const RequirementChip = memo(function RequirementChip({
  checked,
  onChange,
  label,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`panel-cut-sm inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-all duration-150 ${checked
        ? 'border-crimson bg-crimson text-ink font-bold -translate-y-px drop-shadow-[2px_2px_0_#ffc857]'
        : 'border-paper/18 text-paper/50 hover:border-paper/45 hover:text-paper'
        }`}
    >
      <Icon size={13} />
      <span>{label}</span>
      {checked && <CheckCircle2 size={12} />}
    </button>
  );
});
