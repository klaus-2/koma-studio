import React, { memo, useCallback, useRef } from 'react';

import type { ViewMode } from '../../types/dashboard.types';
import { VirtualizedLongStrip } from './VirtualizedLongStrip';

interface DashboardStageGridProps {
  viewMode: ViewMode;
  itemCount: number;
  renderStageItem: (index: number) => React.ReactNode;
  itemKey: (index: number) => string;
}

const DashboardStageGrid = ({
  viewMode,
  itemCount,
  renderStageItem,
  itemKey,
}: DashboardStageGridProps) => {
  // Stable render function reference to prevent VirtualizedLongStrip re-renders
  const renderRef = useRef(renderStageItem);
  renderRef.current = renderStageItem;

  const stableRender = useCallback((index: number) => {
    return renderRef.current(index);
  }, []);

  if (itemCount === 0) return null;

  // Use virtualized rendering for ALL view modes when there are many items
  // This prevents rendering hundreds of images simultaneously
  if (itemCount > 5) {
    return (
      <VirtualizedLongStrip
        itemCount={itemCount}
        estimatedItemHeight={viewMode === 'long_strip' ? 800 : 400}
        overscan={viewMode === 'long_strip' ? 2 : 3}
        enabled={true}
        itemKey={itemKey}
        renderItem={stableRender}
      />
    );
  }

  // For small sets, render directly without virtualization overhead
  const items: React.ReactNode[] = [];
  for (let i = 0; i < itemCount; i++) {
    items.push(
      <div key={itemKey(i)} style={{ contain: 'layout style paint' }}>
        {renderStageItem(i)}
      </div>,
    );
  }
  return <>{items}</>;
};

export default memo(DashboardStageGrid);
