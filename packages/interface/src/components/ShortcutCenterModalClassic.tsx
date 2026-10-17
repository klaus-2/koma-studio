import { AlertTriangle, Keyboard, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useI18n } from '../i18n';

import { KEYBOARD_SHORTCUT_STORAGE_KEY, SHORTCUT_CATEGORY_LABELS } from '../shortcuts/keyboardShortcuts';
import {
  CATEGORY_ORDER,
  useShortcutCenterModel,
  type ShortcutCenterModalProps,
} from '../shortcuts/useShortcutCenterModel';
import '@koma/ui/styles/KomaModals.css';

export function ShortcutCenterModalClassic(props: ShortcutCenterModalProps) {
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
    <div className="koma-modal-backdrop" onClick={onClose}>
      <div
        className="koma-modal koma-shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-title"
      >
        {/* Header */}
        <div className="koma-modal__header">
          <div className="koma-modal__header-icon">
            <Keyboard size={18} />
          </div>
          <div className="koma-modal__title-group">
            <h2 id="sc-title" className="koma-modal__title">
              {t('shortcutModal.title')}
            </h2>
            <p className="koma-modal__subtitle">
              {t('shortcutModal.subtitle')}
            </p>
            <div className="koma-modal__meta-row">
              <span className="koma-modal__meta-chip">{t('shortcutModal.hotkeyHint')}</span>
              <span className="koma-modal__meta-chip">
                {KEYBOARD_SHORTCUT_STORAGE_KEY}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="koma-modal__close"
            aria-label={t('shortcutModal.close')}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="koma-modal__body">
          <div
            className="koma-modal-alert koma-modal-alert--info"
            style={{ marginBottom: 14 }}
          >
            <AlertTriangle size={13} className="koma-modal-alert__icon" />
            <span>
              {t('shortcutModal.instructionPrefix')}
              <strong>{t('shortcutModal.instructionRecord')}</strong>
              {t('shortcutModal.instructionSuffix')}
            </span>
          </div>

          <div className="koma-sc-search">
            <label className="koma-sc-search__field" htmlFor="shortcut-search">
              <Search size={14} />
              <input
                id="shortcut-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('shortcutModal.searchPlaceholder')}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <span className="koma-sc-search__count">
              {visibleShortcutCount === 1 ? t('shortcutModal.results_one', { count: visibleShortcutCount }) : t('shortcutModal.results_other', { count: visibleShortcutCount })}
            </span>
          </div>

          {rowsVisible && CATEGORY_ORDER.map((cat) => {
            const actions = grouped.get(cat) ?? [];
            if (actions.length === 0) return null;
            return (
              <section key={cat} className="koma-sc-section">
                <div className="koma-sc-section__head">
                  <h3 className="koma-sc-section__title">
                    {t(SHORTCUT_CATEGORY_LABELS[cat] as any)}
                  </h3>
                  <span className="koma-sc-section__count">
                    {actions.length}
                  </span>
                </div>
                <div className="koma-sc-list">
                  {actions.map((action) => {
                    const combo = config.shortcuts[action.id] ?? [];
                    const isRec = recordingId === action.id;
                    const hasErr = error.id === action.id && Boolean(error.msg);
                    return (
                      <div key={action.id}>
                        <article
                          className={`koma-sc-item${isRec ? ' koma-sc-item--recording' : ''}`}
                        >
                          <div className="koma-sc-item__info">
                            <span className="koma-sc-item__name">
                              {t(action.label as any)}
                            </span>
                            <span className="koma-sc-item__desc">
                              {t(action.description as any)}
                            </span>
                          </div>
                          <div className="koma-sc-combo">
                            {combo.length > 0 ? (
                              combo.map((t) => (
                                <span
                                  key={`${action.id}-${t}`}
                                  className="koma-sc-keycap"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="koma-sc-combo-empty">—</span>
                            )}
                          </div>
                          <div className="koma-sc-actions">
                            <button
                              type="button"
                              className={`koma-btn koma-btn--sm${isRec ? ' koma-btn--recording koma-sc-actions' : ' koma-btn--ghost'}`}
                              onClick={() => startRecord(action.id)}
                            >
                              {isRec ? t('shortcutModal.recording') : t('shortcutModal.record')}
                            </button>
                            <button
                              type="button"
                              className="koma-btn koma-btn--ghost koma-btn--sm"
                              onClick={() => restoreCombo(action.id)}
                              aria-label={t('shortcutModal.restoreDefault')}
                            >
                              <RotateCcw size={10} />
                            </button>
                            <button
                              type="button"
                              className="koma-btn koma-btn--ghost koma-btn--sm"
                              onClick={() => clearCombo(action.id)}
                              aria-label={t('shortcutModal.clearShortcut')}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </article>
                        {hasErr && <p className="koma-sc-error">{error.msg}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Fixed shortcuts */}
          {rowsVisible && filteredFixedShortcuts.length > 0 && (
            <section className="koma-sc-section">
              <div className="koma-sc-section__head">
                <h3 className="koma-sc-section__title">
                  {t('shortcutModal.fixedShortcuts')}
                </h3>
                <span className="koma-sc-section__count">{t('shortcutModal.fixed')}</span>
              </div>
              <div className="koma-sc-list">
                {filteredFixedShortcuts.map((s) => (
                  <article
                    key={s.id}
                    className="koma-sc-item koma-sc-item--fixed"
                  >
                    <div className="koma-sc-item__info">
                      <span className="koma-sc-item__name">{t(s.label as any)}</span>
                      <span className="koma-sc-item__desc">{t(s.description as any)}</span>
                    </div>
                    <div className="koma-sc-combo">
                      {s.combo.map((t) => (
                        <span key={`${s.id}-${t}`} className="koma-sc-keycap">
                          {t}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {rowsVisible && visibleShortcutCount === 0 && (
            <div className="koma-sc-empty">
              {t('shortcutModal.noResults', { query: searchQuery.trim() })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="koma-modal__footer">
          <button
            type="button"
            onClick={restoreAll}
            className="koma-modal__btn koma-modal__btn--ghost"
          >
            <RotateCcw size={12} /> {t('shortcutModal.restoreAll')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="koma-modal__btn koma-modal__btn--primary"
          >
            {t('shortcutModal.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShortcutCenterModalClassic;
