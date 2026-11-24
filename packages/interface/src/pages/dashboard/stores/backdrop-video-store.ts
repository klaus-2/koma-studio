import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const BACKDROP_VIDEO_STORAGE_KEY = 'koma_backdrop_video.v1';
const BACKDROP_VIDEO_STORAGE_VERSION = 1;
const DEFAULT_ALWAYS_PAUSED = false;

interface BackdropVideoPersisted {
  alwaysPaused: boolean;
}

interface BackdropVideoStore extends BackdropVideoPersisted {
  setAlwaysPaused: (alwaysPaused: boolean) => void;
}

const sanitizeBackdropVideoState = (value: unknown): BackdropVideoPersisted => {
  if (typeof value !== 'object' || value === null) {
    return { alwaysPaused: DEFAULT_ALWAYS_PAUSED };
  }
  const record = value as Record<string, unknown>;
  return {
    alwaysPaused:
      typeof record.alwaysPaused === 'boolean' ? record.alwaysPaused : DEFAULT_ALWAYS_PAUSED,
  };
};

export const useBackdropVideoStore = create<BackdropVideoStore>()(
  devtools(
    persist(
      (set) => ({
        alwaysPaused: DEFAULT_ALWAYS_PAUSED,
        setAlwaysPaused: (alwaysPaused) => set({ alwaysPaused }),
      }),
      {
        name: BACKDROP_VIDEO_STORAGE_KEY,
        version: BACKDROP_VIDEO_STORAGE_VERSION,
        migrate: (persisted) => sanitizeBackdropVideoState(persisted),
        merge: (persisted, current) => ({
          ...current,
          ...sanitizeBackdropVideoState(persisted),
        }),
      },
    ),
    { name: 'backdrop-video-store' },
  ),
);
