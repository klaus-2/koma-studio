import { useCallback, useEffect, useRef, useState } from "react";

type CursorVariant = "default" | "hover" | "click" | "text" | "grab" | "loading" | "hidden";

const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], [role='tab'], input[type='submit'], select, .koma-btn, .koma-iconbtn, .koma-mode-tab, .koma-seg__btn, .koma-menu__item, .koma-fileitem, .koma-dropzone, .koma-toggle-pill, .koma-provider-btn, .koma-channel-btn, .koma-user__btn, .auth-submit, .auth-tab, .auth-link, .koma-slider__value, .koma-password__toggle, .koma-toast__btn, .koma-back-btn, label[for], .auth-check, .koma-render-handle";

const TEXT_SELECTOR =
  "input[type='text'], input[type='email'], input[type='password'], input[type='number'], input[type='search'], textarea, [contenteditable='true']";

const GRAB_SELECTOR = ".koma-range, input[type='range']";

export const CustomCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: -100, y: -100 });
  const moveRafRef = useRef(0);
  const visibleRef = useRef(false);
  const variantRef = useRef<CursorVariant>("default");

  const [variant, setVariant] = useState<CursorVariant>("default");
  const [visible, setVisible] = useState(false);
  const [clicking, setClicking] = useState(false);

  const isTouchDevice =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const detectVariant = useCallback((target: EventTarget | null): CursorVariant => {
    if (!target || !(target instanceof HTMLElement)) {
      return "default";
    }

    if (target.closest(INTERACTIVE_SELECTOR)) {
      return "hover";
    }

    if (target.closest(TEXT_SELECTOR)) {
      return "text";
    }

    if (target.closest(GRAB_SELECTOR)) {
      return "grab";
    }

    return "default";
  }, []);

  const applyDotPosition = useCallback(() => {
    moveRafRef.current = 0;
    const dot = dotRef.current;
    if (!dot) {
      return;
    }
    dot.style.transform = `translate3d(${pointerRef.current.x}px, ${pointerRef.current.y}px, 0)`;
  }, []);

  const scheduleDotPosition = useCallback(() => {
    if (moveRafRef.current !== 0) {
      return;
    }
    moveRafRef.current = window.requestAnimationFrame(applyDotPosition);
  }, [applyDotPosition]);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      pointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleDotPosition();

      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }

      const nextVariant = detectVariant(event.target);
      if (variantRef.current !== nextVariant) {
        variantRef.current = nextVariant;
        setVariant(nextVariant);
      }
    },
    [detectVariant, scheduleDotPosition],
  );

  const onPointerDown = useCallback((event: PointerEvent) => {
    if (event.pointerType && event.pointerType !== "mouse") {
      return;
    }
    setClicking(true);
  }, []);

  const onPointerUp = useCallback(() => setClicking(false), []);

  const onPointerEnter = useCallback(() => {
    if (visibleRef.current) {
      return;
    }
    visibleRef.current = true;
    setVisible(true);
  }, []);

  const onPointerLeave = useCallback(() => {
    if (!visibleRef.current) {
      return;
    }
    visibleRef.current = false;
    setVisible(false);
    setClicking(false);
  }, []);

  useEffect(() => {
    if (isTouchDevice) {
      return;
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mouseenter", onPointerEnter);
    document.addEventListener("mouseleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseenter", onPointerEnter);
      document.removeEventListener("mouseleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
    };
  }, [isTouchDevice, onPointerDown, onPointerEnter, onPointerLeave, onPointerMove, onPointerUp]);

  useEffect(() => {
    if (isTouchDevice) {
      return;
    }

    document.documentElement.classList.add("koma-custom-cursor-active");
    return () => document.documentElement.classList.remove("koma-custom-cursor-active");
  }, [isTouchDevice]);

  useEffect(() => {
    return () => {
      if (moveRafRef.current !== 0) {
        window.cancelAnimationFrame(moveRafRef.current);
      }
    };
  }, []);

  if (isTouchDevice) {
    return null;
  }

  const stateClass = [
    "koma-cursor",
    visible ? "koma-cursor--visible" : "",
    clicking ? "koma-cursor--clicking" : "",
    `koma-cursor--${variant}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={stateClass} aria-hidden="true">
      <div ref={dotRef} className="koma-cursor__dot" />
    </div>
  );
};
