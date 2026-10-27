'use client';

import {
  ArrowLeft,
  BookOpen,
  Boxes,
  Database,
  Search,
  Type,
  Users,
  Volume2,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  COMMUNITIES_DATA,
  EXTERNAL_TOOLS_DATA,
  FONTS_DATA,
  GLOSSARY_DATA,
  SFX_DATA,
} from '@/data/resources-data';
import type {
  ResourceTab,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';
import { useInfoNavStore } from '@/stores/info-nav-store';

import CommunitiesSectionV2 from './CommunitiesSectionV2';
import FontsSectionV2 from './FontsSectionV2';
import GlossarySectionV2 from './GlossarySectionV2';
import SfxSectionV2 from './SfxSectionV2';
import ToolsSectionV2 from './ToolsSectionV2';
import {
  ResourceMetric,
  ResourceNexusHero,
  RESOURCE_TONE,
  type ResourceTone,
} from './ResourceV2Primitives';
import {
  RESOURCE_EASE,
} from './resource-v2-utils';

interface ResourcesPageV2Props {
  initialCategory?: ResourceTab;
  showTabs?: boolean;
  showBackButton?: boolean;
}

interface ResourceTabItem {
  id: ResourceTab;
  label: string;
  icon: LucideIcon;
  count: number;
  tone: ResourceTone;
}

export default function ResourcesPageV2({
  initialCategory,
  showTabs = true,
  showBackButton = false,
}: ResourcesPageV2Props) {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const rawTab = useInfoNavStore(
    (state) =>
      state.resourcesCategory,
  );

  const navigateToCategory =
    useInfoNavStore(
      (state) =>
        state.navigateToResourceCategory,
    );

  const navigateResourcesHome =
    useInfoNavStore(
      (state) =>
        state.navigateResourcesHome,
    );

  const activeTab =
    initialCategory ??
    rawTab ??
    'fonts';

  const [search, setSearch] =
    useState('');

  const searchRef =
    useRef<HTMLInputElement>(null);

  const tabRefs =
    useRef<
      Array<HTMLButtonElement | null>
    >([]);

  const tabs = useMemo<
    ResourceTabItem[]
  >(
    () => [
      {
        id: 'fonts',
        label: t(
          'resources.page.tab.fonts',
        ),
        icon: Type,
        count: FONTS_DATA.length,
        tone: 'crimson',
      },
      {
        id: 'sfx-library',
        label: t(
          'resources.page.tab.sfx',
        ),
        icon: Volume2,
        count: SFX_DATA.length,
        tone: 'azure',
      },
      {
        id: 'glossary',
        label: t(
          'resources.page.tab.glossary',
        ),
        icon: BookOpen,
        count: GLOSSARY_DATA.length,
        tone: 'gold',
      },
      {
        id: 'communities',
        label: t(
          'resources.page.tab.communities',
        ),
        icon: Users,
        count:
          COMMUNITIES_DATA.length,
        tone: 'azure',
      },
      {
        id: 'tools-external',
        label: t(
          'resources.page.tab.tools',
        ),
        icon: Wrench,
        count:
          EXTERNAL_TOOLS_DATA.length,
        tone: 'mint',
      },
    ],
    [t],
  );

  const totalItems = useMemo(
    () =>
      FONTS_DATA.length +
      SFX_DATA.length +
      GLOSSARY_DATA.length +
      COMMUNITIES_DATA.length +
      EXTERNAL_TOOLS_DATA.length,
    [],
  );

  useEffect(() => {
    const handleShortcut = (
      event: globalThis.KeyboardEvent,
    ) => {
      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          'f'
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener(
      'keydown',
      handleShortcut,
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handleShortcut,
      );
  }, []);

  const selectTab = useCallback(
    (category: ResourceTab) => {
      navigateToCategory(category);
    },
    [navigateToCategory],
  );

  const handleTabKeyboard =
    useCallback(
      (
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
      ) => {
        let nextIndex = index;

        if (
          event.key ===
          'ArrowRight'
        ) {
          nextIndex =
            (index + 1) %
            tabs.length;
        } else if (
          event.key === 'ArrowLeft'
        ) {
          nextIndex =
            (index -
              1 +
              tabs.length) %
            tabs.length;
        } else if (
          event.key === 'Home'
        ) {
          nextIndex = 0;
        } else if (
          event.key === 'End'
        ) {
          nextIndex =
            tabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();

        const nextTab =
          tabs[nextIndex];

        tabRefs.current[
          nextIndex
        ]?.focus();

        if (!nextTab) return;
        selectTab(nextTab.id);
      },
      [selectTab, tabs],
    );

  const activeDefinition =
    tabs.find(
      (tab) => tab.id === activeTab,
    ) ?? tabs[0];

  const activeTone =
    RESOURCE_TONE[
      activeDefinition?.tone ?? 'crimson'
    ];

  return (
    <div
      className="koma-resource-shell manga-grid-bg relative isolate min-h-full bg-ink p-3 text-paper sm:p-5 lg:p-7"
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        <ResourceNexusHero
          kicker="Scanlation database"
          title={t(
            'resources.page.title.main',
          )}
          accent={t(
            'resources.page.title.accent',
          )}
          description={t(
            'resources.page.subtitle',
          )}
          icon={Boxes}
          action={
            showBackButton ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={
                  navigateResourcesHome
                }
              >
                <ArrowLeft
                  size={14}
                />
                {t('resources.back')}
              </button>
            ) : undefined
          }
          metrics={
            <>
              <ResourceMetric
                icon={Database}
                value={totalItems}
                label="Entries"
                tone="crimson"
              />

              <ResourceMetric
                icon={Boxes}
                value={tabs.length}
                label="Archives"
                tone="gold"
              />

              <ResourceMetric
                icon={
                  activeDefinition?.icon ?? Boxes
                }
                value={
                  activeDefinition?.count ?? 0
                }
                label={
                  activeDefinition?.label ?? ''
                }
                tone={
                  activeDefinition?.tone
                }
              />
            </>
          }
        />

        <div
          className="koma-resource-marquee overflow-hidden border-y border-paper/[0.065] py-2"
          aria-hidden="true"
        >
          <div className="koma-resource-marquee__track font-display text-sm font-black uppercase tracking-[0.12em] text-paper/16">
            {[
              'TYPE FOUNDRY',
              'SFX VAULT',
              'GLOSSARY',
              'COMMUNITY NETWORK',
              'TOOL ARSENAL',
              'TYPE FOUNDRY',
              'SFX VAULT',
              'GLOSSARY',
              'COMMUNITY NETWORK',
              'TOOL ARSENAL',
            ].map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="flex items-center gap-5"
              >
                {label}
                <span className="size-1.5 rotate-45 bg-crimson" />
              </span>
            ))}
          </div>
        </div>

        {/* Search */}
        <label className="glass panel-cut-sm flex items-center gap-3 border-paper/10 px-4 transition focus-within:-translate-x-0.5 focus-within:-translate-y-0.5 focus-within:border-crimson/50 focus-within:drop-shadow-[4px_4px_0_rgba(255,46,99,0.22)]">
          <Search
            size={17}
            className="shrink-0 text-crimson"
            aria-hidden="true"
          />

          <input
            ref={searchRef}
            type="search"
            value={search}
            placeholder={t(
              'resources.page.searchPlaceholder',
            )}
            className="min-h-14 w-full bg-transparent text-sm text-paper outline-none placeholder:text-paper/26"
            aria-label={t(
              'resources.page.searchAria',
            )}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          {search ? (
            <button
              type="button"
              className="panel-cut-sm grid size-9 shrink-0 place-items-center border border-paper/10 bg-paper/[0.035] text-paper/35 transition hover:border-crimson/45 hover:text-crimson"
              aria-label={t(
                'resources.page.clearSearch',
              )}
              onClick={() => {
                setSearch('');
                searchRef.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          ) : (
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="border border-paper/10 bg-paper/[0.035] px-2 py-1 font-mono text-[0.56rem] text-paper/32 panel-cut-sm">
                {t(
                  'resources.page.shortcutCtrl',
                )}
              </kbd>

              <kbd className="border border-paper/10 bg-paper/[0.035] px-2 py-1 font-mono text-[0.56rem] text-paper/32 panel-cut-sm">
                {t(
                  'resources.page.shortcutFind',
                )}
              </kbd>
            </span>
          )}
        </label>

        {/* Tabs */}
        {showTabs ? (
          <div
            className="glass panel-cut koma-scrollbar flex gap-2 overflow-x-auto p-2"
            role="tablist"
            aria-label={t(
              'resources.page.tabsAria',
            )}
          >
            {tabs.map((tab, index) => {
              const Icon = tab.icon;

              const selected =
                activeTab === tab.id;

              const toneStyles =
                RESOURCE_TONE[
                  tab.tone
                ];

              return (
                <button
                  key={tab.id}
                  ref={(element) => {
                    tabRefs.current[
                      index
                    ] = element;
                  }}
                  id={`resource-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  tabIndex={
                    selected ? 0 : -1
                  }
                  aria-selected={
                    selected
                  }
                  aria-controls={`resource-panel-${tab.id}`}
                  className={[
                    'panel-cut-sm relative inline-flex min-h-12 shrink-0 items-center gap-2 overflow-hidden border px-4',
                    'font-mono text-[0.64rem] font-black uppercase tracking-[0.08em] transition',
                    selected
                      ? `${toneStyles.border} ${toneStyles.background} ${toneStyles.text} ${toneStyles.shadow}`
                      : 'border-paper/10 bg-paper/[0.025] text-paper/40 hover:border-paper/25 hover:text-paper',
                  ].join(' ')}
                  onClick={() =>
                    selectTab(tab.id)
                  }
                  onKeyDown={(
                    event,
                  ) =>
                    handleTabKeyboard(
                      event,
                      index,
                    )
                  }
                >
                  {selected ? (
                    <m.span
                      layoutId="resource-active-tab"
                      className={[
                        'absolute inset-x-0 bottom-0 h-[3px]',
                        toneStyles.solid,
                      ].join(' ')}
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 34,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}

                  <Icon
                    size={14}
                    aria-hidden="true"
                  />

                  {tab.label}

                  <span
                    className={[
                      'grid min-w-6 place-items-center px-1.5 py-0.5 text-[0.54rem]',
                      selected
                        ? 'bg-ink text-paper'
                        : 'bg-paper/[0.05] text-paper/32',
                    ].join(' ')}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Content */}
        <div
          id={`resource-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={
            showTabs
              ? `resource-tab-${activeTab}`
              : undefined
          }
          className={[
            'glass panel-cut overflow-hidden border',
            activeTone.border,
          ].join(' ')}
        >
          <AnimatePresence
            mode="wait"
            initial={false}
          >
            <m.div
              key={activeTab}
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 16,
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
                duration:
                  reduceMotion
                    ? 0
                    : 0.42,
                ease: RESOURCE_EASE,
              }}
            >
              {activeTab === 'fonts' ? (
                <FontsSectionV2
                  search={search}
                />
              ) : null}

              {activeTab ===
              'sfx-library' ? (
                <SfxSectionV2
                  search={search}
                />
              ) : null}

              {activeTab ===
              'glossary' ? (
                <GlossarySectionV2
                  search={search}
                  onSearchChange={
                    setSearch
                  }
                />
              ) : null}

              {activeTab ===
              'communities' ? (
                <CommunitiesSectionV2
                  search={search}
                />
              ) : null}

              {activeTab ===
              'tools-external' ? (
                <ToolsSectionV2
                  search={search}
                />
              ) : null}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
