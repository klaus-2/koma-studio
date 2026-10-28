import { memo, useState } from 'react';

import { useI18n } from '@/i18n';
import { clampGlossary, type GlossaryTerm } from '../../../utils/glossary';

interface AioGlossaryEditorProps {
  glossary: GlossaryTerm[];
  onChange: (next: GlossaryTerm[]) => void;
}

export const AioGlossaryEditor = memo(({ glossary, onChange }: AioGlossaryEditorProps) => {
  const { t } = useI18n();
  // Draft rows may be incomplete; only complete pairs reach the store.
  const [draft, setDraft] = useState<GlossaryTerm[]>(glossary);

  const commit = (next: GlossaryTerm[]): void => {
    setDraft(next);
    onChange(clampGlossary(next));
  };

  return (
    <div className="koma-aio-llm-panel">
      <span className="koma-field__label">{t('dashboard.aio.glossary.title')}</span>
      {draft.length === 0 ? (
        <p className="koma-aio-hint">{t('dashboard.aio.glossary.empty')}</p>
      ) : (
        draft.map((term, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="koma-input koma-input--sm"
              value={term.source}
              placeholder={t('dashboard.aio.glossary.sourcePlaceholder')}
              onChange={(event) =>
                commit(draft.map((row, rowIndex) =>
                  rowIndex === index ? { ...row, source: event.target.value } : row,
                ))
              }
            />
            <input
              className="koma-input koma-input--sm"
              value={term.target}
              placeholder={t('dashboard.aio.glossary.targetPlaceholder')}
              onChange={(event) =>
                commit(draft.map((row, rowIndex) =>
                  rowIndex === index ? { ...row, target: event.target.value } : row,
                ))
              }
            />
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              aria-label={t('dashboard.aio.glossary.remove')}
              onClick={() => commit(draft.filter((_, rowIndex) => rowIndex !== index))}
            >
              ×
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        className="koma-btn koma-btn--ghost koma-btn--sm"
        onClick={() => setDraft([...draft, { source: '', target: '' }])}
      >
        {t('dashboard.aio.glossary.add')}
      </button>
      <p className="koma-aio-hint">{t('dashboard.aio.glossary.hint')}</p>
    </div>
  );
});

AioGlossaryEditor.displayName = 'AioGlossaryEditor';
