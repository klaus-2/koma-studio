import type { ReactNode } from 'react';

import { useI18n } from '../../../i18n';

export interface KlSliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  resetVal?: number;
  onChange: (value: number) => void;
}

export default function KlSliderNoir({
  label,
  value,
  min,
  max,
  step = 1,
  resetVal = 0,
  onChange,
}: KlSliderProps) {
  const { t } = useI18n();
  return (
    <div className="panel-cut-sm flex flex-col gap-1.5 bg-ink-3/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-paper-dim">{label}</span>
        <button
          type="button"
          className="panel-cut-sm border border-paper/15 bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-crimson transition-colors hover:border-crimson hover:bg-crimson hover:text-ink"
          onClick={() => onChange(resetVal)}
          title={t('klSlider.resetValue')}
        >
          {Math.round(value * 100) / 100}
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        className="koma-noir-range h-1 flex-1 cursor-pointer appearance-none rounded-none bg-ink accent-crimson"
      />
    </div>
  );
}
