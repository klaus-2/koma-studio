/* ============================================================
   KŌMA STUDIO — Resources Page (Unified Tabbed Interface)
   All resource sections in one view with glass UI tabs
   ============================================================ */

import {
  BookOpen,
  Search,
  Type,
  Users,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
  
  import {
    COMMUNITIES_DATA,
    EXTERNAL_TOOLS_DATA,
    FONTS_DATA,
    GLOSSARY_DATA,
    SFX_DATA,
  } from '../../data/resources-data';
import type { ResourceTab } from '../../data/guides-types';
  import { useInfoNavStore } from '../../stores/info-nav-store';
  
  import CommunitiesSection from './CommunitiesSection';
  import FontsSection from './FontsSection';
  import GlossarySection from './GlossarySection';
  import SfxSection from './SfxSection';
  import ToolsSection from './ToolsSection';
  
  import './resources.css';
  
  /* ── Tab definitions ── */
  
interface TabDef {
  id: ResourceTab;
  label: string;
  icon: typeof Type;
  count: number;
}
  
  export default function ResourcesPage() {
    const { t } = useI18n();
  const rawTab = useInfoNavStore((s) => s.resourcesCategory);
  const setTab = useInfoNavStore((s) => s.navigateToResourceCategory);
  const activeTab: ResourceTab = rawTab ?? 'fonts';
  
    const [search, setSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    const TABS: TabDef[] = [
      { id: 'fonts', label: t('resources.page.tab.fonts'), icon: Type, count: FONTS_DATA.length },
      { id: 'sfx-library', label: t('resources.page.tab.sfx'), icon: Volume2, count: SFX_DATA.length },
      { id: 'glossary', label: t('resources.page.tab.glossary'), icon: BookOpen, count: GLOSSARY_DATA.length },
      { id: 'communities', label: t('resources.page.tab.communities'), icon: Users, count: COMMUNITIES_DATA.length },
      { id: 'tools-external', label: t('resources.page.tab.tools'), icon: Wrench, count: EXTERNAL_TOOLS_DATA.length },
    ];
  
    /* Ctrl+F → focus search */
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          searchRef.current?.focus();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, []);
  
  const handleTabClick = useCallback((id: ResourceTab) => {
    setTab(id);
  }, [setTab]);
  
    const clearSearch = useCallback(() => {
      setSearch('');
      searchRef.current?.focus();
    }, []);
  
    return (
      <div className="koma-res">
        {/* Decorative orbs */}
        <div className="koma-res__orb koma-res__orb--purple" aria-hidden="true" />
        <div className="koma-res__orb koma-res__orb--cyan" aria-hidden="true" />
        <div className="koma-res__halftone" aria-hidden="true" />
  
        <div className="koma-res__inner">
          {/* Header */}
          <header className="koma-res__header">
            <h2 className="koma-res__title">
              {t('resources.page.title.main')}
              <span className="koma-res__title-accent">{t('resources.page.title.accent')}</span>
            </h2>
            <p className="koma-res__subtitle">
              {t('resources.page.subtitle')}
            </p>
          </header>
  
          {/* Search Bar */}
          <div className="koma-res__search">
            <Search size={15} className="koma-res__search-icon" />
            <input
              ref={searchRef}
              type="text"
              className="koma-res__search-input"
              placeholder={t('resources.page.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('resources.page.searchAria')}
            />
            <div className="koma-res__search-meta">
              {search.length > 0 ? (
                <button
                  type="button"
                  className="koma-res__search-clear"
                  onClick={clearSearch}
                  aria-label={t('resources.page.clearSearch')}
                >
                  <X size={14} />
                </button>
              ) : (
                <>
                  <kbd className="koma-res__kbd">{t('resources.page.shortcutCtrl')}</kbd>
                  <kbd className="koma-res__kbd">{t('resources.page.shortcutFind')}</kbd>
                </>
              )}
            </div>
          </div>
  
          {/* Tabs */}
          <div className="koma-res__tabs" role="tablist" aria-label={t('resources.page.tabsAria')}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`koma-res__tab ${activeTab === tab.id ? 'koma-res__tab--active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
                <span className="koma-res__tab-count">{tab.count}</span>
              </button>
            ))}
          </div>
  
          {/* Active Section */}
          <div className="koma-res__content" role="tabpanel">
            {activeTab === 'fonts' && <FontsSection search={search} />}
            {activeTab === 'sfx-library' && <SfxSection search={search} />}
            {activeTab === 'glossary' && <GlossarySection search={search} />}
            {activeTab === 'communities' && <CommunitiesSection search={search} />}
            {activeTab === 'tools-external' && <ToolsSection search={search} />}
          </div>
        </div>
      </div>
    );
  }
