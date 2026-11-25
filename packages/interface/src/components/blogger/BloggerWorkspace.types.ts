import type { BloggerUploadResult } from '../../types';

export interface BloggerWorkspaceProps {
  openSettingsOnIntegrationsTab?: () => void;
}

export interface UploadDraftItem {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
  status: 'queued' | 'processing' | 'uploaded' | 'error';
  result: BloggerUploadResult | null;
  error: string | null;
}
