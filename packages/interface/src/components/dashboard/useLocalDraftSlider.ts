import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useLatestRef } from '../../utils/shallowStable';

export interface UseLocalDraftSliderArgs {
  value: number;
  onChange: (value: number) => void;
}

export interface LocalDraftSlider {
  labelId: string;
  inputId: string;
  /** Unrounded local draft while dragging. */
  draft: number;
  /** Draft rounded to 2 decimals for display. */
  display: number;
  commit: (next: number) => void;
  /** Clears the dragging flag (reset button path). */
  endDrag: () => void;
  handlePointerDown: () => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLInputElement>) => void;
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Local-draft slider: parent store only commits on pointer-up / change-end /
 * reset. Drag frames stay in local state to protect the AIO tools tree from
 * per-input cascade re-renders. Shared by the KlSliderClassic / KlSliderNoir
 * twins.
 */
export function useLocalDraftSlider({ value, onChange }: UseLocalDraftSliderArgs): LocalDraftSlider {
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

  const endDrag = useCallback(() => {
    draggingRef.current = false;
  }, []);

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

  return {
    labelId,
    inputId,
    draft,
    display,
    commit,
    endDrag,
    handlePointerDown,
    handlePointerUp,
    handleChange,
  };
}
