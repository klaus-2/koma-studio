import { AlertTriangle, Keyboard, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useI18n } from "../../i18n";
import { btnGhost, btnPrimary } from "../system/v2/kit";
import { KEYBOARD_SHORTCUT_STORAGE_KEY, SHORTCUT_CATEGORY_LABELS } from "../../shortcuts/keyboardShortcuts";
import {
  CATEGORY_ORDER,
  useShortcutCenterModel,
  type ShortcutCenterModalProps,
} from "../../shortcuts/useShortcutCenterModel";

const searchCls =
  "panel-cut-sm w-full border border-paper/12 bg-ink py-2 pl-8 pr-3 font-mono text-[11px] text-paper placeholder:text-paper/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";
const keycapCls =
  "panel-cut-sm inline-flex min-h-[26px] items-center border border-paper/15 bg-ink px-2 font-mono text-[10px] font-bold tracking-[0.04em] text-paper";
const ShortcutCenterModalNoir = (props: ShortcutCenterModalProps) => {
  const { open, config, onClose } = props;
  const { t } = useI18n();
  const {
    recordingId,
    searchQuery,
    setSearchQuery,
    error,
    rowsVisible,
    grouped,
    filteredFixedShortcuts,
    visibleShortcutCount,
    startRecord,
    clearCombo,
    restoreCombo,
    restoreAll,
  } = useShortcutCenterModel(props);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-ink/85 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass panel-cut halftone relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-title"
      >
        <span aria-hidden className="absolute left-0 top-0 z-10 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />
        <span aria-hidden className="v-text pointer-events-none absolute bottom-6 right-2 select-none font-display text-lg font-black tracking-widest text-paper/[0.06]">
          キーマップ
        </span>

        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="panel-cut-sm flex h-10 w-10 items-center justify-center border-2 border-crimson bg-crimson/10 text-crimson"
            >
              <Keyboard size={16} strokeWidth={2.5} />
            </span>
            <div>
              <p className="kicker">// SHORTCUT CENTER</p>
              <h2 id="sc-title" className="font-display text-lg font-black uppercase tracking-tight text-paper">
                {t("shortcutModal.title")}
              </h2>
              <p className="font-mono text-[10px] text-paper/45">{t("shortcutModal.subtitle")}</p>
              <p className="mt-1 font-mono text-[8px] uppercase tracking-wider text-paper/30">
                {KEYBOARD_SHORTCUT_STORAGE_KEY}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("shortcutModal.close")}
            className="panel-cut-sm border border-paper/15 p-1.5 text-paper/45 transition-colors hover:border-crimson/50 hover:text-crimson"
          >
            <X size={12} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
          <div className="flex items-start gap-2 border-l-2 border-azure bg-azure/8 px-3 py-2 font-mono text-[10px] text-azure">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            <span className="text-paper/75">
              {t("shortcutModal.instructionPrefix")}
              <strong className="text-azure">{t("shortcutModal.instructionRecord")}</strong>
              {t("shortcutModal.instructionSuffix")}
            </span>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/30"
            />
            <input
              id="shortcut-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("shortcutModal.searchPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              className={searchCls}
            />
          </div>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-paper/35">
            {visibleShortcutCount === 1
              ? t("shortcutModal.results_one", { count: visibleShortcutCount })
              : t("shortcutModal.results_other", { count: visibleShortcutCount })}
          </p>

          {rowsVisible && CATEGORY_ORDER.map((cat, catIndex) => {
            const actions = grouped.get(cat) ?? [];
            if (actions.length === 0) return null;
            return (
              <section key={cat} className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <span aria-hidden className="text-outline font-display text-2xl font-black">
                    {String(catIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="kicker">// {t(SHORTCUT_CATEGORY_LABELS[cat] as any)}</span>
                  <span aria-hidden className="h-px flex-1 bg-paper/10" />
                  <span className="font-mono text-[9px] text-paper/35">{actions.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {actions.map((action) => {
                    const combo = config.shortcuts[action.id] ?? [];
                    const isRec = recordingId === action.id;
                    const hasErr = error.id === action.id && Boolean(error.msg);
                    return (
                      <div key={action.id}>
                        <article
                          className={`panel-cut-sm flex items-center gap-3 border px-3 py-2 transition-colors ${isRec
                              ? "border-crimson bg-crimson/5"
                              : "border-paper/10 bg-ink/50"
                            }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[11px] font-bold text-paper">
                              {t(action.label as any)}
                            </p>
                            <p className="truncate font-mono text-[9px] text-paper/40">
                              {t(action.description as any)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {combo.length > 0 ? (
                              combo.map((k) => (
                                <span key={`${action.id}-${k}`} className={keycapCls}>
                                  {k}
                                </span>
                              ))
                            ) : (
                              <span className={`${keycapCls} text-paper/30`}>—</span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startRecord(action.id)}
                              className={`panel-cut-sm border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${isRec
                                  ? "border-crimson bg-crimson/10 text-crimson"
                                  : "border-paper/15 text-paper/45 hover:border-paper/40 hover:text-paper"
                                }`}
                            >
                              {isRec
                                ? <span className="blink">● {t("shortcutModal.recording")}</span>
                                : t("shortcutModal.record")}
                            </button>
                            <button
                              type="button"
                              onClick={() => restoreCombo(action.id)}
                              aria-label={t("shortcutModal.restoreDefault")}
                              className="panel-cut-sm border border-paper/15 p-1 text-paper/40 transition-colors hover:border-paper/40 hover:text-paper"
                            >
                              <RotateCcw size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => clearCombo(action.id)}
                              aria-label={t("shortcutModal.clearShortcut")}
                              className="panel-cut-sm border border-paper/15 p-1 text-paper/40 transition-colors hover:border-crimson/50 hover:text-crimson"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </article>
                        {hasErr && (
                          <p className="mt-1 border-l-2 border-gold bg-gold/8 px-3 py-1.5 font-mono text-[9px] text-gold">
                            {error.msg}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Fixed shortcuts */}
          {rowsVisible && filteredFixedShortcuts.length > 0 && (
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <span aria-hidden className="text-outline font-display text-2xl font-black">FX</span>
                <span className="kicker">// {t("shortcutModal.fixedShortcuts")}</span>
                <span aria-hidden className="h-px flex-1 bg-paper/10" />
                <span className="font-mono text-[9px] uppercase text-paper/35">{t("shortcutModal.fixed")}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {filteredFixedShortcuts.map((s) => (
                  <article
                    key={s.id}
                    className="panel-cut-sm flex items-center gap-3 border border-paper/10 bg-ink/50 px-3 py-2 opacity-80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] font-bold text-paper/80">
                        {t(s.label as any)}
                      </p>
                      <p className="truncate font-mono text-[9px] text-paper/40">
                        {t(s.description as any)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {s.combo.map((k) => (
                        <span key={`${s.id}-${k}`} className={keycapCls}>
                          {k}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {rowsVisible && visibleShortcutCount === 0 && (
            <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-paper/35">
              {t("shortcutModal.noResults", { query: searchQuery.trim() })}
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-paper/10 px-5 py-4 sm:px-6">
          <div className="flex justify-between gap-2">
            <button type="button" className={btnGhost} onClick={restoreAll}>
              <RotateCcw size={11} /> {t("shortcutModal.restoreAll")}
            </button>
            <button type="button" className={btnPrimary} onClick={onClose}>
              {t("shortcutModal.close")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ShortcutCenterModalNoir;
