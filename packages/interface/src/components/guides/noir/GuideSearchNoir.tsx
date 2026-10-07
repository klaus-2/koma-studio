import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
const EASE = [0.22, 1, 0.36, 1] as const;
import { Clock, FileText, Search, X } from 'lucide-react';

import { GUIDE_CATEGORIES, GUIDES } from '../../../data/guides-data';
import { useInfoNavStore } from '../../../stores/info-nav-store';
import { useI18n } from '../../../i18n';


interface Props {
  onClose: () => void;
}

interface SearchResult {
  guideId: string;
  title: string;
  category: string;
  categoryLabel: string;
  estimatedTime: string;
  matchedText?: string;
}

export default function GuideSearch({ onClose }: Props) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigateToGuideEntry = useInfoNavStore((s) => s.navigateToGuideEntry);
  const recentGuides = useInfoNavStore((s) => s.recentGuides);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const results: SearchResult[] = useMemo(() => {
    const toResult = (g: (typeof GUIDES)[number], matchedText?: string): SearchResult => {
      const cat = GUIDE_CATEGORIES.find((c) => c.id === g.category);
      return {
        guideId: g.id,
        title: g.title,
        category: g.category,
        categoryLabel: cat?.label ?? '',
        estimatedTime: g.estimatedTime,
        matchedText,
      };
    };

    if (!query.trim()) {
      return recentGuides
        .map((id) => GUIDES.find((g) => g.id === id))
        .filter((g): g is (typeof GUIDES)[number] => Boolean(g))
        .map((g) => toResult(g));
    }

    const q = query.toLowerCase();
    return GUIDES.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.subtitle.toLowerCase().includes(q) ||
        g.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        g.sections.some((s) =>
          s.steps.some(
            (st) =>
              st.content.toLowerCase().includes(q) ||
              (st.title && st.title.toLowerCase().includes(q)),
          ),
        ),
    )
      .slice(0, 8)
      .map((g) => {
        let matchedText: string | undefined;
        if (!g.title.toLowerCase().includes(q)) {
          outer: for (const sec of g.sections) {
            for (const st of sec.steps) {
              const idx = st.content.toLowerCase().indexOf(q);
              if (idx >= 0) {
                const start = Math.max(0, idx - 30);
                const end = Math.min(st.content.length, idx + q.length + 40);
                matchedText =
                  (start > 0 ? '…' : '') +
                  st.content.slice(start, end) +
                  (end < st.content.length ? '…' : '');
                break outer;
              }
            }
          }
        }
        return toResult(g, matchedText);
      });
  }, [query, recentGuides]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  /* Scroll selected into view */
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIdx]) {
        e.preventDefault();
        const r = results[selectedIdx];
        navigateToGuideEntry(r.category as never, r.guideId);
        onClose();
      }
    },
    [results, selectedIdx, navigateToGuideEntry, onClose],
  );

  const handleSelect = useCallback(
    (r: SearchResult) => {
      navigateToGuideEntry(r.category as never, r.guideId);
      onClose();
    },
    [navigateToGuideEntry, onClose],
  );

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t('guides.search.dialogAria')}
      onClick={onClose}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/80 px-4 pt-[12vh] backdrop-blur-sm"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        initial={reduce ? false : { opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="glass panel-cut relative w-full max-w-xl border border-paper/15"
      >
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-5 right-5 select-none font-display text-5xl font-black leading-none"
        >
          検索
        </span>

        {/* Input */}
        <div className="flex items-center gap-3 border-b border-paper/12 px-4 py-3.5">
          <Search size={16} className="flex-none text-crimson" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            aria-label={t('guides.search.inputAria')}
            placeholder={t('guides.search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-paper placeholder:text-paper/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('guides.search.close')}
            className="noir-icon-btn"
          >
            <X size={13} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} role="listbox" className="noir-scroll max-h-[46vh] overflow-y-auto p-2">
          {results.length === 0 && query.trim() ? (
            <div className="flex flex-col items-center gap-2 py-10 text-paper/35">
              <Search size={24} strokeWidth={1.2} />
              <p className="font-mono text-[11px]">{t('guides.search.noResults', { query })}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-paper/35">
                {!query.trim() && <Clock size={10} aria-hidden />}
                {query.trim()
                  ? t('guides.search.results', { count: results.length })
                  : t('guides.search.recent')}
              </div>
              {results.map((r, i) => {
                const active = i === selectedIdx;
                return (
                  <button
                    key={r.guideId}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={`panel-cut-sm flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${active ? 'bg-crimson/12 border-l-2 border-l-crimson' : 'border-l-2 border-l-transparent'
                      }`}
                  >
                    <span
                      className={`panel-cut-sm grid h-7 w-7 flex-none place-items-center border ${active ? 'border-crimson/50 bg-crimson/15 text-crimson' : 'border-paper/15 text-paper/45'
                        }`}
                    >
                      <FileText size={12} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-display text-[12px] font-bold uppercase tracking-wide ${active ? 'text-paper' : 'text-paper/75'
                          }`}
                      >
                        {r.title}
                      </span>
                      {r.matchedText && (
                        <span className="mt-0.5 block truncate text-[10.5px] text-paper/40">
                          {r.matchedText}
                        </span>
                      )}
                    </span>
                    <span className="flex-none font-mono text-[9px] uppercase tracking-[0.14em] text-paper/35">
                      {r.categoryLabel} · {r.estimatedTime}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-4 border-t border-paper/10 px-4 py-2.5 font-mono text-[9.5px] text-paper/40">
          <span className="flex items-center gap-1.5">
            <kbd className="noir-kbd">↑</kbd>
            <kbd className="noir-kbd">↓</kbd> {t('guides.search.navigate')}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="noir-kbd">↵</kbd> {t('guides.search.open')}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="noir-kbd">ESC</kbd> {t('guides.search.closeVerb')}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
