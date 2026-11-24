import { useEffect, useRef } from 'react';
import loginBackgroundVideo from '@koma/ui/assets/login-background.mp4';
import loginBackgroundPoster from '@koma/ui/assets/login-background-poster.webp';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { useBackdropVideoStore } from '@/pages/dashboard/stores/backdrop-video-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useDecorativeMediaDelay } from '../auth/useDecorativeMediaDelay';
import './DashboardBackdrop.css';

const isPlayInterruption = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export default function DashboardBackdrop() {
  const noir = useThemeStore((s) => s.family === 'noir');
  const hasImages = useImageCollectionStore((state) => state.images.length > 0);
  const alwaysPaused = useBackdropVideoStore((state) => state.alwaysPaused);
  const paused = hasImages || alwaysPaused;
  const showVideo = useDecorativeMediaDelay();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    video.play().catch((error: unknown) => {
      if (isPlayInterruption(error)) return;
      throw error;
    });
  }, [paused, showVideo, noir]);

  if (!noir) {
    return (
      <>
        <div className="koma-dash__bg" aria-hidden="true" />
        <div className="koma-dash__halftone" aria-hidden="true" />
      </>
    );
  }

  return (
    <>
      <div className="koma-dash__bg koma-dash-backdrop" aria-hidden="true">
        {showVideo ? (
          <video
            ref={videoRef}
            className="koma-bg-video koma-dash-backdrop__video"
            src={loginBackgroundVideo}
            poster={loginBackgroundPoster}
            loop
            muted
            playsInline
            preload="none"
          />
        ) : null}
        <div className="halftone koma-dash-backdrop__halftone" />
        <div className="koma-dash-backdrop__glow koma-dash-backdrop__glow--crimson" />
        <div className="koma-dash-backdrop__glow koma-dash-backdrop__glow--azure" />
        <span className="text-outline koma-dash-backdrop__wordmark">KOMA</span>
        <span className="v-text koma-dash-backdrop__vtext">コマ・スタジオ — 漫画工房 — 第二版</span>
        <span className="koma-dash-backdrop__sfx">ドドド!!</span>
      </div>
      <div className="koma-dash__halftone" aria-hidden="true" />
    </>
  );
}
