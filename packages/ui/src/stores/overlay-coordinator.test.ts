import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activateOverlay,
  dismissAllOverlays,
  registerOverlay,
} from './overlay-coordinator';

describe('overlay-coordinator', () => {
  afterEach(() => {
    dismissAllOverlays();
  });

  it('closes unrelated overlays when activating a new overlay', () => {
    const closeDock = vi.fn();
    const closeUserMenu = vi.fn();
    const unregDock = registerOverlay('dock-tools', closeDock);
    const unregMenu = registerOverlay('topbar-user', closeUserMenu);

    activateOverlay('topbar-user');

    expect(closeDock).toHaveBeenCalledTimes(1);
    expect(closeUserMenu).not.toHaveBeenCalled();

    unregDock();
    unregMenu();
  });

  it('keeps ancestor chain open when activating a nested child overlay', () => {
    const closeParent = vi.fn();
    const closeGrandparent = vi.fn();
    const closeChild = vi.fn();
    const closeOther = vi.fn();

    const unregGrand = registerOverlay('dock-root', closeGrandparent);
    const unregParent = registerOverlay('type-dock', closeParent, 'dock-root');
    const unregChild = registerOverlay('font-popover', closeChild, 'type-dock');
    const unregOther = registerOverlay('topbar-export', closeOther);

    activateOverlay('font-popover');

    expect(closeGrandparent).not.toHaveBeenCalled();
    expect(closeParent).not.toHaveBeenCalled();
    expect(closeChild).not.toHaveBeenCalled();
    expect(closeOther).toHaveBeenCalledTimes(1);

    unregGrand();
    unregParent();
    unregChild();
    unregOther();
  });

  it('closes all registered overlays on dismissAllOverlays', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const unregA = registerOverlay('a', closeA);
    const unregB = registerOverlay('b', closeB, 'a');

    dismissAllOverlays();

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);

    unregA();
    unregB();
  });

  it('does not unregister a newer entry when an older cleanup runs late', () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const unregFirst = registerOverlay('shared-id', closeFirst);
    const unregSecond = registerOverlay('shared-id', closeSecond);

    unregFirst();
    activateOverlay('other-id');

    expect(closeFirst).not.toHaveBeenCalled();
    expect(closeSecond).toHaveBeenCalledTimes(1);

    unregSecond();
  });
});
