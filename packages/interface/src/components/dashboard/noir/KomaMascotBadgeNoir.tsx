import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { KOMA_CAT_FRAMES } from '../../../assets/koma-cat';

/** How often the badge picks a new random pose on its own. */
const AUTO_SWAP_MS = 60_000;

function pickNextIndex(current: number): number {
  const total = KOMA_CAT_FRAMES.length;
  if (total < 2) {
    return current;
  }
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * total);
  }
  return next;
}

/**
 * Brand mascot badge.
 *
 * Shows one of the 16 KOMA cat poses. The pose changes at random once a
 * minute, and again on every mouse pass over the badge, so the badge always
 * answers the pointer with a fresh pose.
 */
export function KomaMascotBadgeNoir() {
  const [frame, setFrame] = useState(0);
  const shouldReduceMotion = useReducedMotion() === true;

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setFrame((current) => pickNextIndex(current));
    }, AUTO_SWAP_MS);
    return () => window.clearInterval(timer);
  }, [shouldReduceMotion]);

  const handlePointerEnter = useCallback(() => {
    setFrame((current) => pickNextIndex(current));
  }, []);

  return (
    <motion.img
      key={frame}
      src={KOMA_CAT_FRAMES[frame]}
      alt=""
      aria-hidden
      draggable={false}
      onPointerEnter={handlePointerEnter}
      className="size-9 shrink-0 -rotate-3 border border-crimson/45 bg-crimson object-cover shadow-[2px_2px_0_var(--color-gold)]"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
      whileHover={{ rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 18 } }}
    />
  );
}

export default KomaMascotBadgeNoir;
