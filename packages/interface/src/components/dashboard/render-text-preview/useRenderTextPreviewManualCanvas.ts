// Manual canvas pipeline for RenderTextPreview: paint layer, healing mask,
// segment brush strokes and the magic-wand mask overlay animation.
// Moved verbatim from RenderTextPreview.tsx (T07 split); hook order preserved.
// Note: the preset-submenu reset effect logically belongs to the context-menu
// cluster but sits here to preserve the original hook order.

import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { LoadedImage } from '../../../types/dashboard.types';
import {
  clamp,
  loadImageFromSource,
  maskCanvasHasVisibleContent,
} from '../../../utils/dashboard.utils';
import {
  computeWandMaskFrames,
  createWandFrameCanvas,
} from './canvasDrawing';

interface UseRenderTextPreviewManualCanvasParams {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  paintCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  healingMaskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  wandMaskOverlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  segBrushCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  segBrushLastRef: React.RefObject<{ x: number; y: number } | null>;
  segBrushDataUrlRef: React.RefObject<string | null>;
  wandMaskAnimationTimerRef: React.RefObject<number | null>;
  wandMaskSelectedRef: React.RefObject<Uint8Array | null>;
  image: LoadedImage;
  manualPaintLayerDataUrl: string | null;
  manualWandMaskDataUrl: string | null;
  onManualPaintLayerChange: (nextLayer: string | null) => void;
  onManualHealingMaskCommit: (maskDataUrl: string) => Promise<void>;
  contextSubmenu: 'presets' | null;
  setPresetSearch: (next: string) => void;
  setPresetFolderFilter: (next: string | null) => void;
}

