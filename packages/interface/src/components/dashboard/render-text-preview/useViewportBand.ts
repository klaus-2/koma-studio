import { useEffect, useState } from 'react';

import { visibleRegionIds, type ViewportBand } from './canvasDrawing';

interface UseViewportBandArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageHeight: number;
  zoom: number;
}

export const useViewportBand = ({
  canvasRef,
  imageHeight,
  zoom,
}: UseViewportBandArgs): ViewportBand | null => {
  const [band, setBand] = useState<ViewportBand | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = canvas.closest('.koma-stage');
    if (!stage) return;

    let raf = 0;
    const measure = (): void => {
      raf = 0;
      const canvasRect = canvas.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const displayHeight = canvasRect.height;
      const imagePerDisplay =
        displayHeight > 0 ? imageHeight / displayHeight : 1;
      const topInImage = (stageRect.top - canvasRect.top) * imagePerDisplay;
      const bottomInImage =
        (stageRect.bottom - canvasRect.top) * imagePerDisplay;
      const viewportImageSpan = stageRect.height * imagePerDisplay;
      const nextBand = {
        top: Math.max(0, topInImage - viewportImageSpan),
        bottom: Math.min(imageHeight, bottomInImage + viewportImageSpan),
      };
      setBand(nextBand);
    };

    const coalesced = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    stage.addEventListener('scroll', coalesced, { passive: true });
    window.addEventListener('resize', coalesced, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      stage.removeEventListener('scroll', coalesced);
      window.removeEventListener('resize', coalesced);
    };
  }, [canvasRef, imageHeight, zoom]);

  return band;
};

interface UseViewportCullArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageHeight: number;
  zoom: number;
}

export const useViewportCull = ({
  canvasRef,
  imageHeight,
  zoom,
}: UseViewportCullArgs): ViewportBand | null =>
  useViewportBand({ canvasRef, imageHeight, zoom });

export const overlayVisibleSet = (
  regions: Parameters<typeof visibleRegionIds>[0],
  band: ViewportBand | null,
): ReadonlySet<string> | undefined => visibleRegionIds(regions, band);
