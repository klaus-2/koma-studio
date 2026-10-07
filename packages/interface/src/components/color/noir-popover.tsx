'use client';

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

export const PopoverChip = forwardRef<HTMLButtonElement, {
  label: ReactNode;
  value: ReactNode;
  previewStyle?: CSSProperties;
  previewText?: string;
  disabled?: boolean;
  valueClassName?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>>(function PopoverChip(
  { label, value, previewStyle, previewText, disabled, valueClassName = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      {...rest}
      className="panel-cut-sm group flex w-full items-center gap-2.5 border border-paper/12 bg-ink/60 px-2.5 py-2 text-left transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:border-crimson/45 hover:drop-shadow-[3px_3px_0_rgba(255,200,87,0.6)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        aria-hidden
        style={previewStyle}
        className="grid h-7 w-7 flex-none place-items-center border border-paper/20 font-display text-[10px] font-black text-paper/70"
      >
        {previewText}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
          {label}
        </span>
        <span className={`block truncate font-mono text-[10px] text-paper/80 ${valueClassName}`}>
          {value}
        </span>
      </span>
    </button>
  );
});

export function PopoverPanel({
  title, hint, children,
}: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-3 p-3.5">
      <div className="border-b border-paper/10 pb-2.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-crimson">// {title}</p>
        {hint && <p className="mt-1 text-[10px] text-paper/40">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function ActivateToggle({
  label, checked, onChange,
}: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="noir-toggle justify-between border border-paper/10 bg-ink/50 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/70">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="noir-toggle__track" aria-hidden><span className="noir-toggle__thumb" /></span>
    </label>
  );
}
