import type { ReactNode } from 'react';

import { useI18n } from '../../i18n';

export interface KlSliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  resetVal?: number;
  onChange: (value: number) => void;
}

export default function KlSlider({
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
    <div className="koma-slider">
      <div className="koma-slider__top">
        <span className="koma-slider__label">{label}</span>
        <button
          type="button"
          className="koma-slider__value"
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
        className="koma-range"
      />
    </div>
  );
}
