import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OverlayParentProvider,
  dismissAllOverlays,
  useExclusiveOverlay,
} from '@koma/ui/stores/overlay-coordinator';

describe('useExclusiveOverlay & OverlayParentProvider', () => {
  afterEach(() => {
    dismissAllOverlays();
  });

  it('inherits OverlayParentProvider and only activates on false->true transition', () => {
    const closeDock = vi.fn();
    const closeChild = vi.fn();
    const closePeer = vi.fn();

    const peerHook = renderHook(
      ({ open }: { open: boolean }) => {
        useExclusiveOverlay('peer-menu', open, closePeer);
      },
      { initialProps: { open: true } },
    );

    const dockHook = renderHook(
      ({ open }: { open: boolean }) => {
        useExclusiveOverlay('dock-panel', open, closeDock);
      },
      { initialProps: { open: false } },
    );

    expect(closePeer).not.toHaveBeenCalled();

    act(() => {
      dockHook.rerender({ open: true });
    });
    expect(closePeer).toHaveBeenCalledTimes(1);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(OverlayParentProvider, { id: 'dock-panel', children });

    const childHook = renderHook(
      ({ open }: { open: boolean }) => {
        useExclusiveOverlay('dock-color-popover', open, closeChild);
      },
      { initialProps: { open: false }, wrapper },
    );

    act(() => {
      childHook.rerender({ open: true });
    });
    expect(closeDock).not.toHaveBeenCalled();

    peerHook.unmount();
    dockHook.unmount();
    childHook.unmount();
  });
});
