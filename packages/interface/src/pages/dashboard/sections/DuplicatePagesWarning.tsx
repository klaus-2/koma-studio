import { useMemo, useState } from 'react';

import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/utils';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useImportDuplicatesStore } from '../stores/import-duplicates-store';

import './DuplicatePagesWarning.css';

type PendingImport = NonNullable<
  ReturnType<typeof useImportDuplicatesStore.getState>['pending']
>;

/**
 * Two-phase import confirm dialog: when an import batch matches pages already
 * in the library (or pages within the same batch), the batch is held in the
 * duplicates store and the user chooses per page whether to keep both or
 * ignore the new copy. Confirming resumes the interrupted import without the
 * ignored pages.
 */
export default function DuplicatePagesWarning() {
  const pending = useImportDuplicatesStore((s) => s.pending);
  if (!pending) {
    return null;
  }
  return <DuplicatePagesWarningDialog pending={pending} />;
}

function DuplicatePagesWarningDialog({ pending }: { pending: PendingImport }) {
  const { t } = useI18n();
  const images = useImageCollectionStore((s) => s.images);
  const [ignoredIndices, setIgnoredIndices] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );

  const thumbnailById = useMemo(() => {
    const byId = new Map<string, string | null>();
    for (const image of images) {
      byId.set(image.id, image.thumbnailUrl || image.url || null);
    }
    return byId;
  }, [images]);

  const toggleIgnored = (importIndex: number): void => {
    setIgnoredIndices((prev) => {
      const next = new Set(prev);
      if (next.has(importIndex)) {
        next.delete(importIndex);
      } else {
        next.add(importIndex);
      }
      return next;
    });
  };

  const handleConfirm = (): void => {
    const keptImages = pending.images.filter(
      (_, index) => !ignoredIndices.has(index),
    );
    setIgnoredIndices(new Set<number>());
    pending.resume(keptImages);
  };

  return (
    <div
      className="koma-dupes__overlay"
      role="dialog"
      aria-label={t('dashboard.import.duplicates.aria')}
    >
      <div className="koma-dupes__panel">
        <h2 className="koma-dupes__title">
          {t('dashboard.import.duplicates.title')}
        </h2>
        <p className="koma-dupes__desc">
          {t('dashboard.import.duplicates.desc')}
        </p>
        <ul className="koma-dupes__list">
          {pending.matches.map((match) => {
            const importImage = pending.images[match.importIndex];
            const pageName = importImage?.file.name ?? '';
            const thumbnailUrl = match.existingImageId
              ? (thumbnailById.get(match.existingImageId) ?? null)
              : null;
            const isIgnored = ignoredIndices.has(match.importIndex);
            return (
              <li
                key={match.importIndex}
                className={cn('koma-dupes__row', isIgnored && 'is-ignored')}
              >
                {thumbnailUrl ? (
                  <div
                    className="koma-dupes__thumb"
                    style={{ backgroundImage: `url(${thumbnailUrl})` }}
                  />
                ) : (
                  <div className="koma-dupes__thumbText">{pageName}</div>
                )}
                <span className="koma-dupes__name">{pageName}</span>
                <div className="koma-dupes__actions">
                  <button
                    type="button"
                    className={cn(
                      'koma-dupes__choiceButton',
                      !isIgnored && 'is-active',
                    )}
                    onClick={() => toggleIgnored(match.importIndex)}
                  >
                    {t('dashboard.import.duplicates.keepBoth')}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'koma-dupes__choiceButton',
                      isIgnored && 'is-active',
                    )}
                    onClick={() => toggleIgnored(match.importIndex)}
                  >
                    {t('dashboard.import.duplicates.ignore')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="koma-dupes__confirm"
          onClick={handleConfirm}
        >
          {t('dashboard.import.duplicates.add')}
        </button>
      </div>
    </div>
  );
}
