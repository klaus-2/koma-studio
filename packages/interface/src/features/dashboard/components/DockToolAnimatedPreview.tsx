import React, { useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { KOMA_TOOL_MEDIA, type DockToolPreviewKind } from '../../../assets/koma-motion';

export type { DockToolPreviewKind };

export interface DockToolAnimatedPreviewProps {
  kind: DockToolPreviewKind;
  variant?: 'noir' | 'classic';
  size?: 'tooltip' | 'card';

  playMode?: 'always' | 'hover';
  className?: string;
  label?: string;
}

const isJsdomEnv = (): boolean =>
  typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

function ToolVideoLayer({ src }: { src: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      onLoadedData={() => setReady(true)}
      onCanPlay={() => setReady(true)}
      onError={() => setFailed(true)}
      className="pointer-events-none absolute inset-0 block h-full w-full object-cover transition-opacity duration-150"
      style={{ opacity: ready ? 1 : 0 }}
    />
  );
}

export const DockToolAnimatedPreview: React.FC<DockToolAnimatedPreviewProps> = React.memo(
  ({ kind, variant = 'noir', size = 'tooltip', playMode = 'always', className, label }) => {
    const prefersReducedMotion = useReducedMotion() === true;
    const [hovered, setHovered] = useState(false);
    const asset = KOMA_TOOL_MEDIA[variant][kind];
    const shouldPlayVideo =
      !prefersReducedMotion && !isJsdomEnv() && (playMode === 'always' || hovered);
    const cornerStroke = variant === 'noir' ? '#ff2e63' : '#a855f7';
    const frameStroke =
      variant === 'noir' ? 'rgba(242, 237, 227, 0.16)' : 'rgba(168, 85, 247, 0.24)';

    return (
      <div
        className={[
          'koma-dock-svg-preview',
          size === 'card' ? 'koma-dock-svg-preview--card' : 'koma-dock-svg-preview--tooltip',
          prefersReducedMotion ? 'koma-dock-svg--paused' : '',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-preview-kind={kind}
        data-preview-variant={variant}
        data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
        onMouseEnter={playMode === 'hover' ? () => setHovered(true) : undefined}
        onMouseLeave={playMode === 'hover' ? () => setHovered(false) : undefined}
      >
        <img
          src={asset.poster}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="pointer-events-none absolute inset-0 block h-full w-full object-cover"
        />

        {shouldPlayVideo && <ToolVideoLayer key={asset.webm} src={asset.webm} />}

        <svg
          viewBox="0 0 220 116"
          className="koma-dock-svg-preview__svg pointer-events-none absolute inset-0"
          role={label ? 'img' : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : true}
        >
          <rect
            x={0.75}
            y={0.75}
            width={218.5}
            height={114.5}
            rx={variant === 'noir' ? 0 : 6}
            fill="none"
            stroke={frameStroke}
            strokeWidth={1.2}
          />
          {variant === 'noir' && (
            <g stroke={cornerStroke} strokeWidth={1.4} fill="none" opacity={0.72}>
              <path d="M 2 10 L 2 2 L 10 2" />
              <path d="M 210 2 L 218 2 L 218 10" />
              <path d="M 2 106 L 2 114 L 10 114" />
              <path d="M 210 114 L 218 114 L 218 106" />
            </g>
          )}
        </svg>
      </div>
    );
  },
);

DockToolAnimatedPreview.displayName = 'DockToolAnimatedPreview';

export default DockToolAnimatedPreview;
