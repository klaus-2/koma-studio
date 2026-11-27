import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Heart } from 'lucide-react';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import { useModelManagerLiveState } from '../../hooks/useModelManager';
import { useAioPipelineStore } from '../../pages/dashboard/stores/aio-pipeline-store';
import { useStatusStore } from '../../pages/dashboard/stores/status-store';
import { useUiShellStore } from '../../pages/dashboard/stores/ui-shell-store';
import { useKomaMascotStore, type KomaPose } from '../../stores/koma-mascot-store';
import { KomaNekoRig } from './KomaNekoRig';

const IDLE_SLEEP_MS = 90_000;
const EASE = [0.22, 1, 0.36, 1] as const;

interface PetBurst {
  readonly id: number;
  readonly dx: number;
}

export const KomaStudioCompanion: React.FC = React.memo(() => {
  const prefersReducedMotion = useReducedMotion() === true;
  const family = useThemeStore((s) => s.family);
  const isNoir = family === 'noir';

  const visible = useKomaMascotStore((s) => s.companionVisible);
  const toggleVisible = useKomaMascotStore((s) => s.toggleCompanionVisible);
  const reaction = useKomaMascotStore((s) => s.reaction);
  const clearReaction = useKomaMascotStore((s) => s.clearReaction);
  const triggerReaction = useKomaMascotStore((s) => s.triggerReaction);
  const pet = useKomaMascotStore((s) => s.pet);

  const processing = useUiShellStore((s) => s.processing);
  const aioActive = useAioPipelineStore((s) => s.aioExecutionStatus !== null);
  const statusTone = useStatusStore((s) => s.statusMessageTone);
  const { entries } = useModelManagerLiveState();

  const downloadingCount = useMemo(
    () =>
      Object.values(entries).filter(
        (e) => e.status === 'downloading' || e.status === 'verifying' || e.status === 'queued',
      ).length,
    [entries],
  );

  const [hovered, setHovered] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [gaze, setGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [bursts, setBursts] = useState<readonly PetBurst[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevToneRef = useRef(statusTone);
  const prevBusyRef = useRef(false);
  const burstSeqRef = useRef(0);

  useEffect(() => {
    if (!reaction) return;
    const remaining = reaction.expiresAt - Date.now();
    if (remaining <= 0) {
      clearReaction();
      return;
    }
    const timer = window.setTimeout(clearReaction, remaining);
    return () => window.clearTimeout(timer);
  }, [clearReaction, reaction]);

  useEffect(() => {
    const busy = processing || aioActive;
    if (prevBusyRef.current && !busy && statusTone !== 'error') {
      triggerReaction('celebrate', '✦', 2800);
    }
    prevBusyRef.current = busy;
  }, [aioActive, processing, statusTone, triggerReaction]);

  useEffect(() => {
    if (statusTone !== prevToneRef.current) {
      prevToneRef.current = statusTone;
      if (statusTone === 'error') {
        triggerReaction('surprised', '!', 2600);
      } else if (statusTone === 'success') {
        triggerReaction('happy', '♥', 2200);
      }
    }
  }, [statusTone, triggerReaction]);

  useEffect(() => {
    if (!visible || prefersReducedMotion) return;
    let idleTimer: number | null = null;
    let sleepingLocal = false;

    const resetIdle = (): void => {
      if (sleepingLocal) {
        sleepingLocal = false;
        setIsSleeping(false);
        triggerReaction('stretch', null, 2000);
      }
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        sleepingLocal = true;
        setIsSleeping(true);
      }, IDLE_SLEEP_MS);
    };

    resetIdle();
    window.addEventListener('pointerdown', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle, { passive: true });
    return () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [prefersReducedMotion, triggerReaction, visible]);

  useEffect(() => {
    if (!visible || prefersReducedMotion || isSleeping) {
      setGaze({ x: 0, y: 0 });
      return;
    }
    let rafId = 0;
    const onMove = (event: PointerEvent): void => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const nx = Math.max(-1, Math.min(1, (event.clientX - cx) / 360));
        const ny = Math.max(-1, Math.min(1, (event.clientY - cy) / 280));
        setGaze({ x: nx, y: ny });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
    };
  }, [isSleeping, prefersReducedMotion, visible]);

  const activePose: KomaPose = useMemo(() => {
    if (reaction) return reaction.pose;
    if (processing || aioActive) return 'casting';
    if (downloadingCount > 0) return 'working';
    if (isSleeping) return 'sleep';
    if (hovered) return 'curious';
    return 'idle';
  }, [aioActive, downloadingCount, hovered, isSleeping, processing, reaction]);

  const handlePet = useCallback(() => {
    if (isSleeping) {
      setIsSleeping(false);
    }
    const { isEasterEgg } = pet();
    const count = isEasterEgg ? 3 : 1;
    const created: PetBurst[] = Array.from({ length: count }, (_, idx) => {
      burstSeqRef.current += 1;
      return {
        id: burstSeqRef.current,
        dx: (idx - (count - 1) / 2) * 18 + (Math.random() * 10 - 5),
      };
    });
    setBursts((prev) => [...prev.slice(-6), ...created]);
    window.setTimeout(() => {
      const ids = new Set(created.map((b) => b.id));
      setBursts((prev) => prev.filter((b) => !ids.has(b.id)));
    }, 950);
  }, [isSleeping, pet]);

  if (!visible) {
    return (
      <div className="pointer-events-none absolute bottom-11 right-4 z-40">
        <button
          type="button"
          onClick={toggleVisible}
          aria-label="Show Koma Neeko companion"
          title="Koma Neeko"
          className={
            isNoir
              ? 'pointer-events-auto panel-cut-sm hard-hover flex h-8 items-center gap-1.5 border border-paper/15 bg-ink-2/90 px-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-paper/70 backdrop-blur-md hover:border-crimson hover:text-paper'
              : 'pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border border-purple-500/25 bg-[#0a0c18]/90 px-2.5 text-[10px] font-semibold text-slate-300 shadow-lg backdrop-blur-md transition hover:border-purple-400/60 hover:text-white'
          }
        >
          <Eye size={12} />
          <span>KOMA</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute bottom-11 right-4 z-40 flex flex-col items-end"
      data-testid="koma-studio-companion"
    >

      <div className="relative h-6 w-full">
        <AnimatePresence>
          {reaction?.note && (
            <m.span
              key={`note-${reaction.expiresAt}`}
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9 }}
              transition={{ duration: 0.22, ease: EASE }}
              className={
                isNoir
                  ? 'panel-cut-sm absolute bottom-0 right-2 border border-crimson/50 bg-ink-2/95 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-gold shadow-md'
                  : 'absolute bottom-0 right-2 rounded-full border border-purple-400/40 bg-[#0d1124]/95 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 shadow-md'
              }
            >
              {reaction.note}
            </m.span>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {bursts.map((burst) => (
            <m.span
              key={burst.id}
              aria-hidden
              initial={{ opacity: 0.95, y: 8, x: burst.dx, scale: 0.7 }}
              animate={{ opacity: 0, y: -26, x: burst.dx * 1.4, scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              className="pointer-events-none absolute bottom-0 right-9 text-[#ff2e7a] drop-shadow-[0_0_6px_rgba(255,46,122,0.85)]"
            >
              <Heart size={12} fill="currentColor" />
            </m.span>
          ))}
        </AnimatePresence>
      </div>

      <div
        className="group pointer-events-auto relative flex items-end"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          onClick={toggleVisible}
          aria-label="Hide Koma Neeko companion"
          className={
            isNoir
              ? 'panel-cut-sm absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center border border-paper/20 bg-ink-2/95 text-paper/60 opacity-0 transition-opacity hover:border-crimson hover:text-crimson focus-visible:opacity-100 group-hover:opacity-100'
              : 'absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-[#0d1124]/95 text-slate-400 opacity-0 transition-opacity hover:border-purple-400 hover:text-white focus-visible:opacity-100 group-hover:opacity-100'
          }
        >
          <EyeOff size={10} />
        </button>

        <m.button
          type="button"
          onClick={handlePet}
          aria-label="Pet Koma Neeko"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.07, y: -2 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 360, damping: 20 }}
          className="relative flex h-[74px] w-[74px] cursor-pointer items-center justify-center rounded-full bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson"
        >
          <KomaNekoRig
            pose={activePose}
            size={74}
            gazeX={gaze.x}
            gazeY={gaze.y}
          />
        </m.button>
      </div>
    </div>
  );
});

KomaStudioCompanion.displayName = 'KomaStudioCompanion';
export default KomaStudioCompanion;
