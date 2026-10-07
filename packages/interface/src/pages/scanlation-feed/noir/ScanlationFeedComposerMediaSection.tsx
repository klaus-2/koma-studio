'use client';

import { ImagePlus } from 'lucide-react';

import { useI18n } from '../../../i18n';
import { ComposerSection } from './ScanlationFeedPrimitives';
import type { FeedPostMediaItem } from '../../../services/scanlationFeed';

type Props = {
  mediaItems: FeedPostMediaItem[];
  uploading: boolean;
  onUploadMedia: (files: FileList | null) => void;
};

export default function ScanlationFeedComposerMediaSection({
  mediaItems, uploading, onUploadMedia,
}: Props) {
  const { t } = useI18n();

  return (
    <ComposerSection icon={ImagePlus} label={t('feed.composer.sections.media')}>
      <label className="noir-dropzone flex cursor-pointer items-center justify-center gap-2 p-4 font-mono text-[10px] uppercase tracking-[0.14em] text-crimson/80">
        <ImagePlus size={14} />
        {uploading ? t('feed.composer.media.uploading') : t('feed.composer.media.uploadBtn')}
        <input type="file" multiple accept="image/*" onChange={(e) => onUploadMedia(e.target.files)} hidden />
      </label>
      {mediaItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mediaItems.map((m) => (
            <div key={m.id} className="panel-cut-sm border border-paper/12">
              <img src={m.directUrl} alt={m.altText} className="h-24 w-auto object-cover" />
              <div className="truncate px-2 py-1 font-mono text-[9px] text-paper/45">
                {m.fileName}
              </div>
            </div>
          ))}
        </div>
      )}
    </ComposerSection>
  );
}
