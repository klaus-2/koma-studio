import { useEffect, type RefObject } from "react";

/**
 * Attach a non-passive wheel listener so preventDefault works (React's
 * onWheel is passive and logs "Unable to preventDefault inside passive
 * event listener").
 */
export function useNonPassiveWheel(
  ref: RefObject<HTMLElement | null>,
  handler: (event: WheelEvent) => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const node = ref.current;
    if (!node) {
      return;
    }
    const listener = (event: WheelEvent) => {
      handler(event);
    };
    node.addEventListener("wheel", listener, { passive: false });
    return () => {
      node.removeEventListener("wheel", listener);
    };
  }, [ref, handler, enabled]);
}
