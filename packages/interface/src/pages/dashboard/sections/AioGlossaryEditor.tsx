import { memo, useRef, useState } from 'react';

import { useI18n } from '@/i18n';
import { clampGlossary, type GlossaryTerm } from '../../../utils/glossary';

interface AioGlossaryEditorProps {
  glossary: GlossaryTerm[];
  onChange: (next: GlossaryTerm[]) => void;
}

interface GlossaryDraftRow {
  id: number;
  term: GlossaryTerm;
}

const glossaryEquals = (a: GlossaryTerm[], b: GlossaryTerm[]): boolean =>
  a.length === b.length &&
  a.every((term, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      term.source === other.source &&
      term.target === other.target &&
      term.never_translate === other.never_translate
    );
  });

export const AioGlossaryEditor = memo(({ glossary, onChange }: AioGlossaryEditorProps) => {
  const { t } = useI18n();
  const nextRowIdRef = useRef(0);
  // Draft rows may be incomplete; only complete pairs reach the store.
  const [draft, setDraft] = useState<GlossaryDraftRow[]>(() =>
    glossary.map((term) => ({ id: nextRowIdRef.current++, term })),
  );
  const [syncedGlossary, setSyncedGlossary] = useState<GlossaryTerm[]>(glossary);

  // Resync only when the prop changes for a reason other than this editor's own commit;
  // comparing by content keeps an unstable-ref-but-identical prop from looping the sync.
  if (!glossaryEquals(glossary, syncedGlossary)) {
    if (!glossaryEquals(glossary, clampGlossary(draft.map((row) => row.term)))) {
      setDraft(glossary.map((term) => ({ id: nextRowIdRef.current++, term })));
    }
    setSyncedGlossary(glossary);
  }

  const commit = (next: GlossaryDraftRow[]): void => {
    setDraft(next);
    onChange(clampGlossary(next.map((row) => row.term)));
  };

  return (
    <div className="koma-aio-llm-panel">
      <span className="koma-field__label">{t('dashboard.aio.glossary.title')}</span>
      {draft.length === 0 ? (
        <p className="koma-aio-hint">{t('dashboard.aio.glossary.empty')}</p>
      ) : (
        draft.map((row) => (
          <div key={row.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="koma-input koma-input--sm"
              value={row.term.source}
              placeholder={t('dashboard.aio.glossary.sourcePlaceholder')}
              onChange={(event) =>
                commit(
                  draft.map((candidate) =>
                    candidate.id === row.id
                      ? { ...candidate, term: { ...candidate.term, source: event.target.value } }
                      : candidate,
                  ),
                )
              }
            />
            <input
              className="koma-input koma-input--sm"
              value={row.term.target}
              placeholder={t('dashboard.aio.glossary.targetPlaceholder')}
              onChange={(event) =>
                commit(
                  draft.map((candidate) =>
                    candidate.id === row.id
                      ? { ...candidate, term: { ...candidate.term, target: event.target.value } }
                      : candidate,
                  ),
                )
              }
            />
            <label
              className="koma-aio-hint"
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
            >
              <input
                type="checkbox"
                checked={row.term.never_translate}
                onChange={(event) =>
                  commit(
                    draft.map((candidate) =>
                      candidate.id === row.id
                        ? {
                            ...candidate,
                            term: { ...candidate.term, never_translate: event.target.checked },
                          }
                        : candidate,
                    ),
                  )
                }
              />
              {t('dashboard.aio.glossary.neverTranslate')}
            </label>
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              aria-label={t('dashboard.aio.glossary.remove')}
              onClick={() => commit(draft.filter((candidate) => candidate.id !== row.id))}
            >
              ×
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        className="koma-btn koma-btn--ghost koma-btn--sm"
        onClick={() =>
          setDraft([...draft, { id: nextRowIdRef.current++, term: { source: '', target: '', never_translate: false } }])
        }
      >
        {t('dashboard.aio.glossary.add')}
      </button>
      <p className="koma-aio-hint">{t('dashboard.aio.glossary.hint')}</p>
    </div>
  );
});

AioGlossaryEditor.displayName = 'AioGlossaryEditor';
