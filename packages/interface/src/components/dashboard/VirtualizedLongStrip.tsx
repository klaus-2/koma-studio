import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

interface VirtualizationConfig {
  totalItems: number;
  estimatedItemHeight?: number;
  overscan?: number;
  rootMargin?: number;
}

export function useIntersectionVirtualization(config: VirtualizationConfig) {
  const {
    totalItems,
    estimatedItemHeight = 600,
    overscan = 2,
    rootMargin = 400,
  } = config;

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [visibleRange, setVisibleRange] = useState<[number, number]>(() => {
    const end = Math.min(overscan + 1, totalItems - 1);
    return [0, end >= 0 ? end : 0];
  });

  const marginPx = `${rootMargin}px`;

  // Stable callback for IntersectionObserver
  const handleEntries = useCallback((entries: IntersectionObserverEntry[]) => {
    let minVisible = Infinity;
    let maxVisible = -Infinity;
    let anyVisible = false;

    for (const entry of entries) {
      const index = parseInt(
        (entry.target as HTMLElement).dataset.index || '0',
        10,
      );
      if (entry.isIntersecting) {
        anyVisible = true;
        if (index < minVisible) minVisible = index;
        if (index > maxVisible) maxVisible = index;
      }
    }

    if (anyVisible) {
      setVisibleRange([
        Math.max(0, minVisible - overscan),
        Math.min(totalItems - 1, maxVisible + overscan),
      ]);
    }
  }, [totalItems, overscan]);

  // Create observer once, reuse across re-renders
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleEntries, {
      root: container,
      rootMargin: marginPx,
      threshold: 0,
    });

    const observer = observerRef.current;
    for (const [, el] of sentinelRefs.current) {
      if (el && container.contains(el)) {
        observer.observe(el);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [handleEntries, marginPx]);

  // Reset visible range when totalItems changes significantly
  useEffect(() => {
    setVisibleRange(([currentStart, currentEnd]) => {
      const newEnd = Math.min(currentEnd, Math.max(0, totalItems - 1));
      const newStart = Math.min(currentStart, newEnd);
      if (newStart !== currentStart || newEnd !== currentEnd) {
        return [newStart, newEnd];
      }
      return [currentStart, currentEnd];
    });
  }, [totalItems]);

  const setSentinelRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      const observer = observerRef.current;

      if (el) {
        sentinelRefs.current.set(index, el);
        if (observer && containerRef.current?.contains(el)) {
          observer.observe(el);
        }
      } else {
        const old = sentinelRefs.current.get(index);
        if (old && observer) {
          observer.unobserve(old);
        }
        sentinelRefs.current.delete(index);
      }
    },
    [],
  );

  const totalHeight = totalItems * estimatedItemHeight;

  return {
    containerRef,
    visibleRange,
    totalHeight,
    setSentinelRef,
  };
}

export interface VirtualizedLongStripProps {
  itemCount: number;
  estimatedItemHeight?: number;
  overscan?: number;
  className?: string;
  renderItem: (index: number) => React.ReactNode;
  itemKey?: (index: number) => string;
  enabled?: boolean;
}

/**
 * Virtualized container for long-strip manga reader.
 * Uses IntersectionObserver to only mount visible items + overscan buffer.
 * Unmounted items are replaced with spacers to maintain scroll position.
 */
export function VirtualizedLongStrip({
  itemCount,
  estimatedItemHeight = 600,
  overscan = 2,
  className,
  renderItem,
  itemKey = (i) => `item-${i}`,
  enabled = true,
}: VirtualizedLongStripProps) {
  const { containerRef, visibleRange, setSentinelRef } =
    useIntersectionVirtualization({
      totalItems: itemCount,
      estimatedItemHeight,
      overscan,
      rootMargin: Math.max(estimatedItemHeight * 2, 400),
    });

  const [start, end] = visibleRange;

  const items = useMemo(() => {
    if (!enabled || itemCount <= (overscan * 2) + 3) {
      // For small lists, render everything - virtualization overhead not worth it
      return Array.from({ length: itemCount }, (_, i) => renderItem(i));
    }

    const result: React.ReactNode[] = [];

    for (let i = 0; i < itemCount; i++) {
      const isVisible = i >= start && i <= end;

      if (isVisible) {
        result.push(
          <div
            key={itemKey(i)}
            data-index={i}
            ref={setSentinelRef(i)}
            style={{ contain: 'layout style paint' }}
          >
            {renderItem(i)}
          </div>,
        );
      } else {
        result.push(
          <div
            key={itemKey(i)}
            style={{
              height: estimatedItemHeight,
              contain: 'content',
            }}
            aria-hidden="true"
          />,
        );
      }
    }

    return result;
  }, [
    enabled,
    itemCount,
    start,
    end,
    overscan,
    estimatedItemHeight,
    renderItem,
    itemKey,
    setSentinelRef,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        willChange: 'scroll-position',
      }}
    >
      {items}
    </div>
  );
}
