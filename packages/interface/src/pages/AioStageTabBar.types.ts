import type { LucideIcon } from 'lucide-react';

export type StageTabKey =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage'
  | 'render';

export interface StageTabDef {
  key: StageTabKey;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
}
