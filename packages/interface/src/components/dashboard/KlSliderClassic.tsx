import { memo, type ReactNode } from 'react';

import { useI18n } from '../../i18n';
import { useLocalDraftSlider } from './useLocalDraftSlider';

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

export default memo(function KlSliderClassic({
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
    <div className="koma-slider">
      <div className="koma-slider__top">
        <label id={labelId} htmlFor={inputId} className="koma-slider__label">
          {label}
        </label>
        <button
          type="button"
          className="koma-slider__value"
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
        className="koma-range"
      />
    </div>
  );
});
