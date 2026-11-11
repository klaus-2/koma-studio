// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { createEmptyCustomLlmDraft, saveCustomLlmProfile } from '@/utils/customLlm';
import { useCustomLlmDrafts } from './llm-providers.profiles';

vi.mock('@/utils/customLlm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/customLlm')>()),
  saveCustomLlmProfile: vi.fn(),
}));

const saveMock = vi.mocked(saveCustomLlmProfile);

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(I18nProvider, null, children);

const seedDrafts = (translationLabel: string, translationId: string | null = 'profile-1'): void => {
  const empty = createEmptyCustomLlmDraft();
  useLlmProvidersStore.setState({
    customLlmDrafts: {
      translation: { ...empty, id: translationId, label: translationLabel },
      ocr: { ...empty },
      clean: { ...empty },
    },
  });
};

const renderDrafts = (applyCustomProfileSelection = vi.fn()) =>
  renderHook(
    () =>
      useCustomLlmDrafts({
        userId: 'user-1',
        aioStageSelection: {
          detectText: 'det',
          recognizeText: 'ocr',
          segmentText: 'seg',
          cleanImage: 'clean',
          getTranslations: 'tr',
        },
        setAioStageSelection: vi.fn(),
        applyCustomProfileSelection,
        syncFreeProviderDraftsFromProfiles: vi.fn(),
        setStatusMessage: vi.fn(),
        ollamaLocalApiBase: 'http://127.0.0.1:11434/v1',
      }),
    { wrapper },
  );

describe('useCustomLlmDrafts commit-point actions', () => {
  beforeEach(() => {
    setDesktopBridgeProvider({ desktop: null });
    saveMock.mockReset();
    saveMock.mockResolvedValue({
      profiles: [],
      mode: 'browser_local',
      profile: {
        ...createEmptyCustomLlmDraft(),
        id: 'saved-1',
        label: 'saved',
        stage: 'translation',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    seedDrafts('before typing');
  });

  it('saves the store draft as it exists at call time, not at render time', async () => {
    const { result } = renderDrafts();

    // The section commits the typed draft to the store right before saving.
    // Simulate a commit that lands AFTER the hook's render closure was built.
    seedDrafts('typed by the user');
    await result.current.saveCustomLlmDraftProfile('translation');

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock.mock.calls[0]?.[2]).toMatchObject({
      label: 'typed by the user',
    });
  });

  it('applies the profile the store holds at call time, not at render time', async () => {
    const applyCustomProfileSelection = vi.fn();
    const savedProfile = {
      ...createEmptyCustomLlmDraft(),
      id: 'profile-2',
      stage: 'translation' as const,
      label: 'after commit',
      apiBase: 'http://x',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    // Registered BEFORE the render: the profiles list is a render-time read;
    // the DRAFT is what the section commits post-render.
    useLlmProvidersStore.setState({ customLlmProfiles: [savedProfile] });
    const { result } = renderDrafts(applyCustomProfileSelection);

    seedDrafts('after commit', 'profile-2');
    await result.current.useExistingCustomProfile('translation');

    expect(applyCustomProfileSelection).toHaveBeenCalledWith('translation', savedProfile);
  });
});
