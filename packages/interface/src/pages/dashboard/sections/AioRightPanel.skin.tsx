const BTN_PRIMARY_NOIR =
  'panel-cut-sm hard-hover inline-flex flex-1 items-center justify-center gap-1.5 bg-crimson px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold';
const BTN_PRIMARY_FULL_NOIR = BTN_PRIMARY_NOIR.replace('flex-1', 'w-full');
const BTN_GHOST_NOIR =
  'panel-cut-sm hard-hover inline-flex flex-1 items-center justify-center gap-1.5 border border-crimson/40 bg-crimson/10 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-crimson disabled:opacity-40';
const SELECT_NOIR =
  'panel-cut-sm w-full appearance-none border border-paper/12 bg-ink px-2.5 py-1.5 font-mono text-[11px] uppercase text-paper/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson';
const SELECT_FLEX_NOIR = SELECT_NOIR.replace('w-full', 'flex-1 min-w-0');

const AIO_PANEL_CLASSIC = {
  ghostButton: 'koma-btn koma-btn--ghost',
  primaryButton: 'koma-btn koma-btn--primary',
  actionButton: 'koma-btn koma-btn--ghost',
  primaryFullButton: 'koma-btn koma-btn--ghost koma-btn--full',
  select: 'koma-select',
  langPresetSelect: 'koma-select koma-aio-lang-preset-row__select',
  hint: 'koma-aio-hint',
  label: 'koma-field__label',
} as const;

const AIO_PANEL_NOIR = {
  ghostButton: BTN_GHOST_NOIR,
  primaryButton: BTN_PRIMARY_NOIR,
  actionButton: BTN_PRIMARY_NOIR,
  primaryFullButton: BTN_PRIMARY_FULL_NOIR,
  select: SELECT_NOIR,
  langPresetSelect: `${SELECT_FLEX_NOIR} koma-aio-lang-preset-row__select`,
  hint: 'font-mono text-[9px] text-paper-dim',
  label: 'font-mono text-[9px] uppercase tracking-[0.16em] text-paper-dim',
} as const;

export const aioPanelClasses = (noir: boolean) =>
  noir ? AIO_PANEL_NOIR : AIO_PANEL_CLASSIC;

interface AioChecklistOptionProps {
  noir: boolean;
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export const AioChecklistOption = ({
  noir,
  checked,
  label,
  disabled,
  onChange,
}: AioChecklistOptionProps) => (
  <label className={noir ? 'flex cursor-pointer items-center gap-2' : 'koma-checklist__item'}>
    <span
      className={
        noir
          ? checked
            ? 'panel-cut-sm grid h-4 w-4 place-items-center border transition-colors border-crimson bg-crimson'
            : 'panel-cut-sm grid h-4 w-4 place-items-center border transition-colors border-paper/25 bg-ink'
          : undefined
      }
    >
      {noir && checked && <span className="h-1.5 w-1.5 bg-ink" />}
    </span>
    <input
      type="checkbox"
      className={noir ? 'sr-only' : undefined}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span className={noir ? 'font-mono text-[10px] text-paper' : undefined}>{label}</span>
  </label>
);
