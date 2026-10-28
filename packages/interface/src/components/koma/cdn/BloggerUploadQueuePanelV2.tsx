import { m, AnimatePresence } from 'framer-motion';
import { FileImage } from 'lucide-react';

import { useI18n } from '@/i18n';

import type { UploadDraftItem } from './BloggerWorkspaceV2.types';
import { BloggerUploadQueueItemV2 } from './BloggerUploadQueueItemV2';
import {
  EditorialCdnPanel,
  EmptyQueue,
  KOMA_EASE,
} from './CdnV2Primitives';

interface BloggerUploadQueuePanelV2Props {
  uploadDrafts: UploadDraftItem[];
  queuedDrafts: UploadDraftItem[];
  completedDrafts: UploadDraftItem[];
  reduceMotion: boolean | null;
  copiedToken: string | null;
  handleDraftAltChange: (draftId: string, value: string) => void;
  handleCopyResult: (token: string, value: string) => Promise<void>;
  handleRemoveDraft: (draftId: string) => void;
}

export function BloggerUploadQueuePanelV2({
  uploadDrafts,
  queuedDrafts,
  completedDrafts,
  reduceMotion,
  copiedToken,
  handleDraftAltChange,
  handleCopyResult,
  handleRemoveDraft,
}: BloggerUploadQueuePanelV2Props) {
  const { t } = useI18n();

  return (
    <EditorialCdnPanel
      index="02"
      icon={FileImage}
      kicker="Asset manifest"
      title={t(
        'blogger.queue.title',
      )}
      description={t(
        'blogger.queue.items',
        {
          count:
            uploadDrafts.length,
        },
      )}
      action={
        uploadDrafts.length > 0 ? (
          <div className="flex gap-2">
            <span className="stamp !border-gold/45 !bg-gold/10 !text-gold">
              {queuedDrafts.length}{' '}
              pending
            </span>

            <span className="stamp !border-mint/45 !bg-mint/10 !text-mint">
              {
                completedDrafts.length
              }{' '}
              ready
            </span>
          </div>
        ) : null
      }
    >
      {uploadDrafts.length === 0 ? (
        <EmptyQueue
          message={t(
            'blogger.queue.empty',
          )}
        />
      ) : (
        <m.div
          layout
          className="grid gap-3 p-4"
        >
          <AnimatePresence initial={false}>
            {uploadDrafts.map(
              (item, index) => (
                <m.article
                  layout
                  key={item.id}
                  initial={
                    reduceMotion
                      ? false
                      : {
                        opacity: 0,
                        y: 14,
                      }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    x: 20,
                  }}
                  transition={{
                    duration:
                      reduceMotion
                        ? 0
                        : 0.35,
                    ease: KOMA_EASE,
                  }}
                  className="offset-card panel-cut-sm relative overflow-hidden border border-paper/10 bg-ink/48"
                >
                  <BloggerUploadQueueItemV2
                    item={item}
                    index={index}
                    copiedToken={copiedToken}
                    handleDraftAltChange={handleDraftAltChange}
                    handleCopyResult={handleCopyResult}
                    handleRemoveDraft={handleRemoveDraft}
                  />
                </m.article>
              ),
            )}
          </AnimatePresence>
        </m.div>
      )}
    </EditorialCdnPanel>
  );
}
