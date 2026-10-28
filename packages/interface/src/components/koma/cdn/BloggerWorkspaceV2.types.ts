import type { BloggerUploadResult } from '@/types';

import type { QueueItemStatus } from './CdnV2Primitives';

export type BloggerWorkspaceTab =
  | 'publish'
  | 'upload';

export type BloggerEditorView =
  | 'visual'
  | 'html'
  | 'preview';

export interface BloggerWorkspaceProps {
  onOpenSettings?: () => void;
}

export interface UploadDraftItem {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
  status: QueueItemStatus;
  result: BloggerUploadResult | null;
  error: string | null;
}
