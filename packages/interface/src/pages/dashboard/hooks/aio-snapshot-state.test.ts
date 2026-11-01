import { describe, expect, it } from 'vitest';
import { deriveAioFooterProcessingLabel } from '@/pages/dashboard/hooks/aio-snapshot-state';
import type { ToolMode } from '@/types/dashboard.types';
import type { AioExecutionStatus } from '@/utils/dashboardRenderUtils';

function makeExecutionStatus(
  overrides: Partial<AioExecutionStatus> = {},
): AioExecutionStatus {
  return {
    scope: 'auto',
    stageKey: 'translate',
    imageName: 'page-01.png',
    imageIndex: 0,
    totalImages: 10,
    label: 'Translating page 1 of 10',
    ...overrides,
  };
}

function deriveLabel({
  mode = 'aio',
  processing = true,
  executionStatus = makeExecutionStatus(),
}: {
  mode?: ToolMode;
  processing?: boolean;
  executionStatus?: AioExecutionStatus | null;
} = {}): string | null {
  return deriveAioFooterProcessingLabel({
    mode,
    processing,
    executionStatus,
    manualScopeLabel: 'Manual scope',
    autoScopeLabel: 'Auto scope',
  });
}

describe('deriveAioFooterProcessingLabel', () => {
  it('returns null when the tool mode is not aio', () => {
    expect(deriveLabel({ mode: 'translator' })).toBeNull();
  });

  it('returns null when the app is not processing', () => {
    expect(deriveLabel({ processing: false })).toBeNull();
  });

  it('returns null when there is no execution status', () => {
    expect(deriveLabel({ executionStatus: null })).toBeNull();
  });

  it.each([
    ['manual', 'Manual scope: Translating page 1 of 10'],
    ['auto', 'Auto scope: Translating page 1 of 10'],
  ] as const)('formats the %s scope label with the execution status', (scope, expected) => {
    expect(deriveLabel({ executionStatus: makeExecutionStatus({ scope }) })).toBe(expected);
  });
});
