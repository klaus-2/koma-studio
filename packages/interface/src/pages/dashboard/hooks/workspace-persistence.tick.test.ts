/**
 * Autosave interval tick tests. The interaction gate is the LAST guard: a
 * tick skipped while interaction is active must keep workspaceAutosaveDirty
 * set so the next tick saves, and the pre-existing guards (dirty, processing,
 * restoring, saving) must short-circuit before the gate is consulted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runWorkspaceAutosaveTick } from './workspace-persistence';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';

const isInteractionActiveMock = vi.hoisted(() =>
  vi.fn<(graceMs?: number) => boolean>(() => false),
);

vi.mock('../../../utils/interactionGate', () => ({
  isInteractionActive: isInteractionActiveMock,
}));

const saveSpy = vi.fn(async (): Promise<boolean> => true);

describe('runWorkspaceAutosaveTick', () => {
  beforeEach(() => {
    isInteractionActiveMock.mockReset();
    isInteractionActiveMock.mockReturnValue(false);
    saveSpy.mockClear();
    useUiShellStore.setState({ processing: false });
    useWorkspacePersistenceStore.setState({
      workspaceAutosaveDirty: true,
      workspaceAutosaveSaving: false,
      latestWorkspaceCaptureState: null,
      saveWorkspaceAutosaveImpl: saveSpy,
    });
  });

  it('skips the save and keeps the dirty flag while interaction is active', () => {
    isInteractionActiveMock.mockReturnValue(true);

    runWorkspaceAutosaveTick(false);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(isInteractionActiveMock).toHaveBeenCalledTimes(1);
    expect(useWorkspacePersistenceStore.getState().workspaceAutosaveDirty).toBe(true);
  });

  it('saves and clears the dirty flag when the gate is released', async () => {
    runWorkspaceAutosaveTick(false);
    await Promise.resolve();
    await Promise.resolve();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(useWorkspacePersistenceStore.getState().workspaceAutosaveDirty).toBe(false);
  });

  it('does not save when nothing is dirty, even with the gate active', () => {
    isInteractionActiveMock.mockReturnValue(true);
    useWorkspacePersistenceStore.setState({ workspaceAutosaveDirty: false });

    runWorkspaceAutosaveTick(false);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(useWorkspacePersistenceStore.getState().workspaceAutosaveDirty).toBe(false);
  });

  it('short-circuits on processing before consulting the gate', () => {
    useUiShellStore.setState({ processing: true });

    runWorkspaceAutosaveTick(false);

    expect(isInteractionActiveMock).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('short-circuits on restore before consulting the gate', () => {
    runWorkspaceAutosaveTick(true);

    expect(isInteractionActiveMock).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('short-circuits on an in-flight save before consulting the gate', () => {
    useWorkspacePersistenceStore.setState({ workspaceAutosaveSaving: true });

    runWorkspaceAutosaveTick(false);

    expect(isInteractionActiveMock).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('keeps workspaceAutosaveDirty set when a new workspace edit occurs while save is in flight', async () => {
    const deferred: { resolve: ((value: boolean) => void) | null } = {
      resolve: null,
    };
    const deferredSave = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          deferred.resolve = resolve;
        }),
    );
    useWorkspacePersistenceStore.setState({
      workspaceAutosaveDirty: true,
      workspaceAutosaveSaving: false,
      workspaceChangeVersion: 5,
      saveWorkspaceAutosaveImpl: deferredSave,
    });

    runWorkspaceAutosaveTick(false);
    expect(deferredSave).toHaveBeenCalledTimes(1);

    useWorkspacePersistenceStore.getState().workspaceChangeVersion += 1;
    deferred.resolve?.(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(useWorkspacePersistenceStore.getState().workspaceAutosaveDirty).toBe(true);
  });
});
