import { memo, useMemo, useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';

import { useI18n } from '../../../i18n';
import { clampGlossary, type GlossaryTerm } from '../../../utils/glossary';
import {
  DIRECT_IMAGES_CHAPTER_ID,
  groupImagesIntoAioChapters,
} from '../lib/aio-chapters';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useWorksStore, type WorkRecord } from '../stores/works-store';
import { AioChecklistOption, aioPanelClasses } from './AioRightPanel.skin';

interface WorkGlossaryEditorProps {
  noir: boolean;
}

interface GlossaryDraftRow {
  id: number;
  term: GlossaryTerm;
}

interface EditorChapter {
  /** Assignment key stored in the works registry. */
  readonly key: string;
  /** Displayed label (the sidebar's localized label for the direct group). */
  readonly label: string;
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

// SKIN-AGNOSTIC section (noir-prop mechanism, aioPanelClasses — no Classic/Noir
// twins): the per-work glossary registry. Work identity + chapter assignment
// live in the works store; the term rows clone the AioGlossaryEditor draft
// pattern and chapters reuse the labels assigned to loaded images by the
// existing sidebar chapter tooling.
export const WorkGlossaryEditor = memo(({ noir }: WorkGlossaryEditorProps) => {
  const { t } = useI18n();
  const classes = aioPanelClasses(noir);
  const works = useWorksStore((s) => s.works);
  const createWork = useWorksStore((s) => s.createWork);
  const renameWork = useWorksStore((s) => s.renameWork);
  const deleteWork = useWorksStore((s) => s.deleteWork);
  const assignChapterToWork = useWorksStore((s) => s.assignChapterToWork);
  const setWorkTerms = useWorksStore((s) => s.setWorkTerms);
  const images = useImageCollectionStore((s) => s.images);

  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [newWorkName, setNewWorkName] = useState('');

  const chapters = useMemo<EditorChapter[]>(
    () =>
      groupImagesIntoAioChapters(images).map((group) => ({
        key:
          group.id === DIRECT_IMAGES_CHAPTER_ID
            ? DIRECT_IMAGES_CHAPTER_ID
            : group.label,
        label:
          group.id === DIRECT_IMAGES_CHAPTER_ID
            ? t('dashboard.sidebar.chapters.unassigned')
            : group.label,
      })),
    [images, t],
  );

  const selectedWork = works.find((work) => work.id === selectedWorkId) ?? null;
  const selectedTerms = selectedWork?.terms ?? [];

  // Draft rows may be incomplete; only complete pairs reach the store. Same
  // content-compared resync as AioGlossaryEditor, keyed on the selected work's
  // committed terms.
  const nextRowIdRef = useRef(0);
  const [draft, setDraft] = useState<GlossaryDraftRow[]>(() =>
    selectedTerms.map((term) => ({ id: nextRowIdRef.current++, term })),
  );
  const [syncedTerms, setSyncedTerms] = useState<GlossaryTerm[]>(selectedTerms);

  if (!glossaryEquals(selectedTerms, syncedTerms)) {
    if (!glossaryEquals(selectedTerms, clampGlossary(draft.map((row) => row.term)))) {
      setDraft(selectedTerms.map((term) => ({ id: nextRowIdRef.current++, term })));
    }
    setSyncedTerms(selectedTerms);
  }

  const inputClass = noir
    ? 'panel-cut-sm min-w-0 flex-1 border border-paper/12 bg-ink px-2.5 py-2 font-mono text-[11px] text-paper placeholder:text-paper/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson'
    : 'koma-input koma-input--sm';
  const rowInputClass = noir ? inputClass : 'koma-input koma-input--sm';
  const iconButtonClass = noir
    ? 'grid h-5 w-5 shrink-0 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink'
    : 'koma-iconbtn koma-iconbtn--xs';

  const commitTerms = (next: GlossaryDraftRow[]): void => {
    setDraft(next);
    if (selectedWork) {
      setWorkTerms(selectedWork.id, clampGlossary(next.map((row) => row.term)));
    }
  };

  const handleCreateWork = (): void => {
    const id = createWork(newWorkName);
    if (id === null) {
      return;
    }
    setNewWorkName('');
    setSelectedWorkId(id);
  };

  const handleRenameWork = (work: WorkRecord): void => {
    const requested = window.prompt(t('dashboard.aio.works.renamePrompt'), work.name);
    const nextName = requested?.trim();
    if (!nextName || nextName === work.name) {
      return;
    }
    renameWork(work.id, nextName);
  };

  const handleDeleteWork = (work: WorkRecord): void => {
    if (!window.confirm(t('dashboard.aio.works.removeConfirm', { name: work.name }))) {
      return;
    }
    deleteWork(work.id);
    if (selectedWorkId === work.id) {
      setSelectedWorkId(null);
    }
  };

  return (
    <div className="koma-aio-llm-panel">
      <span className={classes.label}>{t('dashboard.aio.works.title')}</span>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          className={inputClass}
          value={newWorkName}
          placeholder={t('dashboard.aio.works.namePlaceholder')}
          onChange={(event) => setNewWorkName(event.target.value)}
        />
        <button
          type="button"
          className={classes.ghostButton}
          disabled={newWorkName.trim().length === 0}
          onClick={handleCreateWork}
        >
          {t('dashboard.aio.works.add')}
        </button>
      </div>

      {works.length === 0 ? (
        <p className={classes.hint}>{t('dashboard.aio.works.empty')}</p>
      ) : (
        works.map((work) => (
          <div
            key={work.id}
            style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}
          >
            <button
              type="button"
              className={
                work.id === selectedWorkId
                  ? classes.primaryButton
                  : classes.ghostButton
              }
              style={{ minWidth: 0, flex: 1, textAlign: 'left' }}
              aria-pressed={work.id === selectedWorkId}
              onClick={() =>
                setSelectedWorkId(work.id === selectedWorkId ? null : work.id)
              }
            >
              {work.name}
            </button>
            <button
              type="button"
              className={iconButtonClass}
              aria-label={t('dashboard.aio.works.rename')}
              title={t('dashboard.aio.works.rename')}
              onClick={() => handleRenameWork(work)}
            >
              <Pencil size={10} />
            </button>
            <button
              type="button"
              className={iconButtonClass}
              aria-label={t('dashboard.aio.works.remove')}
              title={t('dashboard.aio.works.remove')}
              onClick={() => handleDeleteWork(work)}
            >
              <X size={11} />
            </button>
          </div>
        ))
      )}

      {selectedWork ? (
        <>
          <span className={classes.label}>{t('dashboard.aio.works.termsTitle')}</span>
          {draft.length === 0 ? (
            <p className={classes.hint}>{t('dashboard.aio.glossary.empty')}</p>
          ) : (
            draft.map((row) => (
              <div
                key={row.id}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                <input
                  className={rowInputClass}
                  value={row.term.source}
                  placeholder={t('dashboard.aio.glossary.sourcePlaceholder')}
                  onChange={(event) =>
                    commitTerms(
                      draft.map((candidate) =>
                        candidate.id === row.id
                          ? { ...candidate, term: { ...candidate.term, source: event.target.value } }
                          : candidate,
                      ),
                    )
                  }
                />
                <input
                  className={rowInputClass}
                  value={row.term.target}
                  placeholder={t('dashboard.aio.glossary.targetPlaceholder')}
                  onChange={(event) =>
                    commitTerms(
                      draft.map((candidate) =>
                        candidate.id === row.id
                          ? { ...candidate, term: { ...candidate.term, target: event.target.value } }
                          : candidate,
                      ),
                    )
                  }
                />
                <AioChecklistOption
                  noir={noir}
                  checked={row.term.never_translate}
                  label={t('dashboard.aio.glossary.neverTranslate')}
                  onChange={(checked) =>
                    commitTerms(
                      draft.map((candidate) =>
                        candidate.id === row.id
                          ? {
                              ...candidate,
                              term: { ...candidate.term, never_translate: checked },
                            }
                          : candidate,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className={classes.ghostButton}
                  aria-label={t('dashboard.aio.glossary.remove')}
                  onClick={() =>
                    commitTerms(draft.filter((candidate) => candidate.id !== row.id))
                  }
                >
                  ×
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            className={classes.ghostButton}
            onClick={() =>
              setDraft([
                ...draft,
                {
                  id: nextRowIdRef.current++,
                  term: { source: '', target: '', never_translate: false },
                },
              ])
            }
          >
            {t('dashboard.aio.glossary.add')}
          </button>

          <span className={classes.label}>{t('dashboard.aio.works.chaptersTitle')}</span>
          {chapters.length === 0 ? (
            <p className={classes.hint}>{t('dashboard.aio.works.chaptersEmpty')}</p>
          ) : (
            chapters.map((chapter) => (
              <AioChecklistOption
                key={chapter.key}
                noir={noir}
                checked={selectedWork.chapterLabels.includes(chapter.key)}
                label={chapter.label}
                onChange={(checked) =>
                  assignChapterToWork(
                    chapter.key,
                    checked ? selectedWork.id : null,
                  )
                }
              />
            ))
          )}
        </>
      ) : (
        works.length > 0 && (
          <p className={classes.hint}>{t('dashboard.aio.works.selectHint')}</p>
        )
      )}

      <p className={classes.hint}>{t('dashboard.aio.works.hint')}</p>
    </div>
  );
});

WorkGlossaryEditor.displayName = 'WorkGlossaryEditor';
