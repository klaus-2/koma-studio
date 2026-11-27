import React, { useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import {
  KOMA_MASCOT_MEDIA,
  isMascotClipPose,
} from '../../assets/koma-motion';
import type { KomaPose } from '../../stores/koma-mascot-store';
import { KomaNekoRig } from './KomaNekoRig';

export interface KomaNekoActorProps {
  pose?: KomaPose;
  size?: number;

  mode?: 'video' | 'interactive' | 'auto';
  gazeX?: number;
  gazeY?: number;
  className?: string;
  label?: string;
}

const isJsdomEnv = (): boolean =>
  typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

function MascotVideoLayer({
  src,
  label,
  onReady,
}: {
  src: string;
  label?: string;
  onReady: (ready: boolean) => void;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  const markReady = () => {
    setReady(true);
    onReady(true);
  };

  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onLoadedData={markReady}
      onCanPlay={markReady}
      onError={() => {
        setFailed(true);
        onReady(false);
      }}
      className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-150"
      style={{ opacity: ready ? 1 : 0 }}
    />
  );
}

export const KomaNekoActor: React.FC<KomaNekoActorProps> = React.memo(
  ({
    pose = 'idle',
    size = 96,
    mode = 'auto',
    gazeX = 0,
    gazeY = 0,
    className = '',
    label,
  }) => {
    const prefersReducedMotion = useReducedMotion() === true;
    const [videoReadyPose, setVideoReadyPose] = useState<string | null>(null);

    const useVideo =
      !prefersReducedMotion &&
      !isJsdomEnv() &&
      isMascotClipPose(pose) &&
      (mode === 'video' || (mode === 'auto' && gazeX === 0 && gazeY === 0));

    if (useVideo && isMascotClipPose(pose)) {
      const asset = KOMA_MASCOT_MEDIA[pose];
      const videoVisible = videoReadyPose === pose;
      return (
        <span
          className={`relative inline-flex items-center justify-center select-none ${className}`.trim()}
          style={{ width: size, height: size }}
          data-koma-pose={pose}
          data-koma-mode="video"
        >
          <img
            src={asset.poster}
            alt={label ?? ''}
            aria-hidden={label ? undefined : true}
            decoding="async"
            className="pointer-events-none h-full w-full object-contain transition-opacity duration-150"
            style={{ opacity: videoVisible ? 0 : 1 }}
          />
          <MascotVideoLayer
            key={asset.webm}
            src={asset.webm}
            label={label}
            onReady={(ready) => setVideoReadyPose(ready ? pose : null)}
          />
        </span>
      );
    }

    return (
      <KomaNekoRig
        pose={pose}
        size={size}
        gazeX={gazeX}
        gazeY={gazeY}
        className={className}
        label={label}
      />
    );
  },
);

KomaNekoActor.displayName = 'KomaNekoActor';
export default KomaNekoActor;
