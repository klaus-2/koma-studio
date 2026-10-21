import { memo, type ReactNode } from 'react';

import { useI18n } from '../../../i18n';
import { useLocalDraftSlider } from '../useLocalDraftSlider';

export interface KlSliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  resetVal?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

export default memo(function KlSliderNoir({
  label,
  value,
  min,
  max,
  step = 1,
  resetVal = 0,
  onChange,
  ariaLabel,
}: KlSliderProps) {
  const { t } = useI18n();
  const {
    labelId,
    inputId,
    draft,
    display,
    commit,
    endDrag,
    handlePointerDown,
    handlePointerUp,
    handleChange,
  } = useLocalDraftSlider({ value, onChange });

  const stringLabel = typeof label === 'string' ? label : undefined;

  return (
    <div className="panel-cut-sm flex flex-col gap-1.5 bg-ink-3/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <label
          id={labelId}
          htmlFor={inputId}
          className="font-mono text-[9px] font-bold uppercase tracking-widest text-paper-dim"
        >
          {label}
        </label>
        <button
          type="button"
          className="panel-cut-sm border border-paper/15 bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-crimson transition-colors hover:border-crimson hover:bg-crimson hover:text-ink"
          onClick={() => {
            endDrag();
            commit(resetVal);
          }}
          title={t('klSlider.resetValue')}
        >
          {display}
        </button>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onChange={handleChange}
        aria-labelledby={ariaLabel || stringLabel ? undefined : labelId}
        aria-label={ariaLabel ?? stringLabel}
        className="koma-noir-range h-1 flex-1 cursor-pointer appearance-none rounded-none bg-ink accent-crimson"
      />
    </div>
  );
});
