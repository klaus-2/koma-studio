import { ImagePlus } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { FeedPostMediaItem } from '../../services/scanlationFeed';

type ScanlationFeedComposerMediaSectionProps = {
  mediaItems: FeedPostMediaItem[];
  uploading: boolean;
  onUploadMedia: (files: FileList | null) => void;
};

export default function ScanlationFeedComposerMediaSection({
  mediaItems,
  uploading,
  onUploadMedia,
}: ScanlationFeedComposerMediaSectionProps) {
  const { t } = useI18n();

  return (
    <div className="koma-feed-csection">
      <div className="koma-feed-csection__head">
        <div className="koma-feed-csection__icon">
          <ImagePlus size={14} />
        </div>
        <div className="koma-feed-csection__label">
          {t('feed.composer.sections.media')}
        </div>
      </div>
      <label className="koma-feed-upload__btn">
        <ImagePlus size={14} />
        {uploading
          ? t('feed.composer.media.uploading')
          : t('feed.composer.media.uploadBtn')}
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => onUploadMedia(e.target.files)}
          hidden
        />
      </label>
      {mediaItems.length > 0 && (
        <div className="koma-feed-media">
          {mediaItems.map((item) => (
            <div key={item.id} className="koma-feed-media__item">
              <img
                className="koma-feed-media__img"
                src={item.directUrl}
                alt={item.altText}
              />
              <div className="koma-feed-media__name">{item.fileName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
