import type {
  Dispatch,
  SetStateAction,
} from 'react';

import {
  NotebookPen,
  Save,
  Send,
} from 'lucide-react';

import { useI18n } from '@/i18n';

import {
  EditorialCdnPanel,
  KomaSwitchCard,
} from './CdnV2Primitives';

interface BloggerPostMetadataPanelV2Props {
  postTitle: string;
  setPostTitle: Dispatch<SetStateAction<string>>;
  defaultLabels: string;
  setDefaultLabels: Dispatch<SetStateAction<string>>;
  postLabelsInput: string;
  setPostLabelsInput: Dispatch<SetStateAction<string>>;
  publishLive: boolean;
  setPublishLive: Dispatch<SetStateAction<boolean>>;
  publishLabelPreview: string[];
}

export function BloggerPostMetadataPanelV2({
  postTitle,
  setPostTitle,
  defaultLabels,
  setDefaultLabels,
  postLabelsInput,
  setPostLabelsInput,
  publishLive,
  setPublishLive,
  publishLabelPreview,
}: BloggerPostMetadataPanelV2Props) {
  const { t } = useI18n();

  return (
    <EditorialCdnPanel
      index="01"
      icon={NotebookPen}
      kicker="Post metadata"
      title={t(
        'blogger.post.title',
      )}
      description={t(
        'blogger.post.description',
      )}
      sticky
    >
      <div className="space-y-5 p-4 sm:p-5">
        <label className="block">
          <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/45">
            {t(
              'blogger.post.postTitle',
            )}
          </span>

          <input
            className="koma-control"
            value={postTitle}
            onChange={(event) =>
              setPostTitle(
                event.target.value,
              )
            }
            placeholder={t(
              'blogger.post.postTitlePlaceholder',
            )}
          />
        </label>

        <label className="block">
          <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/45">
            {t(
              'blogger.post.defaultLabels',
            )}
          </span>

          <input
            className="koma-control"
            value={defaultLabels}
            onChange={(event) =>
              setDefaultLabels(
                event.target.value,
              )
            }
            placeholder={t(
              'blogger.post.defaultLabelsPlaceholder',
            )}
          />
        </label>

        <label className="block">
          <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/45">
            {t(
              'blogger.post.postLabels',
            )}
          </span>

          <input
            className="koma-control"
            value={postLabelsInput}
            onChange={(event) =>
              setPostLabelsInput(
                event.target.value,
              )
            }
            placeholder={t(
              'blogger.post.postLabelsPlaceholder',
            )}
          />
        </label>

        <KomaSwitchCard
          checked={publishLive}
          onChange={setPublishLive}
          title={
            publishLive
              ? t(
                'blogger.post.publishNow',
              )
              : t(
                'blogger.post.draft',
              )
          }
          icon={
            publishLive
              ? Send
              : Save
          }
          tone={
            publishLive
              ? 'crimson'
              : 'azure'
          }
        />

        {publishLabelPreview.length >
          0 ? (
          <div className="border-t border-paper/[0.065] pt-4">
            <span className="mb-3 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-paper/32">
              Active taxonomy
            </span>

            <div className="flex flex-wrap gap-2">
              {publishLabelPreview.map(
                (label, index) => (
                  <span
                    key={`${label}-${index}`}
                    className="stamp !border-paper/15 !bg-paper/[0.035] !text-paper/52"
                  >
                    #{label}
                  </span>
                ),
              )}
            </div>
          </div>
        ) : null}
      </div>
    </EditorialCdnPanel>
  );
}
