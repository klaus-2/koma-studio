import type { BloggerUploadResult } from '@/types';

export const mergeUploadedItems = (
  current: BloggerUploadResult[],
  incoming: BloggerUploadResult[],
): BloggerUploadResult[] => {
  const next = new Map<
    string,
    BloggerUploadResult
  >();

  current.forEach((item) => {
    next.set(item.canonicalUrl, item);
  });

  incoming.forEach((item) => {
    next.set(item.canonicalUrl, item);
  });

  return Array.from(next.values());
};
