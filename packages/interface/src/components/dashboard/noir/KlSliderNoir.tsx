import {
  type PointerEvent as ReactPointerEvent,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useI18n } from '../../../i18n';
import { useLatestRef } from '../../../utils/shallowStable';

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
  const labelId = useId();
  const inputId = useId();
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
    if (!draggingRef.current) {
      onChangeRef.current(next);
    }
  }, [onChangeRef]);

  const display = Math.round(draft * 100) / 100;
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
            draggingRef.current = false;
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
