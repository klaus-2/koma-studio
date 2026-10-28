import type { ReactNode } from 'react';

export const BloggerEditorToolbarButton = ({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={title}
    aria-pressed={active}
    className={[
      'panel-cut-sm grid size-9 shrink-0 place-items-center border transition',
      active
        ? 'border-crimson bg-crimson text-ink drop-shadow-[3px_3px_0_#ffc857]'
        : 'border-paper/10 bg-ink/55 text-paper/45 hover:border-crimson/40 hover:bg-crimson/10 hover:text-crimson',
      disabled
        ? 'cursor-not-allowed opacity-30'
        : '',
    ].join(' ')}
    disabled={disabled}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);
