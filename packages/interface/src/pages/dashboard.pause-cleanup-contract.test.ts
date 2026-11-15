import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/pages/Dashboard.tsx'),
  'utf8',
)
  .replace(/\r\n/g, '\n');

describe('Dashboard pause-aware cleanup contract', () => {
  it('the processing-cleanup effect checks the pause phase before clearing', () => {
    const effectStart = dashboardSource.indexOf(
      "if (\n      !processing &&\n      useAioBatchPauseStore.getState().pausePhase === 'idle'",
    );
    expect(effectStart).toBeGreaterThan(-1);
    const effectBody = dashboardSource.slice(
      effectStart,
      dashboardSource.indexOf('}, [clearAioExecutionState, processing]);', effectStart),
    );
    expect(effectBody).toContain('clearAioExecutionState()');
  });

  it('imports the pause store the gate reads', () => {
    expect(dashboardSource).toContain('aio-batch-pause-store');
  });
});
