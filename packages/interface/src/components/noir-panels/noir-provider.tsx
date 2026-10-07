'use client';

import type { ReactNode } from 'react';
import type { FreeProviderAccessType } from '../../models/freeAiProviderCatalog';

const ACCESS_CLASSES: Record<FreeProviderAccessType | 'unknown', string> = {
  free: 'border-mint/50 bg-mint/10 text-mint',
  trial: 'border-azure/50 bg-azure/10 text-azure',
  credit: 'border-gold/50 bg-gold/10 text-gold',
  copilot: 'border-azure/50 bg-azure/10 text-azure',
  paid: 'border-crimson/50 bg-crimson/10 text-crimson',
  mixed: 'border-gold/50 bg-gold/10 text-gold',
  unknown: 'border-paper/25 bg-paper/5 text-paper/55',
};

export function AccessBadge({
  accessType,
  children,
}: {
  accessType: FreeProviderAccessType | null | undefined;
  children: ReactNode;
}) {
  const cls = ACCESS_CLASSES[accessType ?? 'unknown'];
  return (
    <span
      className={`panel-cut-sm inline-flex items-center border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] ${cls}`}
    >
      {children}
    </span>
  );
}

export function ProviderStatus({
  ok,
  role,
  children,
}: {
  ok: boolean;
  role?: 'status' | 'alert';
  children: ReactNode;
}) {
  return (
    <p
      role={role ?? (ok ? 'status' : 'alert')}
      className={`panel-cut-sm flex items-start gap-2 border-l-[3px] px-3 py-2 text-[10.5px] leading-relaxed ${ok ? 'border-l-mint bg-mint/6 text-mint' : 'border-l-gold bg-gold/6 text-gold'
        }`}
    >
      {children}
    </p>
  );
}

export const providerCardClass = (expanded: boolean) =>
  `panel-cut-sm border bg-ink-2/60 transition-all duration-150 ${expanded
    ? 'border-crimson/40 drop-shadow-[4px_4px_0_rgba(255,200,87,0.6)]'
    : 'border-paper/10 hover:border-paper/25'
  }`;
