import {
  FileImage,
  Save,
  Send,
  Tags,
} from 'lucide-react';

import type { BloggerUploadResult } from '@/types';
import { useI18n } from '@/i18n';

import {
  CdnMetric,
  EditorialCdnHero,
} from './CdnV2Primitives';

interface BloggerWorkspaceHeroV2Props {
  configReady: boolean;
  uploadedItems: BloggerUploadResult[];
  publishLabelPreview: string[];
  publishLive: boolean;
}

export function BloggerWorkspaceHeroV2({
  configReady,
  uploadedItems,
  publishLabelPreview,
  publishLive,
}: BloggerWorkspaceHeroV2Props) {
  const { t } = useI18n();

  return (
    <EditorialCdnHero
      index="03"
      eyebrow={t('blogger.title')}
      title={t('blogger.heroTitle')}
      accentWord="press"
      description={t(
        'blogger.heroDescription',
      )}
      serviceCode="Blogger / Editorial"
      statusReady={configReady}
      statusText={
        configReady
          ? t('blogger.ready')
          : t(
            'blogger.configureInSettings',
          )
      }
    >
      <CdnMetric
        icon={FileImage}
        value={uploadedItems.length}
        label="Media"
        tone="crimson"
      />

      <CdnMetric
        icon={Tags}
        value={
          publishLabelPreview.length
        }
        label="Labels"
        tone="gold"
      />

      <CdnMetric
        icon={publishLive ? Send : Save}
        value={
          publishLive
            ? t(
              'blogger.post.publishNow',
            )
            : t('blogger.post.draft')
        }
        label="Mode"
        tone={
          publishLive
            ? 'mint'
            : 'azure'
        }
      />
    </EditorialCdnHero>
  );
}
