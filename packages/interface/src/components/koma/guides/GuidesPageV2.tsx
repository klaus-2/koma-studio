'use client';

import { m, AnimatePresence, useReducedMotion } from 'framer-motion';

import { useInfoNavStore } from '@/stores/info-nav-store';

import GuideReaderV2 from './GuideReaderV2';
import GuidesCategoryViewV2 from './GuidesCategoryViewV2';
import GuidesHomeV2 from './GuidesHomeV2';
import {
  GUIDE_EASE,
} from './GuideV2Primitives';

export default function GuidesPageV2() {
  const reduceMotion =
    useReducedMotion();

  const view = useInfoNavStore(
    (state) => state.guidesView,
  );

  const category = useInfoNavStore(
    (state) => state.guidesCategory,
  );

  const entryId = useInfoNavStore(
    (state) => state.guidesEntryId,
  );

  const viewKey =
    view === 'reader'
      ? `reader-${category}-${entryId}`
      : view === 'category'
        ? `category-${category}`
        : 'home';

  return (
    <div className="manga-grid-bg min-h-full bg-ink p-3 text-paper sm:p-5 lg:p-7">
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        <m.div
          key={viewKey}
          initial={
            reduceMotion
              ? false
              : {
                opacity: 0,
                y: 14,
                clipPath:
                  'inset(0 0 5% 0)',
              }
          }
          animate={{
            opacity: 1,
            y: 0,
            clipPath:
              'inset(0 0 0% 0)',
          }}
          exit={{
            opacity: 0,
            y: -10,
          }}
          transition={{
            duration: reduceMotion
              ? 0
              : 0.42,
            ease: GUIDE_EASE,
          }}
        >
          {view === 'reader' &&
            category &&
            entryId ? (
            <GuideReaderV2
              categoryId={category}
              entryId={entryId}
            />
          ) : view === 'category' &&
            category ? (
            <GuidesCategoryViewV2
              categoryId={category}
            />
          ) : (
            <GuidesHomeV2 />
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
