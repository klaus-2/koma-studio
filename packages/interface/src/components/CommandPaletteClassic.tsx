import { Search, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { useCommandPaletteModel } from '../shortcuts/useCommandPaletteModel';
import { KomaDialog } from '@koma/ui/components/dialog';
import '@koma/ui/styles/KomaModals.css';

export interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPaletteClassic(props: CommandPaletteProps) {
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
      layerClassName="koma-cp-overlay"
      modalClassName="koma-cp-modal"
      label={t('commandPalette.dialogAria')}
    >
      {/* Search field */}
      <div className="koma-cp-modal__field">
        <Search size={16} aria-hidden />
        <input
          ref={inputRef}
          className="koma-cp-modal__input"
          type="text"
          placeholder={t('commandPalette.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          aria-label={t('commandPalette.inputAria')}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onClose}
          className="koma-cp-modal__close"
          aria-label={t('commandPalette.close')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Results */}
      <div className="koma-cp-modal__body" role="listbox" aria-label={t('commandPalette.inputAria')}>
        {results.length === 0 && query.trim() ? (
          <div className="koma-cp-modal__empty">
            <Search size={26} aria-hidden />
            {t('commandPalette.noResults', { query: query.trim() })}
          </div>
        ) : (
          <>
            <div className="koma-cp-modal__group-label">
              {query.trim() || !hasRecents
                ? t('commandPalette.results', { count: results.length })
                : t('commandPalette.recent')}
            </div>
            {results.map((view, idx) => (
              <div
                key={view.action.id}
                className={`koma-cp-modal__item${idx === selectedIdx ? ' koma-cp-modal__item--active' : ''}`}
                onClick={() => runAction(view)}
                role="option"
                aria-selected={idx === selectedIdx}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <div className="koma-cp-modal__item-title">{view.title}</div>
                <div className="koma-cp-modal__item-sub">{view.detail}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="koma-cp-modal__footer">
        <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> {t('commandPalette.footerNavigate')}</span>
        <span><kbd>&crarr;</kbd> {t('commandPalette.footerRun')}</span>
        <span><kbd>ESC</kbd> {t('commandPalette.footerClose')}</span>
      </div>
    </KomaDialog>
  );
}

export default CommandPaletteClassic;
