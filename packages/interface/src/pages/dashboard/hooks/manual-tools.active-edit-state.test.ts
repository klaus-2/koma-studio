import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useActiveManualEditState } from '@/pages/dashboard/hooks/manual-tools';
import { useCleanerStore } from '@/pages/dashboard/stores/cleaner-store';
import { useManualToolsStore } from '@/pages/dashboard/stores/manual-tools-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import { EMPTY_AIO_MANUAL_EDIT_STATE } from '@/constants/dashboard.constants';
import type { AioManualImageEditState } from '@/types/dashboard.types';

const edited = (
  patch: Partial<AioManualImageEditState>,
): AioManualImageEditState => ({
  ...EMPTY_AIO_MANUAL_EDIT_STATE,
  ...patch,
});

const args = {
  resolvedActiveId: 'img-1',
  getAioManualImageEditState: () => EMPTY_AIO_MANUAL_EDIT_STATE,
  getCleanerManualImageEditState: () => EMPTY_AIO_MANUAL_EDIT_STATE,
};

beforeEach(() => {
  useManualToolsStore.setState({ aioManualImageEditsByImage: {} });
  useCleanerStore.setState({ cleanerManualImageEditsByImage: {} });
  useUiShellStore.setState({ mode: 'aio' });
});

describe('useActiveManualEditState', () => {
  it('reacts to a wand mask set after mount on the active image', () => {
    const { result } = renderHook(() => useActiveManualEditState(args));
    expect(result.current.activeHasManualWandSelection).toBe(false);

    act(() => {
      useManualToolsStore.setState({
        aioManualImageEditsByImage: {
          'img-1': edited({ wandMaskDataUrl: 'data:image/png;base64,AAAA' }),
        },
      });
    });

    expect(result.current.activeHasManualWandSelection).toBe(true);
  });

  it('reacts to paint and base overrides on the active image', () => {
    const { result } = renderHook(() => useActiveManualEditState(args));

    act(() => {
      useManualToolsStore.setState({
        aioManualImageEditsByImage: {
          'img-1': edited({ paintLayerDataUrl: 'data:image/png;base64,BBBB' }),
        },
      });
    });
    expect(result.current.activeHasManualPaintLayer).toBe(true);
    expect(result.current.activeHasManualBaseOverride).toBe(false);

    act(() => {
      useManualToolsStore.setState({
        aioManualImageEditsByImage: {
          'img-1': edited({ baseImageDataUrl: 'data:image/png;base64,CCCC' }),
        },
      });
    });
    expect(result.current.activeHasManualBaseOverride).toBe(true);
    expect(result.current.activeHasManualPaintLayer).toBe(false);
  });

  it('reads the cleaner map while the cleaner mode is active', () => {
    useUiShellStore.setState({ mode: 'cleaner' });
    const { result } = renderHook(() => useActiveManualEditState(args));
    expect(result.current.activeHasManualWandSelection).toBe(false);

    act(() => {
      useCleanerStore.setState({
        cleanerManualImageEditsByImage: {
          'img-1': edited({ wandMaskDataUrl: 'data:image/png;base64,DDDD' }),
        },
      });
    });

    expect(result.current.activeHasManualWandSelection).toBe(true);
  });
});
