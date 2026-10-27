'use client';

import {
  Boxes,
  ChevronRight,
  Database,
  Layers3,
} from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';

import {
  RESOURCE_CATEGORIES,
} from '@/data/resources-data';
import { useI18n } from '@/i18n';
import { useInfoNavStore } from '@/stores/info-nav-store';

import {
  ResourceMetric,
  ResourceNexusHero,
  RESOURCE_TONE,
  resolveResourceTone,
} from './ResourceV2Primitives';
import {
  RESOURCE_EASE,
} from './resource-v2-utils';

export default function ResourcesHomeV2() {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const navigateToCategory =
    useInfoNavStore(
      (state) =>
        state.navigateToResourceCategory,
    );

  const totalItems =
    RESOURCE_CATEGORIES.reduce(
      (sum, category) =>
        sum + category.itemCount,
      0,
    );

  return (
    <div
      className="manga-grid-bg min-h-full bg-ink p-3 text-paper sm:p-5 lg:p-7"
    >
      <div className="mx-auto max-w-[1500px] space-y-7">
        <ResourceNexusHero
          index="07"
          kicker="Scanlation resource index"
          title={t(
            'resources.home.title',
          )}
          accent="nexus"
          description={t(
            'resources.home.subtitle',
          )}
          icon={Boxes}
          metrics={
            <>
              <ResourceMetric
                icon={Layers3}
                value={
                  RESOURCE_CATEGORIES.length
                }
                label="Archives"
                tone="crimson"
              />

              <ResourceMetric
                icon={Database}
                value={totalItems}
                label="Entries"
                tone="azure"
              />

              <ResourceMetric
                icon={Boxes}
                value="V2"
                label="Edition"
                tone="gold"
              />
            </>
          }
        />

        <m.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren:
                  reduceMotion
                    ? 0
                    : 0.07,
              },
            },
          }}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {RESOURCE_CATEGORIES.map(
            (category, index) => {
              const Icon =
                category.icon;

              const tone =
                resolveResourceTone(
                  category.accentColor,
                );

              const styles =
                RESOURCE_TONE[tone];

              const labelKey = `resources.category.${category.id}.label`;
              const descriptionKey = `resources.category.${category.id}.description`;

              const translatedLabel = t(
                labelKey as any,
              );

              const translatedDescription =
                t(
                  descriptionKey as any,
                );

              const label =
                translatedLabel ===
                labelKey
                  ? t(
                      category.label as any,
                    )
                  : translatedLabel;

              const description =
                translatedDescription ===
                descriptionKey
                  ? t(
                      category.description as any,
                    )
                  : translatedDescription;

              return (
                <m.button
                  key={category.id}
                  type="button"
                  variants={{
                    hidden: {
                      opacity: 0,
                      y: 18,
                    },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration:
                          reduceMotion
                            ? 0
                            : 0.45,
                        ease: RESOURCE_EASE,
                      },
                    },
                  }}
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          x: -3,
                          y: -3,
                        }
                  }
                  className={[
                    'glass panel-cut-sm relative min-h-64 overflow-hidden border p-5 text-left',
                    styles.border,
                    styles.shadow,
                  ].join(' ')}
                  onClick={() =>
                    navigateToCategory(
                      category.id,
                    )
                  }
                >
                  <div
                    className={[
                      tone ===
                      'crimson'
                        ? 'halftone-red'
                        : 'halftone',
                      'pointer-events-none absolute -right-12 -top-12 size-44 opacity-30',
                    ].join(' ')}
                    aria-hidden="true"
                  />

                  <span
                    className="text-outline pointer-events-none absolute right-4 top-0 font-display text-7xl font-black leading-none"
                    aria-hidden="true"
                  >
                    {String(
                      index + 1,
                    ).padStart(2, '0')}
                  </span>

                  <span
                    className={[
                      'relative z-10 grid size-12 place-items-center border panel-cut-sm',
                      styles.border,
                      styles.background,
                      styles.text,
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <Icon size={20} />
                  </span>

                  <h2 className="relative z-10 mt-7 max-w-xs pr-10 font-display text-xl font-black uppercase leading-none tracking-[-0.045em] text-paper">
                    {label}
                  </h2>

                  <p className="relative z-10 mt-3 line-clamp-3 text-xs leading-5 text-paper/40">
                    {description}
                  </p>

                  <footer className="absolute inset-x-5 bottom-5 z-10 flex items-center justify-between border-t border-paper/[0.065] pt-4">
                    <span className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-paper/32">
                      {t(
                        'resources.home.itemCount',
                        {
                          count:
                            category.itemCount,
                        },
                      )}
                    </span>

                    <ChevronRight
                      size={16}
                      className={
                        styles.text
                      }
                    />
                  </footer>
                </m.button>
              );
            },
          )}
        </m.div>
      </div>
    </div>
  );
}
