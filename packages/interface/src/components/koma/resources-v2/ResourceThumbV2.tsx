import {
  BookOpen,
  Brush,
  Download,
  Globe,
  Languages,
  Layers,
  ScanLine,
  Sparkles,
  Upload,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { getResourceIcon } from '@/assets/resources';
import type {
  ToolboxStage,
} from '@/data/guides-types';

const STAGE_ICON: Record<
  ToolboxStage,
  LucideIcon
> = {
  rippers: Download,
  cleaning: Brush,
  upscaling: Sparkles,
  typesetting: Layers,
  assets: ScanLine,
  publishing: Upload,
  translation: Languages,
  reference: BookOpen,
  utilities: Wrench,
};

interface Props {
  image?: string;
  stage?: ToolboxStage;
  fallback?: LucideIcon;
  size?: number;
  className?: string;
}

export default function ResourceThumbV2({
  image,
  stage,
  fallback,
  size = 44,
  className = '',
}: Props) {
  const source = getResourceIcon(image);
  const [failed, setFailed] = useState(false);

  const Icon =
    fallback ??
    (stage ? STAGE_ICON[stage] : Globe);

  if (source && !failed) {
    return (
      <img
        src={source}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() =>
          setFailed(true)
        }
        className={[
          'shrink-0 rounded-sm object-contain',
          className,
        ].join(' ')}
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
      />
    );
  }

  return (
    <span
      className={[
        'grid shrink-0 place-items-center border border-paper/10 bg-paper/[0.04] text-paper/45',
        className,
      ].join(' ')}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.42)} />
    </span>
  );
}

export { STAGE_ICON };
