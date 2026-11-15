// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { ModelInstallState } from '@/models/types';

// jsdom has no storage backend (same as aio-pipeline-store.test.ts) —
// Map-backed stub keeps the store's rehydration paths honest.
const storageMap = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string): string | null => storageMap.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      storageMap.set(key, value);
    },
    removeItem: (key: string): void => {
      storageMap.delete(key);
    },
    clear: (): void => {
      storageMap.clear();
    },
    key: (): string | null => null,
    length: 0,
  },
});

const fetchResponse = (body: object): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

interface CatalogBuildModules {
  I18nProvider: (props: { children: ReactNode }) => ReactNode;
  useAioStageCatalogBuild: (args: {
    customOcrStageOptions: [];
    customTranslationStageOptions: [];
    modelEntries: Record<string, ModelInstallState>;
  }) => void;
  useAioPipelineStore: typeof import('@/pages/dashboard/stores/aio-pipeline-store')['useAioPipelineStore'];
  useUiShellStore: typeof import('@/pages/dashboard/stores/ui-shell-store')['useUiShellStore'];
  isStageOptionSelectable: typeof import('@/models/aioStageCatalog')['isStageOptionSelectable'];
}

// The hydration gate is a module-level once-per-session flag: every test
// re-imports after resetModules so each scenario starts unhydrated.
const importCatalogBuildModules = async (): Promise<CatalogBuildModules> => {
  const { setDesktopBridgeProvider } = await import('@/lib/desktop-bridge');
  setDesktopBridgeProvider({ desktop: null });
  const { I18nProvider } = await import('@/i18n');
  const { useAioStageCatalogBuild } = await import('./aio-pipeline.catalog.build');
  const { useAioPipelineStore } = await import('@/pages/dashboard/stores/aio-pipeline-store');
  const { useUiShellStore } = await import('@/pages/dashboard/stores/ui-shell-store');
  const { isStageOptionSelectable } = await import('@/models/aioStageCatalog');
  return {
    I18nProvider,
    useAioStageCatalogBuild,
    useAioPipelineStore,
    useUiShellStore,
    isStageOptionSelectable,
  };
};

describe('useAioStageCatalogBuild translation service hydration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks configured DeepL and LibreTranslate selectable after the backend answers', async () => {
    const fetchMock = vi.fn(async () =>
      fetchResponse({
        models: [
          { key: 'deepl', implemented: true, available: true },
          { key: 'libretranslate', implemented: true, available: true },
          { key: 'microsoft_translator', implemented: true, available: false },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { I18nProvider, useAioStageCatalogBuild, useAioPipelineStore, isStageOptionSelectable } =
      await importCatalogBuildModules();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <I18nProvider>{children}</I18nProvider>
    );
    renderHook(
      () =>
        useAioStageCatalogBuild({
          customOcrStageOptions: [],
          customTranslationStageOptions: [],
          modelEntries: {},
        }),
      { wrapper },
    );

    // The full suite runs 170+ files in parallel; a 5s waitFor default has
    // already flaked under that load — the mock chain is fast, the scheduler
    // is not. 15s keeps the assertion honest without punishing slow workers.
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/translate/models'),
        );
        expect(
          Object.keys(
            useAioPipelineStore.getState().aioTranslationServiceAvailability,
          ).length,
        ).toBeGreaterThan(0);
      },
      { timeout: 15_000 },
    );

    const options = useAioPipelineStore.getState().aioStageOptions.getTranslations;
    const deepl = options.find((option) => option.key === 'deepl_translate');
    const libre = options.find((option) => option.key === 'libretranslate');
    expect(deepl?.available).toBe(true);
    expect(isStageOptionSelectable(deepl, {})).toBe(true);
    expect(libre?.available).toBe(true);
    expect(isStageOptionSelectable(libre, {})).toBe(true);
  });

  it('keeps unconfigured engines listed and selectable when the backend reports them unavailable', async () => {
    const fetchMock = vi.fn(async () =>
      fetchResponse({
        models: [
          { key: 'deepl', implemented: true, available: false },
          { key: 'libretranslate', implemented: true, available: false },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { I18nProvider, useAioStageCatalogBuild, useAioPipelineStore, isStageOptionSelectable } =
      await importCatalogBuildModules();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <I18nProvider>{children}</I18nProvider>
    );
    renderHook(
      () =>
        useAioStageCatalogBuild({
          customOcrStageOptions: [],
          customTranslationStageOptions: [],
          modelEntries: {},
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(
        useAioPipelineStore.getState().aioTranslationServiceAvailability,
      ).toEqual({ deepl_translate: false, libretranslate: false });
    });

    const options = useAioPipelineStore.getState().aioStageOptions.getTranslations;
    for (const key of ['deepl_translate', 'libretranslate']) {
      const option = options.find((candidate) => candidate.key === key);
      expect(option?.available).toBe(false);
      expect(isStageOptionSelectable(option, {})).toBe(true);
    }
  });

  it('preserves the static defaults when the fetch fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('backend offline');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { I18nProvider, useAioStageCatalogBuild, useAioPipelineStore, isStageOptionSelectable } =
      await importCatalogBuildModules();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <I18nProvider>{children}</I18nProvider>
    );
    renderHook(
      () =>
        useAioStageCatalogBuild({
          customOcrStageOptions: [],
          customTranslationStageOptions: [],
          modelEntries: {},
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await expect(
      waitFor(() => {
        expect(
          useAioPipelineStore.getState().aioTranslationServiceAvailability,
        ).toEqual({});
      }),
    ).resolves.toBeUndefined();

    const options = useAioPipelineStore.getState().aioStageOptions.getTranslations;
    for (const key of ['deepl_translate', 'libretranslate']) {
      const option = options.find((candidate) => candidate.key === key);
      expect(option?.available).toBe(false);
      expect(isStageOptionSelectable(option, {})).toBe(true);
    }
  });

  it('never fetches translate models outside the aio mode', async () => {
    const fetchMock = vi.fn(async () =>
      fetchResponse({
        models: [{ key: 'deepl', implemented: true, available: true }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const {
      I18nProvider,
      useAioStageCatalogBuild,
      useAioPipelineStore,
      useUiShellStore,
    } = await importCatalogBuildModules();
    useUiShellStore.setState({ mode: 'cleaner' });
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <I18nProvider>{children}</I18nProvider>
    );
    renderHook(
      () =>
        useAioStageCatalogBuild({
          customOcrStageOptions: [],
          customTranslationStageOptions: [],
          modelEntries: {},
        }),
      { wrapper },
    );

    await expect(
      waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      }, { timeout: 250 }),
    ).rejects.toThrow();

    expect(
      useAioPipelineStore.getState().aioTranslationServiceAvailability,
    ).toEqual({});
  });
});
