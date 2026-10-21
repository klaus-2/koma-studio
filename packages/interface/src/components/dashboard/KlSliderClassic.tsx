import {
  type PointerEvent as ReactPointerEvent,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useI18n } from '../../i18n';
import { useLatestRef } from '../../utils/shallowStable';

export interface KlSliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  resetVal?: number;
  onChange: (value: number) => void;
}

export default memo(function KlSliderClassic({
  label,
  value,
  min,
  max,
  step = 1,
  resetVal = 0,
  onChange,
}: KlSliderProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const draggingRef = useRef(false);
  const onChangeRef = useLatestRef(onChange);

  useEffect(() => {
    if (!draggingRef.current) {
      setDraft(value);
    }
  }, [value]);

  const commit = useCallback((next: number) => {
    setDraft(next);
    onChangeRef.current(next);
  }, [onChangeRef]);

  const handlePointerDown = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLInputElement>) => {
      draggingRef.current = false;
      const next = parseFloat(event.currentTarget.value);
      if (Number.isFinite(next)) {
        commit(next);
      }
    },
    [commit],
  );

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(event.target.value);
    if (!Number.isFinite(next)) return;
    setDraft(next);
    // Keyboard / accessibility path commits immediately when not dragging.
    if (!draggingRef.current) {
      onChangeRef.current(next);
    }
  }, [onChangeRef]);

  const display = Math.round(draft * 100) / 100;

  return (
    <div className="koma-slider">
      <div className="koma-slider__top">
        <span className="koma-slider__label">{label}</span>
        <button
          type="button"
          className="koma-slider__value"
          onClick={() => {
            draggingRef.current = false;
            commit(resetVal);
          }}
          title={t('klSlider.resetValue')}
        >
          {display}
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onChange={handleChange}
        className="koma-range"
      />
    </div>
  );
});
