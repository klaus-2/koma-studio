import React, { memo } from 'react';

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
  if (itemCount === 0) return null;

  // Use virtualized rendering for ALL view modes when there are many items
  // This prevents rendering hundreds of images simultaneously
  // renderStageItem is passed straight through: VirtualizedLongStrip memoizes
  // items with renderItem in deps, so mirroring it in a ref would render
  // one-commit-stale items after every images change.
  if (itemCount > 5) {
    return (
      <VirtualizedLongStrip
        itemCount={itemCount}
        estimatedItemHeight={viewMode === 'long_strip' ? 800 : 400}
        overscan={viewMode === 'long_strip' ? 2 : 3}
        enabled={true}
        itemKey={itemKey}
        renderItem={renderStageItem}
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
