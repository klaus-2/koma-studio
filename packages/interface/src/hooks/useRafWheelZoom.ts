import { useCallback, useEffect, useRef } from "react";

type FlushDeltas = (deltas: readonly number[]) => void;

/**
 * Ctrl+wheel zoom that coalesces wheel bursts onto one frame: the flush
 * callback receives every pending deltaY in arrival order and applies the
 * site's zoom formula once per event, so React batches those setZoom calls
 * into a single render instead of one render per wheel event. Attaches the
 * non-passive listener on the element resolved from `resolveTarget` and
 * re-attaches when `reattachKey` changes (pass the id whose arrival mounts
 * the stage, or null for an always-mounted stage).
 */
export const useRafWheelZoom = (
  resolveTarget: () => HTMLElement | null,
  flushDeltas: FlushDeltas,
  reattachKey: string | null,
): void => {
  const pendingRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);
  const flushRef = useRef(flushDeltas);
  flushRef.current = flushDeltas;

  const handleWheel = useCallback((event: WheelEvent) => {
    pendingRef.current.push(event.deltaY);
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = [];
      flushRef.current(pending);
    });
  }, []);

  useEffect(() => {
    const el = resolveTarget();
    if (!el) return;
    const handler = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      handleWheel(event);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler);
    };
  }, [handleWheel, resolveTarget, reattachKey]);

  useEffect(() => {
    return () => {
      if (frameRef.current === null) return;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = [];
      flushRef.current(pending);
    };
  }, []);
};
