'use client';

import type {
  ResourceTab,
} from '@/data/guides-types';

import ResourcesPageV2 from './ResourcesPageV2';

interface Props {
  category: ResourceTab;
}

export default function ResourceCategoryDetailV2({
  category,
}: Props) {
  return (
    <ResourcesPageV2
      initialCategory={category}
      showTabs={false}
      showBackButton
    />
  );
}
