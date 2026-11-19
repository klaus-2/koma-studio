// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHoldOriginalShortcut } from './useHoldOriginalShortcut';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';

const fireKey = (
  type: 'keydown' | 'keyup',
  init: KeyboardEventInit,
): void => {
  const event = new KeyboardEvent(type, { bubbles: true, ...init });
  Object.defineProperty(event, 'target', { value: document.body });
  document.body.dispatchEvent(event);
};

describe('useHoldOriginalShortcut', () => {
  beforeEach(() => {
    useUiShellStore.setState({
      mode: 'aio',
      subMode: 'auto',
      processing: false,
      holdOriginalActive: false,
    });
    useImageCollectionStore.setState({
      images: [
        {
          id: 'img-1',
          file: {
            kind: 'direct',
            name: 'page.png',
            type: 'image/png',
            size: 0,
            lastModified: 0,
            resident: new File([], 'page.png'),
            toBlob: async () => new Blob(),
            dimensions: async () => ({ width: 100, height: 40 }),
            release: () => {},
          },
          url: 'blob:img-1',
          width: 100,
          height: 40,
          rotation: 0,
          filters: {
            brightness: 1,
            contrast: 1,
            saturation: 1,
            sharpen: 0,
            levels: { black: 0, white: 255, gamma: 1 },
            grayscale: false,
            inverted: false,
          },
        },
      ],
      activeId: 'img-1',
    });
  });

  afterEach(cleanup);

  it('engages on the full default combo (ALT+O) and releases on keyup', () => {
    renderHook(() => useHoldOriginalShortcut());
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);

    act(() => {
      fireKey('keydown', { code: 'KeyO', key: 'o', altKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(true);

    act(() => {
      fireKey('keyup', { code: 'KeyO', key: 'o', altKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
  });

  it('does not engage on a partial combo (modifier only)', () => {
    renderHook(() => useHoldOriginalShortcut());

    act(() => {
      fireKey('keydown', { code: 'AltLeft', key: 'Alt' });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);

    act(() => {
      fireKey('keyup', { code: 'AltLeft', key: 'Alt' });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
  });

  it('ignores editable targets', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    renderHook(() => useHoldOriginalShortcut());

    act(() => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        code: 'KeyO',
        key: 'o',
        altKey: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      input.dispatchEvent(event);
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
    input.remove();
  });

  it('releases when any combo key is released', () => {
    renderHook(() => useHoldOriginalShortcut());

    act(() => {
      fireKey('keydown', { code: 'KeyO', key: 'o', altKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(true);

    act(() => {
      fireKey('keyup', { code: 'AltLeft', key: 'Alt' });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
  });

  it('releases on window blur (lost keyup)', () => {
    renderHook(() => useHoldOriginalShortcut());

    act(() => {
      fireKey('keydown', { code: 'KeyO', key: 'o', altKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
  });

  it('releases when the tab becomes hidden (lost keyup)', () => {
    renderHook(() => useHoldOriginalShortcut());

    act(() => {
      fireKey('keydown', { code: 'KeyO', key: 'o', altKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(true);

    const visibilitySpy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    } finally {
      visibilitySpy.mockRestore();
    }
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
  });

  it('does not engage while processing', () => {
    useUiShellStore.setState({ processing: true });
    renderHook(() => useHoldOriginalShortcut());

    act(() => {
      fireKey('keydown', { code: 'KeyO', key: 'o', altKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
  });

  it('honors a rebound combo from the shell config', () => {
    const { setKeyboardShortcutConfig } = useUiShellStore.getState();
    const config = useUiShellStore.getState().keyboardShortcutConfig;
    setKeyboardShortcutConfig({
      ...config,
      shortcuts: { ...config.shortcuts, peekOriginalPage: ['CTRL', 'SHIFT', 'J'] },
    });
    renderHook(() => useHoldOriginalShortcut());

    act(() => {
      fireKey('keydown', { code: 'KeyJ', key: 'j', ctrlKey: true, shiftKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(true);

    act(() => {
      fireKey('keyup', { code: 'KeyJ', key: 'j', ctrlKey: true, shiftKey: true });
    });
    expect(useUiShellStore.getState().holdOriginalActive).toBe(false);
  });
});
