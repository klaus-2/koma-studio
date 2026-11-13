import { Search, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useCommandPaletteModel } from '../../shortcuts/useCommandPaletteModel';
import { KomaDialog } from '@koma/ui/components/dialog';
import type { CommandPaletteProps } from '../CommandPaletteClassic';

const inputCls =
  "panel-cut-sm w-full border border-paper/12 bg-ink py-2 pl-8 pr-3 font-mono text-[11px] text-paper placeholder:text-paper/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";
const keycapCls =
  "panel-cut-sm inline-flex min-h-[24px] items-center border border-paper/15 bg-ink px-2 font-mono text-[10px] font-bold tracking-[0.04em] text-paper";

const CommandPaletteNoir = (props: CommandPaletteProps) => {
  const { onClose } = props;
  const { t } = useI18n();
  const {
    query,
    setQuery,
    selectedIdx,
    setSelectedIdx,
    inputRef,
    results,
    hasRecents,
    runAction,
    handleInputKeyDown,
  } = useCommandPaletteModel(props);

  return (
    <KomaDialog
      open
      onClose={onClose}
      layerClassName="fixed inset-0 z-[150] flex items-start justify-center bg-ink/85 p-3 pt-[10vh] backdrop-blur-md sm:p-6 sm:pt-[12vh]"
      modalClassName="glass panel-cut halftone relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden"
      label={t("commandPalette.dialogAria")}
    >
      <span aria-hidden className="absolute left-0 top-0 z-10 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />
      <span aria-hidden className="v-text pointer-events-none absolute bottom-6 right-2 select-none font-display text-lg font-black tracking-widest text-paper/[0.06]">
        コマンド
      </span>

      {/* Search field */}
      <div className="relative px-4 pb-3 pt-4 sm:px-5">
        <Search
          size={13}
          aria-hidden
          className="pointer-events-none absolute left-7 top-1/2 z-10 -translate-y-1/2 text-paper/30"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t("commandPalette.placeholder")}
          aria-label={t("commandPalette.inputAria")}
          autoComplete="off"
          spellCheck={false}
          className={inputCls}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("commandPalette.close")}
          className="absolute right-7 top-1/2 z-10 -translate-y-1/2 text-paper/45 transition-colors hover:text-crimson"
        >
          <X size={13} />
        </button>
      </div>

      {/* Results */}
      <div
        role="listbox"
        aria-label={t("commandPalette.inputAria")}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-5"
      >
        {results.length === 0 && query.trim() ? (
          <p className="py-8 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-paper/35">
            {t("commandPalette.noResults", { query: query.trim() })}
          </p>
        ) : (
          <>
            <p className="kicker px-1 pb-2">
              {'// '}
              {query.trim() || !hasRecents
                ? t('commandPalette.results', { count: results.length })
                : t('commandPalette.recent')}
            </p>
            <div className="flex flex-col gap-1.5">
              {results.map((view, idx) => (
                <div
                  key={view.action.id}
                  role="option"
                  aria-selected={idx === selectedIdx}
                  onClick={() => runAction(view)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`panel-cut-sm flex cursor-pointer items-center gap-3 border px-3 py-2 transition-colors ${idx === selectedIdx
                      ? "border-crimson bg-crimson/5"
                      : "border-paper/10 bg-ink/50"
                    }`}
                >
                  <p className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold text-paper">
                    {view.title}
                  </p>
                  <p className="shrink-0 font-mono text-[9px] text-paper/40">
                    {view.detail}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-3 border-t border-paper/10 px-4 py-3 sm:px-5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-paper/45">
          <kbd className={keycapCls}>&uarr;</kbd>
          <kbd className={keycapCls}>&darr;</kbd>
          {t("commandPalette.footerNavigate")}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-paper/45">
          <kbd className={keycapCls}>&crarr;</kbd>
          {t("commandPalette.footerRun")}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-paper/45">
          <kbd className={keycapCls}>ESC</kbd>
          {t("commandPalette.footerClose")}
        </span>
      </footer>
    </KomaDialog>
  );
};

export default CommandPaletteNoir;
