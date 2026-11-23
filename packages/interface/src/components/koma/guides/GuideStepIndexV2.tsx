'use client';

import {
  Check,
  ChevronLeft,
  FileText,
} from 'lucide-react';

import type {
  GuideCategoryId,
  GuideEntry,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';

export interface GuideFlatStep {
  step: GuideEntry['sections'][number]['steps'][number];
  sectionIdx: number;
  stepIdx: number;
  sectionId: string;
  sectionTitle: string;
}

export interface GuideRecentEntry {
  id: string;
  title: string;
  category: GuideCategoryId;
}

interface Props {
  guide: GuideEntry;
  categoryLabel: string;
  flatSteps: GuideFlatStep[];
  currentFlatIndex: number;
  totalSteps: number;
  progress: number;
  toneStyles: {
    border: string;
    background: string;
    solid: string;
    shadow: string;
  };
  recentGuides: GuideRecentEntry[];
  onNavigateCategory: (
    categoryId: GuideCategoryId,
  ) => void;
  onNavigateEntry: (
    categoryId: GuideCategoryId,
    entryId: string,
  ) => void;
  onSelectStep: (flatIndex: number) => void;
}

export default function GuideStepIndexV2({
  guide,
  categoryLabel,
  flatSteps,
  currentFlatIndex,
  totalSteps,
  progress,
  toneStyles,
  recentGuides,
  onNavigateCategory,
  onNavigateEntry,
  onSelectStep,
}: Props) {
  const { t } = useI18n();

  return (
    <aside
      className="glass panel-cut koma-scrollbar max-h-[72vh] overflow-y-auto lg:sticky lg:top-5 lg:max-h-[calc(100dvh-2.5rem)]"
      aria-label={t(
        'guides.detail.stepsAria',
      )}
    >
      <header className="sticky top-0 z-10 border-b border-paper/10 bg-ink-2/92 p-4 backdrop-blur-xl">
        <button
          type="button"
          className="panel-cut-sm inline-flex items-center gap-2 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-paper/38 transition hover:bg-paper/[0.04] hover:text-crimson"
          onClick={() =>
            onNavigateCategory(
              guide.category,
            )
          }
        >
          <ChevronLeft size={13} />

          {categoryLabel}
        </button>

        <h2 className="mt-4 font-display text-lg font-black uppercase leading-[0.95] tracking-[-0.04em] text-paper">
          {guide.title}
        </h2>

        <div className="mt-4 flex items-center gap-2">
          <span className="stamp">
            {currentFlatIndex + 1}/
            {totalSteps}
          </span>

          <span className="font-mono text-[0.56rem] uppercase tracking-[0.08em] text-paper/28">
            {Math.round(progress)}%
          </span>
        </div>
      </header>

      <nav className="space-y-5 p-3">
        {guide.sections.map(
          (
            section,
            sectionIdx,
          ) => (
            <div key={section.id}>
              <p className="mb-2 px-2 font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] text-paper/24">
                {String(
                  sectionIdx + 1,
                ).padStart(2, '0')}{' '}
                / {section.title}
              </p>

              <div className="space-y-1">
                {section.steps.map(
                  (
                    step,
                    stepIdx,
                  ) => {
                    const flatIndex =
                      flatSteps.findIndex(
                        (item) =>
                          item.sectionIdx ===
                            sectionIdx &&
                          item.stepIdx ===
                            stepIdx,
                      );

                    const active =
                      flatIndex ===
                      currentFlatIndex;

                    const done =
                      flatIndex <
                      currentFlatIndex;

                    return (
                      <button
                        key={step.id}
                        type="button"
                        aria-current={
                          active
                            ? 'step'
                            : undefined
                        }
                        className={[
                          'panel-cut-sm flex w-full items-center gap-3 border px-3 py-2.5 text-left transition',
                          active
                            ? `${toneStyles.border} ${toneStyles.background} ${toneStyles.shadow}`
                            : done
                              ? 'border-mint/15 bg-mint/[0.025]'
                              : 'border-transparent hover:border-paper/10 hover:bg-paper/[0.025]',
                        ].join(' ')}
                        onClick={() =>
                          onSelectStep(flatIndex)
                        }
                      >
                        <span
                          className={[
                            'grid size-6 shrink-0 place-items-center border font-mono text-[0.58rem] font-bold panel-cut-sm',
                            active
                              ? `${toneStyles.border} ${toneStyles.solid} text-ink`
                              : done
                                ? 'border-mint bg-mint text-ink'
                                : 'border-paper/12 bg-ink text-paper/35',
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          {done ? (
                            <Check size={12} />
                          ) : (
                            flatIndex + 1
                          )}
                        </span>

                        <span
                          className={[
                            'line-clamp-2 text-xs leading-4',
                            active
                              ? 'font-semibold text-paper'
                              : done
                                ? 'text-paper/38'
                                : 'text-paper/46',
                          ].join(' ')}
                        >
                          {step.title ??
                            t(
                              'guides.detail.stepLabel',
                              {
                                index:
                                  flatIndex + 1,
                              },
                            )}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          ),
        )}
      </nav>

      {recentGuides.length > 0 ? (
        <div className="border-t border-paper/10 p-3">
          <p className="mb-2 px-2 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-paper/24">
            {t(
              'guides.detail.recent',
            )}
          </p>

          <div className="space-y-1">
            {recentGuides.map(
              (recent) => (
                <button
                  key={recent.id}
                  type="button"
                  className="panel-cut-sm flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-paper/35 transition hover:bg-paper/[0.035] hover:text-paper"
                  onClick={() =>
                    onNavigateEntry(
                      recent.category,
                      recent.id,
                    )
                  }
                >
                  <FileText
                    size={12}
                    className="shrink-0 text-crimson"
                  />

                  <span className="line-clamp-1">
                    {recent.title}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