export const useRenderTextPreviewManualCanvas = ({
  overlayRef,
  paintCanvasRef,
  healingMaskCanvasRef,
  wandMaskOverlayCanvasRef,
  segBrushCanvasRef,
  segBrushLastRef,
  segBrushDataUrlRef,
  wandMaskAnimationTimerRef,
  wandMaskSelectedRef,
  image,
  manualPaintLayerDataUrl,
  manualWandMaskDataUrl,
  onManualPaintLayerChange,
  onManualHealingMaskCommit,
  contextSubmenu,
  setPresetSearch,
  setPresetFolderFilter,
}: UseRenderTextPreviewManualCanvasParams) => {
  const toImagePoint = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const node = overlayRef.current;
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const normalizedX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const normalizedY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const rotation = ((image.rotation % 360) + 360) % 360;
      let localX = normalizedX;
      let localY = normalizedY;
      if (rotation === 90) {
        localX = 1 - normalizedY;
        localY = normalizedX;
      } else if (rotation === 180) {
        localX = 1 - normalizedX;
        localY = 1 - normalizedY;
      } else if (rotation === 270) {
        localX = normalizedY;
        localY = 1 - normalizedX;
      }
      const isSideways = rotation === 90 || rotation === 270;
      const scaleX = isSideways
        ? image.width / rect.height
        : image.width / rect.width;
      const scaleY = isSideways
        ? image.height / rect.width
        : image.height / rect.height;
      return {
        x: localX * image.width,
        y: localY * image.height,
        scale: Math.max(scaleX, scaleY),
      };
    },
    [image.height, image.rotation, image.width],
  );

  const drawSegBrushOnCanvas = useCallback(
    (x: number, y: number, radius: number, erase: boolean) => {
      const canvas = segBrushCanvasRef.current;
      const container = overlayRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scaleX = canvas.width / image.width;
      const scaleY = canvas.height / image.height;
      const r = Math.max(1, radius * scaleX);
      const cx = x * scaleX;
      const cy = y * scaleY;
      const last = segBrushLastRef.current;
      ctx.save();
      if (erase) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(248,113,113,0.55)';
        ctx.strokeStyle = 'rgba(248,113,113,0.55)';
      }
      if (last) {
        ctx.lineWidth = r * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x * scaleX, last.y * scaleY);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      segBrushLastRef.current = { x, y };
    },
    [image.width, image.height],
  );

  const redrawSegBrushCanvas = useCallback(() => {
    const canvas = segBrushCanvasRef.current;
    const container = overlayRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const newW = Math.round(rect.width);
    const newH = Math.round(rect.height);
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, newW, newH);
    const savedUrl = segBrushDataUrlRef.current;
    if (!savedUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, newW, newH);
    img.src = savedUrl;
  }, []);

  const commitPaintLayer = useCallback(() => {
    const paintCanvas = paintCanvasRef.current;
    if (!paintCanvas) return;
    const hasContent = maskCanvasHasVisibleContent(paintCanvas);
    if (!hasContent) {
      onManualPaintLayerChange(null);
      return;
    }
    onManualPaintLayerChange(paintCanvas.toDataURL('image/png'));
  }, [onManualPaintLayerChange]);

  const clearHealingMaskCanvas = useCallback(() => {
    const maskCanvas = healingMaskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, []);

  const commitHealingMask = useCallback(() => {
    const maskCanvas = healingMaskCanvasRef.current;
    if (!maskCanvas) return;
    if (!maskCanvasHasVisibleContent(maskCanvas)) {
      clearHealingMaskCanvas();
      return;
    }
    const maskDataUrl = maskCanvas.toDataURL('image/png');
    void onManualHealingMaskCommit(maskDataUrl).finally(() => {
      clearHealingMaskCanvas();
    });
  }, [clearHealingMaskCanvas, onManualHealingMaskCommit]);

  const stopWandMaskAnimation = useCallback(() => {
    if (wandMaskAnimationTimerRef.current !== null) {
      cancelAnimationFrame(wandMaskAnimationTimerRef.current);
      wandMaskAnimationTimerRef.current = null;
    }
  }, []);

  // Pause wand mask animation when the component is off-screen to save GPU/CPU.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          stopWandMaskAnimation();
        }
      },
      { threshold: 0.01 },
    );
    observer.observe(overlay);
    return () => {
      observer.disconnect();
      stopWandMaskAnimation();
    };
  }, [stopWandMaskAnimation]);

  useEffect(() => {
    if (contextSubmenu !== 'presets') {
      setPresetSearch('');
      setPresetFolderFilter(null);
    }
  }, [contextSubmenu]);

  useEffect(() => {
    const paintCanvas = paintCanvasRef.current;
    if (!paintCanvas) return;
    paintCanvas.width = image.width;
    paintCanvas.height = image.height;
    const ctx = paintCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    if (!manualPaintLayerDataUrl) return;
    let cancelled = false;
    void loadImageFromSource(manualPaintLayerDataUrl)
      .then((layerImage) => {
        if (cancelled) return;
        ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
        ctx.drawImage(layerImage, 0, 0, paintCanvas.width, paintCanvas.height);
      })
      .catch(() => {
        if (cancelled) return;
        ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
      });
    return () => {
      cancelled = true;
    };
  }, [image.height, image.width, manualPaintLayerDataUrl]);

  useEffect(() => {
    const maskCanvas = healingMaskCanvasRef.current;
    if (!maskCanvas) return;
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, [image.height, image.width]);

  useEffect(() => {
    const overlayCanvas = wandMaskOverlayCanvasRef.current;
    if (!overlayCanvas) return;
    overlayCanvas.width = image.width;
    overlayCanvas.height = image.height;
    const overlayCtx = overlayCanvas.getContext('2d', { willReadFrequently: true });
    if (!overlayCtx) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }, [image.height, image.width]);

  useEffect(() => {
    const overlayCanvas = wandMaskOverlayCanvasRef.current;
    if (!overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext('2d', { willReadFrequently: true });
    if (!overlayCtx) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!manualWandMaskDataUrl) return;
    let cancelled = false;
    void loadImageFromSource(manualWandMaskDataUrl)
      .then((maskImage) => {
        if (cancelled) return;

        const frames = computeWandMaskFrames(overlayCanvas, overlayCtx, maskImage);
        if (!frames) return;

        wandMaskSelectedRef.current = frames.selected;

        const frameCanvasA = createWandFrameCanvas(frames.frameA);
        const frameCanvasB = createWandFrameCanvas(frames.frameB);
        overlayCtx.drawImage(frameCanvasA, 0, 0);
        let useFrameA = false;
        const ANIMATION_INTERVAL_MS = 120;
        let lastFrameTime = 0;
        const animate = (timestamp: number) => {
          if (cancelled) return;
          if (timestamp - lastFrameTime >= ANIMATION_INTERVAL_MS) {
            overlayCtx.drawImage(useFrameA ? frameCanvasA : frameCanvasB, 0, 0);
            useFrameA = !useFrameA;
            lastFrameTime = timestamp;
          }
          wandMaskAnimationTimerRef.current = requestAnimationFrame(animate);
        };
        wandMaskAnimationTimerRef.current = requestAnimationFrame(animate);
      })
      .catch(() => {
        if (cancelled) return;
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      });

    return () => {
      cancelled = true;
      stopWandMaskAnimation();
      wandMaskSelectedRef.current = null;
    };
  }, [image.height, image.width, manualWandMaskDataUrl, stopWandMaskAnimation]);

  return {
    toImagePoint,
    drawSegBrushOnCanvas,
    redrawSegBrushCanvas,
    commitPaintLayer,
    commitHealingMask,
    stopWandMaskAnimation,
  };
};
