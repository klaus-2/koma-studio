import { useEffect } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { clampGlossary, type GlossaryTerm } from '../../../utils/glossary';
import { isRecord } from '../../../utils/guards';

/**
 * User-named work ("obra") registry with its per-work glossary terms and the
 * chapter labels assigned to it. Chapter assignment is by chapter LABEL (the
 * labels carried by loaded images; the implicit direct-images group uses the
 * `DIRECT_IMAGES_CHAPTER_ID` constant) — no separate chapter system.
 */
export interface WorkRecord {
  id: string;
  name: string;
  chapterLabels: string[];
  terms: GlossaryTerm[];
}

export interface WorksStore {
  /* ── Work registry (persisted) ── */
  works: WorkRecord[];

  /** Creates a work from a trimmed non-empty name and returns its id. */
  createWork: (name: string) => string | null;
  renameWork: (workId: string, name: string) => void;
  deleteWork: (workId: string) => void;
  /**
   * Attaches a chapter label to a work (workId) or detaches it from every
   * work (null). A chapter belongs to at most one work, so attaching also
   * removes the label from the other works.
   */
  assignChapterToWork: (chapterLabel: string, workId: string | null) => void;
  setWorkTerms: (workId: string, terms: GlossaryTerm[]) => void;
}

const WORKS_STORAGE_KEY = 'koma-studio.works.v1';

const isBrowser = (): boolean => typeof window !== 'undefined';

/* Mirrors the clampGlossary/clampLlmRequestSettings persistence boundary in
   utils/customLlm.ts: untrusted localStorage JSON is narrowed through
   isRecord before any field is read. */
const sanitizeWorkRecords = (value: unknown): WorkRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: unknown[] = value;
  const records: WorkRecord[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const id = String(entry.id ?? '').trim();
    const name = String(entry.name ?? '').trim();
    if (!id || !name) continue;
    const rawLabels: unknown[] = Array.isArray(entry.chapterLabels)
      ? entry.chapterLabels
      : [];
    const chapterLabels = rawLabels
      .map((label) => String(label ?? '').trim())
      .filter((label) => label.length > 0);
    records.push({
      id,
      name,
      chapterLabels,
      terms: clampGlossary(entry.terms),
    });
  }
  return records;
};

const loadPersistedWorks = (): WorkRecord[] => {
  if (!isBrowser()) {
    return [];
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(window.localStorage.getItem(WORKS_STORAGE_KEY) ?? 'null');
  } catch (error) {
    console.warn('Failed to parse persisted works registry.', error);
    return [];
  }
  return sanitizeWorkRecords(parsed);
};

const persistWorks = (works: WorkRecord[]): void => {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(WORKS_STORAGE_KEY, JSON.stringify(works));
  } catch (error) {
    // Mirrors the load-side guard: a quota-blocked localStorage must not take
    // the sync down — the in-memory registry stays the source of truth.
    console.warn('Failed to persist the works registry.', error);
  }
};

export const useWorksStore = create<WorksStore>()(
  devtools(
    (set) => ({
      // Same lazy initialization the llm-providers store had: reads (and
      // sanitizes) the persisted localStorage registry on first use.
      works: loadPersistedWorks(),

      createWork: (name) => {
        const trimmed = name.trim();
        if (!trimmed) {
          return null;
        }
        const id = crypto.randomUUID();
        set((state) => ({
          works: [
            ...state.works,
            { id, name: trimmed, chapterLabels: [], terms: [] },
          ],
        }));
        return id;
      },
      renameWork: (workId, name) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed) {
            return state;
          }
          return {
            works: state.works.map((work) =>
              work.id === workId ? { ...work, name: trimmed } : work,
            ),
          };
        }),
      deleteWork: (workId) =>
        set((state) => ({
          works: state.works.filter((work) => work.id !== workId),
        })),
      assignChapterToWork: (chapterLabel, workId) =>
        set((state) => {
          const label = chapterLabel.trim();
          if (!label) {
            return state;
          }
          return {
            works: state.works.map((work) => {
              const hasLabel = work.chapterLabels.includes(label);
              const shouldHave = work.id === workId;
              if (hasLabel === shouldHave) {
                return work;
              }
              return {
                ...work,
                chapterLabels: shouldHave
                  ? [...work.chapterLabels, label]
                  : work.chapterLabels.filter(
                      (existing) => existing !== label,
                    ),
              };
            }),
          };
        }),
      setWorkTerms: (workId, terms) =>
        set((state) => ({
          works: state.works.map((work) =>
            work.id === workId ? { ...work, terms } : work,
          ),
        })),
    }),
    { name: 'works-store' },
  ),
);

/**
 * SYNC-EXTERNAL: mirrors the works registry to localStorage on every change.
 * Same subscribe-outside-render wiring as useLlmSettingsPersistence (no persist
 * middleware — the explicit sync stays the source of truth); the identity guard
 * keeps the write frequency to actual works changes.
 */
export function useWorksPersistence(): void {
  useEffect(() => {
    persistWorks(useWorksStore.getState().works);
    return useWorksStore.subscribe((state, prevState) => {
      if (state.works !== prevState.works) {
        persistWorks(state.works);
      }
    });
  }, []);
}
