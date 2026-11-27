// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LazyMotion, domMax } from 'framer-motion';

import { KomaNekoRig } from './KomaNekoRig';
import { KomaNekoActor } from './KomaNekoActor';
import { useKomaMascotStore, type KomaPose } from '../../stores/koma-mascot-store';

const ALL_POSES: readonly KomaPose[] = [
  'idle',
  'wink',
  'happy',
  'curious',
  'wave',
  'peek',
  'sleep',
  'stretch',
  'surprised',
  'back',
  'casting',
  'celebrate',
  'working',
];

afterEach(() => {
  cleanup();
  useKomaMascotStore.setState({
    companionVisible: true,
    petStreak: 0,
    lastPetAt: 0,
    reaction: null,
  });
});

describe('KomaNekoRig & Mascot Store', () => {
  it('renders a valid 256x256 vector rig for all 13 official Koma Neeko poses', () => {
    for (const pose of ALL_POSES) {
      const { container, unmount } = render(
        <LazyMotion features={domMax} strict>
          <KomaNekoRig pose={pose} label={`Koma ${pose}`} />
        </LazyMotion>,
      );
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 256 256');
      expect(container.querySelector(`[data-koma-pose="${pose}"]`)).not.toBeNull();
      unmount();
    }
  });

  it('falls back cleanly to the vector rig in jsdom via KomaNekoActor', () => {
    const { container } = render(
      <LazyMotion features={domMax} strict>
        <KomaNekoActor pose="wave" mode="video" size={96} label="Koma Wave" />
      </LazyMotion>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-koma-pose="wave"]')).not.toBeNull();
  });

  it('triggers pet streak and 5-click Easter egg celebration in mascot store', () => {
    for (let i = 1; i <= 4; i += 1) {
      const res = useKomaMascotStore.getState().pet();
      expect(res.isEasterEgg).toBe(false);
    }
    const fifth = useKomaMascotStore.getState().pet();
    expect(fifth.isEasterEgg).toBe(true);
    expect(useKomaMascotStore.getState().reaction?.pose).toBe('celebrate');
  });

  it('respects gaze clamping without throwing on extreme pointer coordinates', () => {
    const { container } = render(
      <LazyMotion features={domMax} strict>
        <KomaNekoRig pose="idle" gazeX={99} gazeY={-99} />
      </LazyMotion>,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    if (svg) {
      fireEvent.click(svg);
    }
  });
});
