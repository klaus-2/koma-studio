import { useRef, useState } from "react";
import type {
  CSSProperties,
  FocusEvent,
  ReactElement,
  ReactNode,
} from "react";
import {
  defaultRangeExtractor,
  useVirtualizer,
} from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";

export interface VirtualizedLongStripProps {
  readonly itemCount: number;
  readonly estimatedItemHeight?: number;
  readonly overscan?: number;
  readonly className?: string;
  readonly renderItem: (index: number) => ReactNode;
  readonly itemKey?: (index: number) => string;
  readonly enabled?: boolean;
  readonly height?: CSSProperties["height"];
  readonly ariaLabel?: string;
}

export interface VirtualizedLongStripBaseProps
  extends VirtualizedLongStripProps {
  readonly variant: "classic" | "noir";
}

const defaultItemKey = (index: number): string => `item-${index}`;

const assertConfiguration = (
  itemCount: number,
  estimatedItemHeight: number,
  overscan: number,
): void => {
  if (!Number.isSafeInteger(itemCount) || itemCount < 0) {
    throw new RangeError("itemCount must be a non-negative safe integer.");
  }

  if (
    !Number.isFinite(estimatedItemHeight) ||
    estimatedItemHeight <= 0
  ) {
    throw new RangeError("estimatedItemHeight must be finite and positive.");
  }

  if (!Number.isSafeInteger(overscan) || overscan < 0) {
    throw new RangeError("overscan must be a non-negative safe integer.");
  }

  if (!Number.isFinite(itemCount * estimatedItemHeight)) {
    throw new RangeError("The estimated list height must be finite.");
  }
};

const readItemIndex = (
  target: EventTarget,
  container: HTMLDivElement,
): number | null => {
  if (!(target instanceof Element)) {
    return null;
  }

  const item = target.closest("[data-long-strip-index]");

  if (item === null || !container.contains(item)) {
    return null;
  }

  const value = item.getAttribute("data-long-strip-index");

  if (value === null) {
    return null;
  }

  const index = Number(value);

  return Number.isSafeInteger(index) && index >= 0 ? index : null;
};

export function VirtualizedLongStripBase({
  itemCount,
  estimatedItemHeight = 600,
  overscan = 2,
  className,
  renderItem,
  itemKey = defaultItemKey,
  enabled = true,
  height = "min(100dvh, 60rem)",
  ariaLabel = "Pages",
  variant,
}: VirtualizedLongStripBaseProps): ReactElement {
  assertConfiguration(itemCount, estimatedItemHeight, overscan);

  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLLIElement>({
    count: itemCount,
    enabled,
    getScrollElement: () => containerRef.current,
    getItemKey: itemKey,
    estimateSize: () => estimatedItemHeight,
    overscan,
    rangeExtractor: (range: Range): number[] => {
      const indexes = defaultRangeExtractor(range);

      if (focusedKey === null) {
        return indexes;
      }

      const active = document.activeElement;
      const container = containerRef.current;

      if (active === null || container === null) {
        return indexes;
      }

      const focusedIndex = readItemIndex(active, container);

      if (
        focusedIndex === null ||
        focusedIndex >= itemCount ||
        itemKey(focusedIndex) !== focusedKey ||
        indexes.includes(focusedIndex)
      ) {
        return indexes;
      }

      // `indexes` is already sorted; splice the focused index into place.
      return [
        ...indexes.filter((value) => value < focusedIndex),
        focusedIndex,
        ...indexes.filter((value) => value >= focusedIndex),
      ];
    },
  });

  const handleFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const index = readItemIndex(event.target, event.currentTarget);

    setFocusedKey(
      index !== null && index < itemCount ? itemKey(index) : null,
    );
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setFocusedKey(null);
  };

  const listStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: enabled ? virtualizer.getTotalSize() : undefined,
    margin: 0,
    padding: 0,
    listStyle: "none",
  };

  return (
    <div
      ref={containerRef}
      className={className}
      data-variant={variant}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
      style={{
        position: "relative",
        height,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        overflowAnchor: "none",
      }}
    >
      <ol role="list" style={listStyle}>
        {enabled
          ? virtualizer.getVirtualItems().map((item) => (
            <li
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              data-long-strip-index={item.index}
              aria-posinset={item.index + 1}
              aria-setsize={itemCount}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                display: "flow-root",
                transform: `translateY(${item.start}px)`,
              }}
            >
              {renderItem(item.index)}
            </li>
          ))
          : Array.from({ length: itemCount }, (_, index) => (
            <li
              key={itemKey(index)}
              data-long-strip-index={index}
              aria-posinset={index + 1}
              aria-setsize={itemCount}
              style={{ display: "flow-root" }}
            >
              {renderItem(index)}
            </li>
          ))}
      </ol>
    </div>
  );
}
