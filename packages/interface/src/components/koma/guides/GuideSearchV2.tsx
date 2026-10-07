'use client';

import {
  Clock,
  FileText,
  Search,
  X,
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import {
  GUIDE_CATEGORIES,
  GUIDES,
} from '@/data/guides-data';
import type { GuideCategoryId } from '@/data/guides-types';
import { useI18n } from '@/i18n';

import {
  GUIDE_EASE,
  getGuideTone,
  GUIDE_TONE_STYLES,
} from './GuideV2Primitives';
import { useGuideStoreCompat } from './guide-store-compat';

interface Props {
  onClose: () => void;
}

interface SearchResult {
  guideId: string;
  title: string;
  subtitle: string;
  category: GuideCategoryId;
  categoryLabel: string;
  estimatedTime: string;
  matchedText?: string;
  icon: (typeof GUIDES)[number]['icon'];
  accentColor?: string;
}

function buildExcerpt(
  content: string,
  query: string,
): string | undefined {
  const normalized =
    content.toLowerCase();

  const index =
    normalized.indexOf(query);

  if (index < 0) return undefined;

  const start = Math.max(
    0,
    index - 38,
  );

  const end = Math.min(
    content.length,
    index + query.length + 55,
  );

  return `${start > 0 ? '…' : ''
    }${content.slice(start, end)}${end < content.length ? '…' : ''
    }`;
}

export default function GuideSearchV2({
  onClose,
}: Props) {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const {
    navigateToGuideEntry,
    recentlyViewed,
  } = useGuideStoreCompat();

  const [mounted, setMounted] =
    useState(false);

  const [query, setQuery] =
    useState('');

  const [selectedIdx, setSelectedIdx] =
    useState(0);

  const inputRef =
    useRef<HTMLInputElement>(null);

  const modalRef =
    useRef<HTMLDivElement>(null);

  const resultRefs =
    useRef<
      Array<HTMLButtonElement | null>
    >([]);

  useEffect(() => {
    setMounted(true);

    const previousFocus =
      document.activeElement as HTMLElement | null;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow =
        previousOverflow;

      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      handleEscape,
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handleEscape,
      );
  }, [onClose]);

  const results =
    useMemo<SearchResult[]>(() => {
      const normalizedQuery =
        query.trim().toLowerCase();

      if (!normalizedQuery) {
        return recentlyViewed
          .map((id) =>
            GUIDES.find(
              (guide) =>
                guide.id === id,
            ),
          )
          .filter(
            (
              guide,
            ): guide is (typeof GUIDES)[number] =>
              Boolean(guide),
          )
          .slice(0, 8)
          .map((guide) => {
            const category =
              GUIDE_CATEGORIES.find(
                (candidate) =>
                  candidate.id ===
                  guide.category,
              );

            return {
              guideId: guide.id,
              title: guide.title,
              subtitle: guide.subtitle,
              category:
                guide.category,
              categoryLabel:
                category?.label ??
                String(guide.category),
              estimatedTime:
                guide.estimatedTime,
              icon: guide.icon,
              accentColor:
                guide.accentColor,
            };
          });
      }

      return GUIDES.flatMap(
        (guide) => {
          const directMatch =
            guide.title
              .toLowerCase()
              .includes(
                normalizedQuery,
              ) ||
            guide.subtitle
              .toLowerCase()
              .includes(
                normalizedQuery,
              ) ||
            guide.tags.some((tag) =>
              tag
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ),
            );

          let matchedText:
            | string
            | undefined;

          if (!directMatch) {
            for (const section of guide.sections) {
              for (const step of section.steps) {
                const searchable = [
                  step.title ?? '',
                  step.content ?? '',
                  step.tip ?? '',
                  step.warning ?? '',
                ].join(' ');

                matchedText =
                  buildExcerpt(
                    searchable,
                    normalizedQuery,
                  );

                if (matchedText) break;
              }

              if (matchedText) break;
            }
          }

          if (!directMatch && !matchedText) {
            return [];
          }

          const category =
            GUIDE_CATEGORIES.find(
              (candidate) =>
                candidate.id ===
                guide.category,
            );

          return [
            {
              guideId: guide.id,
              title: guide.title,
              subtitle: guide.subtitle,
              category:
                guide.category,
              categoryLabel:
                category?.label ??
                String(guide.category),
              estimatedTime:
                guide.estimatedTime,
              matchedText,
              icon: guide.icon,
              accentColor:
                guide.accentColor,
            },
          ];
        },
      ).slice(0, 10);
    }, [query, recentlyViewed]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (
      results.length > 0 &&
      selectedIdx >= results.length
    ) {
      setSelectedIdx(
        results.length - 1,
      );
    }
  }, [results.length, selectedIdx]);

  useEffect(() => {
    resultRefs.current[
      selectedIdx
    ]?.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion
        ? 'auto'
        : 'smooth',
    });
  }, [reduceMotion, selectedIdx]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      navigateToGuideEntry(
        result.category,
        result.guideId,
      );

      onClose();
    },
    [
      navigateToGuideEntry,
      onClose,
    ],
  );

  const handleInputKeyDown =
    useCallback(
      (
        event: ReactKeyboardEvent<HTMLInputElement>,
      ) => {
        if (
          event.key ===
          'ArrowDown'
        ) {
          event.preventDefault();

          if (results.length === 0) {
            return;
          }

          setSelectedIdx(
            (current) =>
              (current + 1) %
              results.length,
          );
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();

          if (results.length === 0) {
            return;
          }

          setSelectedIdx(
            (current) =>
              (current -
                1 +
                results.length) %
              results.length,
          );
        }

        if (
          event.key === 'Enter' &&
          results[selectedIdx]
        ) {
          event.preventDefault();

          selectResult(
            results[selectedIdx],
          );
        }
      },
      [
        results,
        selectResult,
        selectedIdx,
      ],
    );

  const handleModalKeyDown =
    useCallback(
      (
        event: ReactKeyboardEvent<HTMLDivElement>,
      ) => {
        if (
          event.key !== 'Tab' ||
          !modalRef.current
        ) {
          return;
        }

        const focusable =
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          );

        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last =
          focusable[
          focusable.length - 1
          ];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first?.focus();
        }
      },
      [],
    );

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={
        reduceMotion
          ? false
          : { opacity: 0 }
      }
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-ink/82 px-4 py-[8vh] backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <motion.div
        ref={modalRef}
        initial={
          reduceMotion
            ? false
            : {
              opacity: 0,
              y: 28,
              scale: 0.965,
              clipPath:
                'inset(0 0 100% 0)',
            }
        }
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          clipPath:
            'inset(0 0 0% 0)',
        }}
        exit={{
          opacity: 0,
          y: 16,
          scale: 0.98,
        }}
        transition={{
          duration: reduceMotion
            ? 0
            : 0.48,
          ease: GUIDE_EASE,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-search-title"
        onKeyDown={
          handleModalKeyDown
        }
        className="glass panel-cut relative w-full max-w-3xl overflow-hidden drop-shadow-[10px_10px_0_rgba(255,46,99,0.28)]"
      >
        <div
          className="halftone-red pointer-events-none absolute -right-10 -top-10 size-48 opacity-35"
          aria-hidden="true"
        />

        <header className="relative z-10 border-b border-paper/10 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="kicker">
                // Command archive
              </span>

              <h2
                id="guide-search-title"
                className="mt-1 font-display text-lg font-black uppercase tracking-[-0.035em] text-paper"
              >
                {t(
                  'guides.search.dialogAria',
                )}
              </h2>
            </div>

            <button
              type="button"
              className="panel-cut-sm grid size-9 place-items-center border border-paper/10 bg-paper/[0.035] text-paper/42 transition hover:border-crimson/45 hover:bg-crimson/10 hover:text-crimson"
              onClick={onClose}
              aria-label={t(
                'guides.search.close',
              )}
            >
              <X
                size={15}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="panel-cut-sm flex items-center gap-3 border border-paper/12 bg-ink/75 px-4 focus-within:border-crimson/55 focus-within:drop-shadow-[4px_4px_0_rgba(255,46,99,0.22)]">
            <Search
              size={18}
              className="shrink-0 text-crimson"
              aria-hidden="true"
            />

            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder={t(
                'guides.search.placeholder',
              )}
              className="min-h-14 w-full bg-transparent font-body text-sm text-paper outline-none placeholder:text-paper/26"
              role="combobox"
              aria-expanded="true"
              aria-controls="guide-search-results"
              aria-activedescendant={
                results[selectedIdx]
                  ? `guide-search-result-${results[selectedIdx].guideId}`
                  : undefined
              }
              aria-label={t(
                'guides.search.inputAria',
              )}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              onKeyDown={
                handleInputKeyDown
              }
            />

            {query ? (
              <button
                type="button"
                className="panel-cut-sm grid size-8 shrink-0 place-items-center text-paper/35 hover:bg-paper/[0.05] hover:text-paper"
                onClick={() =>
                  setQuery('')
                }
                aria-label="Clear"
              >
                <X size={13} />
              </button>
            ) : (
              <kbd className="shrink-0 border border-paper/10 bg-paper/[0.035] px-2 py-1 font-mono text-[0.57rem] text-paper/32 panel-cut-sm">
                ESC
              </kbd>
            )}
          </div>
        </header>

        <div
          id="guide-search-results"
          className="koma-scrollbar relative z-10 max-h-[55vh] overflow-y-auto p-3 sm:p-4"
          role="listbox"
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-paper/30">
              {query.trim()
                ? t(
                  'guides.search.results',
                  {
                    count:
                      results.length,
                  },
                )
                : t(
                  'guides.search.recent',
                )}
            </span>

            <span className="stamp !border-paper/12 !bg-paper/[0.025] !text-paper/32">
              {results.length}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="halftone grid min-h-56 place-items-center text-center">
              <div>
                <Search
                  size={32}
                  className="mx-auto text-paper/14"
                  aria-hidden="true"
                />

                <p className="mt-4 font-mono text-xs uppercase tracking-[0.1em] text-paper/34">
                  {query.trim()
                    ? t(
                      'guides.search.noResults',
                      { query },
                    )
                    : t(
                      'guides.search.recent',
                    )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {results.map(
                (result, index) => {
                  const Icon =
                    result.icon;

                  const tone =
                    getGuideTone(
                      result.accentColor,
                    );

                  const styles =
                    GUIDE_TONE_STYLES[
                    tone
                    ];

                  const selected =
                    index ===
                    selectedIdx;

                  return (
                    <button
                      id={`guide-search-result-${result.guideId}`}
                      ref={(element) => {
                        resultRefs.current[
                          index
                        ] = element;
                      }}
                      key={
                        result.guideId
                      }
                      type="button"
                      role="option"
                      aria-selected={
                        selected
                      }
                      className={[
                        'panel-cut-sm grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border p-3 text-left transition',
                        selected
                          ? `${styles.border} ${styles.background} translate-x-1 ${styles.shadow}`
                          : 'border-transparent bg-paper/[0.018] hover:border-paper/12 hover:bg-paper/[0.035]',
                      ].join(' ')}
                      onMouseMove={() =>
                        setSelectedIdx(
                          index,
                        )
                      }
                      onClick={() =>
                        selectResult(
                          result,
                        )
                      }
                    >
                      <span
                        className={[
                          'grid size-10 place-items-center border panel-cut-sm',
                          styles.border,
                          styles.background,
                          styles.text,
                        ].join(' ')}
                        aria-hidden="true"
                      >
                        <Icon size={16} />
                      </span>

                      <span className="min-w-0">
                        <strong className="block truncate font-display text-sm font-black uppercase tracking-[-0.025em] text-paper">
                          {result.title}
                        </strong>

                        <span className="mt-1 block truncate text-xs text-paper/38">
                          {
                            result.categoryLabel
                          }{' '}
                          /{' '}
                          {result.matchedText ??
                            result.subtitle}
                        </span>
                      </span>

                      <span className="flex items-center gap-1.5 font-mono text-[0.58rem] text-paper/32">
                        <Clock
                          size={11}
                          aria-hidden="true"
                        />
                        {
                          result.estimatedTime
                        }
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          )}
        </div>

        <footer className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-paper/10 bg-ink/55 px-4 py-3 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-paper/28">
          <span>
            <kbd>↑</kbd>{' '}
            <kbd>↓</kbd>{' '}
            {t(
              'guides.search.navigate',
            )}
          </span>

          <span>
            <kbd>ENTER</kbd>{' '}
            {t(
              'guides.search.open',
            )}
          </span>

          <span>
            <kbd>ESC</kbd>{' '}
            {t(
              'guides.search.closeVerb',
            )}
          </span>

          <span className="ml-auto hidden items-center gap-1.5 sm:flex">
            <FileText size={11} />
            KOMA Archive Index
          </span>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
