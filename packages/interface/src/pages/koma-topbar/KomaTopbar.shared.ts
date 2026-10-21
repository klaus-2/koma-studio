import type { LucideIcon } from 'lucide-react';

import type { ToolMode } from '../../types/dashboard.types';

export type { ToolMode };

export type ViewMode = 'paginated' | 'long_strip';
export type DropdownId = 'production' | 'utils' | 'info' | 'download' | 'user' | null;
export type DownloadBundleFormat = 'pdf' | 'cbz' | 'cb7' | 'zip';
export type PsdCompression = 'rle' | 'zip' | 'raw';

export interface NavItem {
  mode: ToolMode;
  icon: LucideIcon;
  label: string;
  subtitle: string;
  tooltip: string;
  hasSubMode?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  groupIcon: LucideIcon;
}

const UNDER_DEVELOPMENT_MODES: ToolMode[] = ['raw', 'proofreader'];

export function isModeUnderDevelopment(mode: ToolMode) {
  return UNDER_DEVELOPMENT_MODES.includes(mode);
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
