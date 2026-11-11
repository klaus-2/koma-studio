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
    // pointermove fires at device rate (often more than once per frame); the
    // scrollLeft commit is coalesced to one write per animation frame.
    let pendingDeltaX: number | null = null;
    let scrollFrameId: number | null = null;
    // The data-drag-scrolling flag drives `cursor: grabbing` CSS on the thumb
    // strips (optimizer/watermark) — written once per drag transition, never
    // per move.
    let dragFlagSet = false;

    const commitPendingScroll = (): void => {
      if (pendingDeltaX === null) {
        return;
      }
      node.scrollLeft = startScrollLeft - pendingDeltaX;
      pendingDeltaX = null;
    };

    const commitScrollFrame = (): void => {
      scrollFrameId = null;
      commitPendingScroll();
    };

    const cancelScrollFrame = (): void => {
      if (scrollFrameId !== null) {
        cancelAnimationFrame(scrollFrameId);
        scrollFrameId = null;
      }
    };

    const cleanupDragState = (): void => {
      activePointerId = null;
      pendingDeltaX = null;
      cancelScrollFrame();
      if (dragFlagSet) {
        dragFlagSet = false;
        node.dataset.dragScrolling = "false";
      }
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
      if (dragFlagSet) {
        dragFlagSet = false;
        node.dataset.dragScrolling = "false";
      }
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

      pendingDeltaX = deltaX;
      if (absDeltaX >= CLICK_CANCEL_THRESHOLD_PX) {
        suppressClick = true;
      }
      if (!dragFlagSet) {
        dragFlagSet = true;
        node.dataset.dragScrolling = "true";
      }
      if (scrollFrameId === null) {
        scrollFrameId = requestAnimationFrame(commitScrollFrame);
      }
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      node.releasePointerCapture?.(event.pointerId);
      // Flush the delta of the current frame so the drag's last position is
      // not dropped, then tear down.
      commitPendingScroll();
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
      cancelScrollFrame();
    };
  }, []);

  return ref;
};
