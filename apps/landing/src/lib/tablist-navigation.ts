import type { KeyboardEvent } from "react";

const NAVIGATION_KEYS: ReadonlySet<string> = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

export function handleTablistArrowKeys(
  event: KeyboardEvent<HTMLElement>,
): void {
  if (!NAVIGATION_KEYS.has(event.key)) {
    return;
  }

  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
  );
  if (tabs.length === 0) {
    return;
  }

  const active = document.activeElement;
  const currentIndex = active instanceof HTMLElement ? tabs.indexOf(active) : -1;
  if (currentIndex === -1) {
    return;
  }

  event.preventDefault();
  let nextIndex: number;
  switch (event.key) {
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabs.length - 1;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      break;
    default:
      nextIndex = (currentIndex + 1) % tabs.length;
  }

  tabs[nextIndex]?.focus();
}
