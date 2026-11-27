import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type KomaPose =
  | 'idle'
  | 'wink'
  | 'happy'
  | 'curious'
  | 'wave'
  | 'peek'
  | 'sleep'
  | 'stretch'
  | 'surprised'
  | 'back'
  | 'casting'
  | 'celebrate'
  | 'working';

export interface KomaMascotReaction {
  readonly pose: KomaPose;
  readonly note: string | null;
  readonly expiresAt: number;
}

interface KomaMascotStore {
  companionVisible: boolean;
  petStreak: number;
  lastPetAt: number;
  reaction: KomaMascotReaction | null;
  setCompanionVisible: (visible: boolean) => void;
  toggleCompanionVisible: () => void;
  triggerReaction: (pose: KomaPose, note?: string | null, durationMs?: number) => void;
  clearReaction: () => void;
  pet: () => { isEasterEgg: boolean; streak: number };
}

const PET_STREAK_WINDOW_MS = 3200;
const EASTER_EGG_THRESHOLD = 5;

const EASTER_EGG_NOTES = ['ニャ〜 ♪', 'Purr~ ♥', '✦ KŌMA! ✦'] as const;

export const useKomaMascotStore = create<KomaMascotStore>()(
  persist(
    (set, get) => ({
      companionVisible: true,
      petStreak: 0,
      lastPetAt: 0,
      reaction: null,

      setCompanionVisible: (visible) => set({ companionVisible: visible }),
      toggleCompanionVisible: () =>
        set((state) => ({ companionVisible: !state.companionVisible })),

      triggerReaction: (pose, note = null, durationMs = 2600) =>
        set({
          reaction: {
            pose,
            note,
            expiresAt: Date.now() + durationMs,
          },
        }),

      clearReaction: () => set({ reaction: null }),

      pet: () => {
        const now = Date.now();
        const prev = get();
        const withinWindow = now - prev.lastPetAt <= PET_STREAK_WINDOW_MS;
        const nextStreak = withinWindow ? prev.petStreak + 1 : 1;
        const isEasterEgg = nextStreak >= EASTER_EGG_THRESHOLD;
        const pose: KomaPose = isEasterEgg
          ? 'celebrate'
          : nextStreak === 3
            ? 'wink'
            : 'happy';
        const note = isEasterEgg
          ? EASTER_EGG_NOTES[nextStreak % EASTER_EGG_NOTES.length] ?? 'Purr~ ♥'
          : nextStreak >= 2
            ? '♥'
            : null;
        set({
          petStreak: isEasterEgg ? 0 : nextStreak,
          lastPetAt: now,
          reaction: {
            pose,
            note,
            expiresAt: now + (isEasterEgg ? 3200 : 1800),
          },
        });
        return { isEasterEgg, streak: nextStreak };
      },
    }),
    {
      name: 'koma-studio.mascot.v1',
      partialize: (state) => ({ companionVisible: state.companionVisible }),
    },
  ),
);
