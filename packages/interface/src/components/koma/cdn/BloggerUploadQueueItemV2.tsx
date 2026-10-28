import { useI18n } from '@/i18n';

import type { UploadDraftItem } from './BloggerWorkspaceV2.types';
import { BloggerUploadQueueItemActionsV2 } from './BloggerUploadQueueItemActionsV2';
import {
  formatFileSize,
  QueueStatusBadge,
} from './CdnV2Primitives';

interface BloggerUploadQueueItemV2Props {
  item: UploadDraftItem;
  index: number;
  copiedToken: string | null;
  handleDraftAltChange: (draftId: string, value: string) => void;
  handleCopyResult: (token: string, value: string) => Promise<void>;
  handleRemoveDraft: (draftId: string) => void;
}

export function BloggerUploadQueueItemV2({
  item,
  index,
  copiedToken,
  handleDraftAltChange,
  handleCopyResult,
  handleRemoveDraft,
}: BloggerUploadQueueItemV2Props) {
  const { t } = useI18n();

  return (
    <>
      <span
        className="text-outline pointer-events-none absolute right-4 top-0 font-display text-6xl font-black leading-none"
        aria-hidden="true"
      >
        {String(
          index + 1,
        ).padStart(2, '0')}
      </span>

      <div className="grid md:grid-cols-[112px_minmax(0,1fr)_auto]">
        <div className="relative min-h-32 overflow-hidden bg-ink">
          <img
            src={
              item.previewUrl
            }
            alt={item.altText}
            className="absolute inset-0 size-full object-cover"
          />

          <div
            className="absolute inset-0 bg-gradient-to-t from-ink/75 to-transparent"
            aria-hidden="true"
          />

          <span className="absolute bottom-2 left-2 font-mono text-[0.56rem] text-paper/65">
            {formatFileSize(
              item.file
                .size,
            )}
          </span>
        </div>

        <div className="relative z-10 min-w-0 space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-12">
            <div className="min-w-0">
              <span className="kicker block text-[0.55rem]">
                CDN asset
              </span>

              <strong className="mt-1 block truncate font-mono text-xs text-paper">
                {item.file.name}
              </strong>
            </div>

            <QueueStatusBadge
              status={
                item.status
              }
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-paper/32">
              {t(
                'blogger.queue.altText',
              )}
            </span>

            <input
              className="koma-control"
              value={
                item.altText
              }
              disabled={
                item.status ===
                'processing'
              }
              onChange={(
                event,
              ) =>
                handleDraftAltChange(
                  item.id,
                  event.target
                    .value,
                )
              }
              placeholder={t(
                'blogger.queue.altText',
              )}
            />
          </label>

          {item.result ? (
            <div className="grid gap-2 xl:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-[0.1em] text-paper/30">
                  {t(
                    'blogger.queue.canonical',
                  )}
                </span>

                <input
                  readOnly
                  value={
                    item.result
                      .canonicalUrl
                  }
                  className="koma-control !font-mono !text-[0.62rem]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-[0.1em] text-paper/30">
                  {t(
                    'blogger.queue.optimized',
                  )}
                </span>

                <input
                  readOnly
                  value={
                    item.result
                      .optimizedUrl ??
                    ''
                  }
                  className="koma-control !font-mono !text-[0.62rem]"
                />
              </label>
            </div>
          ) : null}

          {item.error ? (
            <p
              role="alert"
              className="border-l-2 border-crimson bg-crimson/[0.055] px-3 py-2 text-xs leading-5 text-crimson panel-cut-sm"
            >
              {item.error}
            </p>
          ) : null}
        </div>

        <BloggerUploadQueueItemActionsV2
          item={item}
          copiedToken={copiedToken}
          handleCopyResult={handleCopyResult}
          handleRemoveDraft={handleRemoveDraft}
        />
      </div>
    </>
  );
}
