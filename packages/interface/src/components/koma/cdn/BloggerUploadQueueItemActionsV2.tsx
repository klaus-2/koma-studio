import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  X,
} from 'lucide-react';

import { useI18n } from '@/i18n';

import type { UploadDraftItem } from './BloggerWorkspaceV2.types';

interface BloggerUploadQueueItemActionsV2Props {
  item: UploadDraftItem;
  copiedToken: string | null;
  handleCopyResult: (token: string, value: string) => Promise<void>;
  handleRemoveDraft: (draftId: string) => void;
}

export function BloggerUploadQueueItemActionsV2({
  item,
  copiedToken,
  handleCopyResult,
  handleRemoveDraft,
}: BloggerUploadQueueItemActionsV2Props) {
  const { t } = useI18n();

  return (
    <div className="relative z-10 flex flex-row gap-1 border-t border-paper/[0.065] p-3 md:flex-col md:border-l md:border-t-0">
      {item.result ? (
        <>
          <button
            type="button"
            className="btn-ghost !min-h-9 !px-3 !py-2"
            onClick={() =>
              void handleCopyResult(
                `${item.id}:canonical`,
                item
                  .result
                  ?.canonicalUrl ??
                '',
              )
            }
          >
            {copiedToken ===
              `${item.id}:canonical` ? (
              <Check
                size={
                  13
                }
              />
            ) : (
              <Copy
                size={
                  13
                }
              />
            )}

            {t(
              'blogger.queue.url',
            )}
          </button>

          <button
            type="button"
            className="btn-ghost !min-h-9 !px-3 !py-2"
            disabled={
              !item.result
                .optimizedUrl
            }
            onClick={() =>
              void handleCopyResult(
                `${item.id}:optimized`,
                item
                  .result
                  ?.optimizedUrl ??
                '',
              )
            }
          >
            {copiedToken ===
              `${item.id}:optimized` ? (
              <Check
                size={
                  13
                }
              />
            ) : (
              <ExternalLink
                size={
                  13
                }
              />
            )}

            {t(
              'blogger.queue.opt',
            )}
          </button>

          <button
            type="button"
            className="btn-ghost !min-h-9 !px-3 !py-2"
            onClick={() =>
              void handleCopyResult(
                `${item.id}:tag`,
                item
                  .result
                  ?.imageTag ??
                '',
              )
            }
          >
            {copiedToken ===
              `${item.id}:tag` ? (
              <Check
                size={
                  13
                }
              />
            ) : (
              <Link2
                size={
                  13
                }
              />
            )}

            {t(
              'blogger.queue.img',
            )}
          </button>
        </>
      ) : null}

      <button
        type="button"
        className="panel-cut-sm mt-auto inline-flex min-h-9 items-center justify-center gap-2 border border-crimson/25 bg-crimson/[0.045] px-3 font-mono text-[0.6rem] font-bold uppercase text-crimson transition hover:border-crimson hover:bg-crimson hover:text-ink"
        onClick={() =>
          handleRemoveDraft(
            item.id,
          )
        }
      >
        <X size={13} />
        {t(
          'common.remove',
        )}
      </button>
    </div>
  );
}
