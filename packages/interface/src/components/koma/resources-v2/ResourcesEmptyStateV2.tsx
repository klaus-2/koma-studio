'use client';

import { useI18n } from '@/i18n';

import {
  ResourceEmptyState,
} from './ResourceV2Primitives';

interface Props {
  query: string;
  context: string;
}

export default function ResourcesEmptyStateV2({
  query,
  context,
}: Props) {
  const { t } = useI18n();

  return (
    <ResourceEmptyState
      query={query}
      title={
        query
          ? t(
              'resources.empty.title.withQuery',
              { query },
            )
          : t(
              'resources.empty.title.noQuery',
            )
      }
      description={
        query
          ? t(
              'resources.empty.desc.withQuery',
              { context },
            )
          : t(
              'resources.empty.desc.noQuery',
              { context },
            )
      }
    />
  );
}
