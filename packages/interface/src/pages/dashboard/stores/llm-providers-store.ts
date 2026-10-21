import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  getDefaultFreeProviderDraft,
  getFreeProvidersForStage,
} from '../../../models/freeAiProviderCatalog';
import type { FreeProviderDraftMap } from '../../../types/dashboard.types';
import { toFreeProviderDraftKey } from '../../../utils/dashboard.utils';
import {
  createEmptyCustomLlmDraft,
  loadPersistedLlmSettings,
  type CustomLlmProfile,
  type CustomLlmProfileDraft,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
  type LlmRequestSettings,
} from '../../../utils/customLlm';

type PendingCustomSelections = Record<CustomLlmStage, string | null>;
type CustomLlmDraftsByStage = Record<CustomLlmStage, CustomLlmProfileDraft>;

const buildInitialFreeProviderDrafts = (): FreeProviderDraftMap => {
  const seed: FreeProviderDraftMap = {};
  const providers = [
    ...getFreeProvidersForStage('translation'),
    ...getFreeProvidersForStage('ocr'),
    ...getFreeProvidersForStage('clean'),
  ];
  for (const provider of providers) {
    for (const stage of ['translation', 'ocr', 'clean'] as const) {
      if (provider.stages[stage]) {
        seed[toFreeProviderDraftKey(stage, provider.id)] =
          getDefaultFreeProviderDraft(provider.id, stage);
      }
    }
  }
  return seed;
};

interface LlmProvidersStore {
  /* ── LLM request settings (persisted) ── */
  llmSettings: LlmRequestSettings;

  /* ── Custom LLM profiles ── */
  customLlmProfiles: CustomLlmProfile[];
  customLlmProfilesLoading: boolean;
  customLlmProfilesError: string | null;
  customLlmProfilesMode: LlmProfilesPersistenceMode;
  customLlmProfilesHydrated: boolean;

  /* ── Transient pending custom selections ── */
  pendingCustomSelections: PendingCustomSelections;

  /* ── Per-stage profile editor drafts ── */
  customLlmDrafts: CustomLlmDraftsByStage;

  /* ── Free-provider drafts (captured by workspace persistence) ── */
  freeProviderDrafts: FreeProviderDraftMap;

  setLlmSettings: (
    llmSettings:
      | LlmRequestSettings
      | ((prev: LlmRequestSettings) => LlmRequestSettings),
  ) => void;
  setCustomLlmProfiles: (
    profiles:
      | CustomLlmProfile[]
      | ((prev: CustomLlmProfile[]) => CustomLlmProfile[]),
  ) => void;
  setCustomLlmProfilesLoading: (loading: boolean) => void;
  setCustomLlmProfilesError: (error: string | null) => void;
  setCustomLlmProfilesMode: (
    mode:
      | LlmProfilesPersistenceMode
      | ((prev: LlmProfilesPersistenceMode) => LlmProfilesPersistenceMode),
  ) => void;
  setCustomLlmProfilesHydrated: (hydrated: boolean) => void;
  setPendingCustomSelections: (selections: PendingCustomSelections) => void;
  markPendingCustomSelection: (
    stage: CustomLlmStage,
    selectionKey: string | null,
  ) => void;
  setCustomLlmDrafts: (
    drafts:
      | CustomLlmDraftsByStage
      | ((prev: CustomLlmDraftsByStage) => CustomLlmDraftsByStage),
  ) => void;
  setFreeProviderDrafts: (
    drafts:
      | FreeProviderDraftMap
      | ((prev: FreeProviderDraftMap) => FreeProviderDraftMap),
  ) => void;
}

export const useLlmProvidersStore = create<LlmProvidersStore>()(
  devtools(
    (set) => ({
      // Same lazy initialization the page's useState had: reads (and clamps)
      // the persisted localStorage settings on first use.
      llmSettings: loadPersistedLlmSettings(),
      customLlmProfiles: [],
      customLlmProfilesLoading: false,
      customLlmProfilesError: null,
      customLlmProfilesMode: 'browser_local',
      customLlmProfilesHydrated: false,
      pendingCustomSelections: {
        translation: null,
        ocr: null,
        clean: null,
      },
      customLlmDrafts: {
        translation: createEmptyCustomLlmDraft(),
        ocr: createEmptyCustomLlmDraft(),
        clean: createEmptyCustomLlmDraft(),
      },
      freeProviderDrafts: buildInitialFreeProviderDrafts(),

      setLlmSettings: (llmSettings) =>
        set((state) => ({
          llmSettings:
            typeof llmSettings === 'function'
              ? llmSettings(state.llmSettings)
              : llmSettings,
        })),
      setCustomLlmProfiles: (profiles) =>
        set((state) => {
          const next =
            typeof profiles === 'function'
              ? profiles(state.customLlmProfiles)
              : profiles;
          const prev = state.customLlmProfiles;
          const sameProfiles =
            next === prev ||
            (Array.isArray(next) &&
              Array.isArray(prev) &&
              next.length === prev.length &&
              next.every(
                (profile, index) =>
                  profile === prev[index] ||
                  JSON.stringify(profile) === JSON.stringify(prev[index]),
              ));
          return sameProfiles
            ? { customLlmProfiles: prev }
            : { customLlmProfiles: next };
        }),
      setCustomLlmProfilesLoading: (customLlmProfilesLoading) =>
        set({ customLlmProfilesLoading }),
      setCustomLlmProfilesError: (customLlmProfilesError) =>
        set({ customLlmProfilesError }),
      setCustomLlmProfilesMode: (mode) =>
        set((state) => ({
          customLlmProfilesMode:
            typeof mode === 'function'
              ? mode(state.customLlmProfilesMode)
              : mode,
        })),
      setCustomLlmProfilesHydrated: (customLlmProfilesHydrated) =>
        set({ customLlmProfilesHydrated }),
      setPendingCustomSelections: (pendingCustomSelections) =>
        set({ pendingCustomSelections }),
      markPendingCustomSelection: (stage, selectionKey) =>
        set((state) => ({
          pendingCustomSelections: {
            ...state.pendingCustomSelections,
            [stage]: selectionKey,
          },
        })),
      setCustomLlmDrafts: (drafts) =>
        set((state) => ({
          customLlmDrafts:
            typeof drafts === 'function' ? drafts(state.customLlmDrafts) : drafts,
        })),
      setFreeProviderDrafts: (drafts) =>
        set((state) => ({
          freeProviderDrafts:
            typeof drafts === 'function'
              ? drafts(state.freeProviderDrafts)
              : drafts,
        })),
    }),
    { name: 'llm-providers-store' },
  ),
);
