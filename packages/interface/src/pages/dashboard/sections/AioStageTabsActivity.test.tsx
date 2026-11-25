import { Activity, startTransition, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StageTabKey } from '../../AioStageTabBar.types';

function StagePanel({ tabKey }: { tabKey: StageTabKey }) {
  const [count, setCount] = useState(0);
  return (
    <div data-testid={`panel-${tabKey}`}>
      <button
        type="button"
        data-testid={`inc-${tabKey}`}
        onClick={() => setCount((prev) => prev + 1)}
      >
        {count}
      </button>
    </div>
  );
}

function ActivityStageHarness() {
  const [activeTab, setActiveTab] = useState<StageTabKey>('detectText');
  const [visitedTabs, setVisitedTabs] = useState<StageTabKey[]>(['detectText']);

  const selectTab = (nextTab: StageTabKey) => {
    startTransition(() => {
      setVisitedTabs((prev) =>
        prev.includes(nextTab) ? prev : [...prev, nextTab],
      );
      setActiveTab(nextTab);
    });
  };

  return (
    <div>
      <button type="button" onClick={() => selectTab('recognizeText')}>
        OCR
      </button>
      <button type="button" onClick={() => selectTab('detectText')}>
        Detect
      </button>
      {visitedTabs.map((tabKey) => (
        <Activity
          key={tabKey}
          mode={activeTab === tabKey ? 'visible' : 'hidden'}
        >
          <StagePanel tabKey={tabKey} />
        </Activity>
      ))}
    </div>
  );
}

describe('AIO stage tab Activity preservation', () => {
  it('preserves mounted local state when switching away and back across Activity boundaries', () => {
    render(<ActivityStageHarness />);

    fireEvent.click(screen.getByTestId('inc-detectText'));
    expect(screen.getByTestId('inc-detectText')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('OCR'));
    expect(screen.getByTestId('panel-recognizeText')).toBeVisible();
    expect(screen.getByTestId('panel-detectText')).not.toBeVisible();

    fireEvent.click(screen.getByTestId('inc-recognizeText'));
    expect(screen.getByTestId('inc-recognizeText')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('Detect'));
    expect(screen.getByTestId('panel-detectText')).toBeVisible();
    expect(screen.getByTestId('inc-detectText')).toHaveTextContent('1');
  });
});
