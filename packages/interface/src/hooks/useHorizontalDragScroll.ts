import { useEffect, useRef } from "react";

const DRAG_START_THRESHOLD_PX = 4;
const CLICK_CANCEL_THRESHOLD_PX = 8;

export const useHorizontalDragScroll = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    let activePointerId: number | null = null;
    let startClientX = 0;
    let startScrollLeft = 0;
    let suppressClick = false;

    const cleanupDragState = (): void => {
      activePointerId = null;
      node.dataset.dragScrolling = "false";
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      if (node.scrollWidth <= node.clientWidth + 1) {
        return;
      }

      activePointerId = event.pointerId;
      startClientX = event.clientX;
      startScrollLeft = node.scrollLeft;
      suppressClick = false;
      node.dataset.dragScrolling = "false";
      node.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - startClientX;
      const absDeltaX = Math.abs(deltaX);
      if (absDeltaX < DRAG_START_THRESHOLD_PX) {
        return;
      }

      node.dataset.dragScrolling = "true";
      node.scrollLeft = startScrollLeft - deltaX;
      if (absDeltaX >= CLICK_CANCEL_THRESHOLD_PX) {
        suppressClick = true;
      }
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      node.releasePointerCapture?.(event.pointerId);
      cleanupDragState();
    };

    const onPointerCancel = (): void => {
      cleanupDragState();
    };

    const onClickCapture = (event: MouseEvent): void => {
      if (!suppressClick) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    };

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", onPointerUp);
    node.addEventListener("pointercancel", onPointerCancel);
    node.addEventListener("lostpointercapture", onPointerCancel);
    node.addEventListener("click", onClickCapture, true);

    return () => {
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("pointercancel", onPointerCancel);
      node.removeEventListener("lostpointercapture", onPointerCancel);
      node.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return ref;
};
