import React, { useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import {
  KOMA_STAGE_MEDIA,
  type AioStageDemoKind,
} from '../../../assets/koma-motion';

export interface AioStageAnimatedPreviewProps {
  stage: AioStageDemoKind;
  variant?: 'noir' | 'classic';
  label?: string;
  className?: string;
}

const isJsdomEnv = (): boolean =>
  typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

function StageVideoLayer({ src }: { src: string }) {
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

export const AioStageAnimatedPreview: React.FC<AioStageAnimatedPreviewProps> = React.memo(
  ({ stage, variant = 'noir', label, className = '' }) => {
    const prefersReducedMotion = useReducedMotion() === true;
    const asset = KOMA_STAGE_MEDIA[variant][stage];
    const allowVideo = !prefersReducedMotion && !isJsdomEnv();

    return (
      <div
        className={`relative aspect-[440/232] w-full overflow-hidden ${
          variant === 'noir'
            ? 'panel-cut-sm border border-paper/15 bg-ink'
            : 'rounded-xl border border-purple-400/20 bg-[#080b18]'
        } ${className}`.trim()}
        data-stage-preview={stage}
        role={label ? 'img' : undefined}
        aria-label={label}
      >
        <img
          src={asset.poster}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="pointer-events-none absolute inset-0 block h-full w-full object-cover"
        />
        {allowVideo && <StageVideoLayer key={asset.webm} src={asset.webm} />}
      </div>
    );
  },
);

AioStageAnimatedPreview.displayName = 'AioStageAnimatedPreview';
export default AioStageAnimatedPreview;
