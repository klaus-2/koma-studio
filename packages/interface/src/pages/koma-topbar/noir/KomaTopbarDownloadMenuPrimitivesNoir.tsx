import type { ReactNode } from 'react';
import { cn } from '../KomaTopbar.shared';

export const selectCls = 'panel-cut-sm bg-ink-3 px-2 py-1.5 font-mono text-[11px] text-paper outline-none border border-paper/10 focus:border-crimson';
export const inputCls = 'panel-cut-sm w-20 bg-ink-3 px-2 py-1.5 font-mono text-[11px] text-paper outline-none border border-paper/10 focus:border-crimson';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-paper-dim">{label}</span>
      {children}
    </label>
  );
}

export function CheckRow({ checked, disabled, onChange, label }: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className={cn('group flex cursor-pointer items-center gap-2', disabled && 'cursor-not-allowed opacity-40')}>
      <span
        className={cn(
          'panel-cut-sm grid h-4 w-4 place-items-center border transition-colors',
          checked ? 'border-crimson bg-crimson' : 'border-paper/25 bg-ink-3 group-hover:border-crimson',
        )}
      >
        {checked && <span className="h-1.5 w-1.5 bg-ink" />}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="font-mono text-[11px] text-paper">{label}</span>
    </label>
  );
}
