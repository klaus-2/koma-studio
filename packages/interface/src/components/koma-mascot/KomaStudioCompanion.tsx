import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Heart } from 'lucide-react';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import { useModelManagerLiveState } from '../../hooks/useModelManager';
import { useAioPipelineStore } from '../../pages/dashboard/stores/aio-pipeline-store';
import { useStatusStore } from '../../pages/dashboard/stores/status-store';
import { useUiShellStore } from '../../pages/dashboard/stores/ui-shell-store';
import {
  useKomaMascotStore,
  type KomaCompanionPosition,
  type KomaPose,
} from '../../stores/koma-mascot-store';
import { KomaNekoRig } from './KomaNekoRig';

const IDLE_SLEEP_MS = 90_000;
const EASE = [0.22, 1, 0.36, 1] as const;
const FALLBACK_POSITION: KomaCompanionPosition = { right: 16, bottom: 44 };
const ANCHOR_CLASS = 'pointer-events-none absolute bottom-11 right-4 h-0 w-0';
const DRAG_THRESHOLD_PX = 4;
const KEY_STEP_PX = 16;
const LAYER_CLASS = 'pointer-events-none fixed z-[1200]';

interface PetBurst {
  readonly id: number;
  readonly dx: number;
}

interface DragSession {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly origin: KomaCompanionPosition;
  moved: boolean;
  last: KomaCompanionPosition;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampPosition = (
  position: KomaCompanionPosition,
  element: HTMLElement | null,
): KomaCompanionPosition => {
  const width = element?.offsetWidth ?? 0;
  const height = element?.offsetHeight ?? 0;
  return {
    right: Math.round(clamp(position.right, 0, Math.max(0, window.innerWidth - width))),
    bottom: Math.round(clamp(position.bottom, 0, Math.max(0, window.innerHeight - height))),
  };
};

const samePosition = (a: KomaCompanionPosition, b: KomaCompanionPosition): boolean =>
  a.right === b.right && a.bottom === b.bottom;

export const KomaStudioCompanion: React.FC = React.memo(() => {
  const prefersReducedMotion = useReducedMotion() === true;
  const family = useThemeStore((s) => s.family);
  const isNoir = family === 'noir';

  const visible = useKomaMascotStore((s) => s.companionVisible);
  const toggleVisible = useKomaMascotStore((s) => s.toggleCompanionVisible);
  const storedPosition = useKomaMascotStore((s) => s.companionPosition);
  const setStoredPosition = useKomaMascotStore((s) => s.setCompanionPosition);
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
  const [livePosition, setLivePosition] = useState<KomaCompanionPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevToneRef = useRef(statusTone);
  const prevBusyRef = useRef(false);
  const burstSeqRef = useRef(0);
  const dragRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchorPosition, setAnchorPosition] = useState<KomaCompanionPosition | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const measure = (): void => {
      const rect = anchor.getBoundingClientRect();
      const next: KomaCompanionPosition = {
        right: Math.round(window.innerWidth - rect.right),
        bottom: Math.round(window.innerHeight - rect.bottom),
      };
      setAnchorPosition((prev) => (prev && samePosition(prev, next) ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (anchor.parentElement) observer.observe(anchor.parentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const position = livePosition ?? storedPosition ?? anchorPosition ?? FALLBACK_POSITION;

  useEffect(() => {
    if (!storedPosition) return;
    const reclamp = (): void => {
      const next = clampPosition(storedPosition, containerRef.current);
      if (!samePosition(next, storedPosition)) setStoredPosition(next);
    };
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [setStoredPosition, storedPosition, visible]);

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

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      suppressClickRef.current = false;
      if (event.button !== 0) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: position,
        moved: false,
        last: position,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      setIsDragging(true);
    }
    drag.last = clampPosition(
      { right: drag.origin.right - dx, bottom: drag.origin.bottom - dy },
      containerRef.current,
    );
    setLivePosition(drag.last);
  }, []);

  const finishDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!drag.moved) return;
      suppressClickRef.current = true;
      setStoredPosition(drag.last);
      setLivePosition(null);
      setIsDragging(false);
    },
    [setStoredPosition],
  );

  const handleClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    handlePet();
  }, [handlePet]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const step = event.shiftKey ? KEY_STEP_PX * 4 : KEY_STEP_PX;
      const delta: Record<string, readonly [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const move = delta[event.key];
      if (!move) return;
      event.preventDefault();
      setStoredPosition(
        clampPosition(
          { right: position.right + move[0], bottom: position.bottom + move[1] },
          containerRef.current,
        ),
      );
    },
    [position, setStoredPosition],
  );

  const layerStyle: React.CSSProperties = { right: position.right, bottom: position.bottom };

  const anchor = <div ref={anchorRef} aria-hidden className={ANCHOR_CLASS} />;

  if (!visible) {
    return (
      <>
        {anchor}
        {createPortal(
      <div className={LAYER_CLASS} style={layerStyle}>
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
      </div>,
      document.body,
        )}
      </>
    );
  }

  return (
    <>
      {anchor}
      {createPortal(
    <div
      ref={containerRef}
      className={`${LAYER_CLASS} flex flex-col items-end`}
      style={layerStyle}
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
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={handleKeyDown}
          aria-label="Pet Koma Neeko"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          title="Click to pet · drag to move"
          whileHover={prefersReducedMotion || isDragging ? undefined : { scale: 1.07, y: -2 }}
          whileTap={prefersReducedMotion || isDragging ? undefined : { scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 360, damping: 20 }}
          className={`relative flex h-[74px] w-[74px] touch-none select-none items-center justify-center rounded-full bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <KomaNekoRig
            pose={activePose}
            size={74}
            gazeX={gaze.x}
            gazeY={gaze.y}
          />
        </m.button>
      </div>
    </div>,
    document.body,
      )}
    </>
  );
});

KomaStudioCompanion.displayName = 'KomaStudioCompanion';
export default KomaStudioCompanion;
