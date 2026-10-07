import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Layers3, Lock, Plus, RefreshCcw, Scissors, Trash2, Unlock, ZoomIn, ZoomOut } from 'lucide-react';
import { buildProcessedCanvasForImage } from '../splitter/splitterUtils';
import type { SplitterController } from '../splitter/useSplitterController';
import type { SplitterSegmentPreview } from '../splitter/types';
import { useI18n } from '../../../i18n';
import { WsPanel, StatCard, ToolBtn, InfoNote } from '../../noir-panels/NoirPrimitives';

interface SplitterWorkspaceProps {
  controller: SplitterController;
}

interface SegmentThumb {
  id: string;
  src: string;
  aspectRatio: number;
}

/* ── Stable segment thumb generator (avoids rebuilding canvas per render) ── */
const generateSegmentThumbs = async (
  canvas: HTMLCanvasElement,
  segments: SplitterSegmentPreview[],
  axis: 'vertical' | 'horizontal',
  maxThumbs = 12,
): Promise<SegmentThumb[]> => {
  const thumbs: SegmentThumb[] = [];
  const sliced = segments.slice(0, maxThumbs);
  for (const segment of sliced) {
    const thumbCanvas = document.createElement('canvas');
    if (axis === 'vertical') {
      const h = Math.max(1, segment.end - segment.start);
      thumbCanvas.width = canvas.width;
      thumbCanvas.height = h;
      const ctx = thumbCanvas.getContext('2d');
      if (ctx) ctx.drawImage(canvas, 0, segment.start, canvas.width, h, 0, 0, canvas.width, h);
      thumbs.push({ id: segment.id, src: thumbCanvas.toDataURL('image/png'), aspectRatio: canvas.width / h });
    } else {
      const w = Math.max(1, segment.end - segment.start);
      thumbCanvas.width = w;
      thumbCanvas.height = canvas.height;
      const ctx = thumbCanvas.getContext('2d');
      if (ctx) ctx.drawImage(canvas, segment.start, 0, w, canvas.height, 0, 0, w, canvas.height);
      thumbs.push({ id: segment.id, src: thumbCanvas.toDataURL('image/png'), aspectRatio: w / canvas.height });
    }
  }
  return thumbs;
};

export const SplitterWorkspaceNoir = ({ controller }: SplitterWorkspaceProps) => {
  const { t } = useI18n();
  const {
    activeImage,
    activeImageState,
    activeRecipe,
    analyzeActiveImage,
    addCutToActive,
    removeActiveCut,
    toggleActiveCutLock,
    mergeActiveSegments,
  } = controller;

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const [segmentThumbs, setSegmentThumbs] = useState<SegmentThumb[]>([]);
  const [zoom, setZoom] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const dragCutRef = useRef<string | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeImageIdRef = useRef<string | null>(null);

  /* Stable refs for values used in event handlers to avoid re-attaching listeners */
  const controllerRef = useRef(controller);
  controllerRef.current = controller;

  /* ── Build preview image (only when activeImage changes) ── */
  useEffect(() => {
    let cancelled = false;
    if (!activeImage) {
      setPreviewSrc((current) => {
        if (current && current.startsWith('blob:')) URL.revokeObjectURL(current);
        return null;
      });
      setPreviewSize(null);
      setSegmentThumbs([]);
      processedCanvasRef.current = null;
      activeImageIdRef.current = null;
      return;
    }

    /* Only rebuild when image identity actually changes */
    if (activeImageIdRef.current === activeImage.id && processedCanvasRef.current) {
      return;
    }

    activeImageIdRef.current = activeImage.id;

    const run = async () => {
      const canvas = await buildProcessedCanvasForImage(activeImage);
      if (cancelled) return;
      processedCanvasRef.current = canvas;
      setPreviewSize({ width: canvas.width, height: canvas.height });
      setPreviewSrc(canvas.toDataURL('image/png'));
    };
    void run();

    return () => { cancelled = true; };
  }, [activeImage]);

  /* ── Generate segment thumbnails (debounced to avoid flickering) ── */
  const segmentsDigest = useMemo(() => {
    const analysis = activeImageState?.analysis;
    if (!analysis) return '';
    return analysis.segments.map(s => `${s.id}:${s.start}-${s.end}`).join('|');
  }, [activeImageState?.analysis]);

  useEffect(() => {
    if (!segmentsDigest) {
      setSegmentThumbs([]);
      return;
    }

    let cancelled = false;
    /* Use a small delay to debounce rapid cut-drag updates */
    const timer = setTimeout(async () => {
      const ctrl = controllerRef.current;
      const analysis = ctrl.activeImageState?.analysis;
      const image = ctrl.activeImage;
      if (!image || !analysis || analysis.segments.length === 0) return;

      let canvas = processedCanvasRef.current;
      if (!canvas) {
        canvas = await buildProcessedCanvasForImage(image);
        if (cancelled) return;
        processedCanvasRef.current = canvas;
      }
      const thumbs = await generateSegmentThumbs(canvas, analysis.segments, ctrl.activeRecipe.axis);
      if (!cancelled) setSegmentThumbs(thumbs);
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentsDigest]);

  /* ── Auto-analyze on first load ──
     Uses activeImage.id as dependency (primitive) instead of activeImage (object).
     Reads volatile values from controllerRef to avoid re-triggering the effect. */
  const activeImageIdForEffect = activeImage?.id ?? null;
  useEffect(() => {
    if (!activeImageIdForEffect) return;
    const ctrl = controllerRef.current;
    const state = ctrl.activeImageState;
    if (
      !state?.analysis
      && state?.status !== 'analyzing'
      && ctrl.activeRecipe.strategy !== 'manual'
    ) {
      void ctrl.analyzeActiveImage(false).catch(() => { });
    }
    // Only fire when the active image identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImageIdForEffect]);

  /* ── Cut line drag handling ──
     Attached once and reads latest values from refs — never reattaches. */
  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!dragCutRef.current || !previewStageRef.current) return;
      const ctrl = controllerRef.current;
      if (!ctrl.activeImageState?.analysis) return;
      const rect = previewStageRef.current.getBoundingClientRect();
      const axis = ctrl.activeRecipe.axis;
      const ratio = axis === 'vertical'
        ? (event.clientY - rect.top) / rect.height
        : (event.clientX - rect.left) / rect.width;
      const el = previewStageRef.current.querySelector('.koma-split-stage__img') as HTMLImageElement | null;
      if (!el) return;
      const axisLength = axis === 'vertical' ? el.naturalHeight : el.naturalWidth;
      ctrl.moveActiveCut(dragCutRef.current, ratio * axisLength);
    };
    const handlePointerUp = () => {
      dragCutRef.current = null;
    };
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, []); // Stable — never reattaches

  const currentAnalysis = activeImageState?.analysis ?? null;
  const isAnalyzing = activeImageState?.status === 'analyzing';

  const primaryAxisLength = useMemo(() => {
    if (!previewSize) return 1;
    return activeRecipe.axis === 'vertical' ? previewSize.height : previewSize.width;
  }, [activeRecipe.axis, previewSize]);

  /* ── Zoom helpers with CSS zoom (layout-aware) ── */
  const handleZoomIn = useCallback(() => {
    setZoom(c => Math.min(3, Number((c + 0.15).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(c => Math.max(0.2, Number((c - 0.15).toFixed(2))));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  /* ── Wheel zoom on preview ── */
  useEffect(() => {
    const el = previewStageRef.current?.parentElement;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(c => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.min(3, Math.max(0.2, Number((c + delta).toFixed(2))));
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [activeImageIdForEffect]);

  if (!activeImage) {
    return (
      <div className="flex min-h-[420px] items-center justify-center font-display text-paper">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center panel-cut bg-crimson/8 text-crimson"><Scissors size={30} /></span>
          <p className="font-display text-sm font-bold uppercase tracking-tight">{t('splitter.workspace.emptyTitle')}</p>
          <p className="max-w-xs font-mono text-[10.5px] text-paper-dim">{t('splitter.workspace.emptyDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-display text-paper">
      {/* HERO: Preview + Diagnostics */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Preview */}
        <WsPanel accent="crimson" className="flex flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-paper/8 p-4">
            <div>
              <span className="kicker flex items-center gap-1.5">
                <Scissors size={11} /> // {t('splitter.workspace.previewTitle')}
                {isAnalyzing && <span className="stamp !py-0 !text-[8px] animate-blink">{t('splitter.workspace.analyzing')}</span>}
              </span>
              <p className="mt-1 font-mono text-[10px] text-paper-dim">{t('splitter.workspace.previewDescription')}</p>
            </div>
          </div>

          <div className="halftone relative flex min-h-[440px] flex-1 items-start justify-center overflow-auto bg-ink/50 p-6">
            <div ref={previewStageRef} className="relative" style={{ zoom }}
              onDoubleClick={(e) => {
                if (!previewStageRef.current || !previewSize) return;
                const rect = previewStageRef.current.getBoundingClientRect();
                const ratio = activeRecipe.axis === 'vertical' ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
                void addCutToActive(ratio * primaryAxisLength);
              }}>
              {previewSrc && (
                <img src={previewSrc} alt={t('splitter.workspace.previewAlt', { name: activeImage.file.name })} className="koma-split-stage__img block panel-cut-sm border border-paper/10 shadow-[6px_6px_0_rgba(0,0,0,0.4)]" />
              )}

              {/* Segment bands */}
              {previewSrc && showOverlay && currentAnalysis && currentAnalysis.segments.map((seg, idx) => {
                const startPct = `${(seg.start / primaryAxisLength) * 100}%`;
                const sizePct = `${(seg.size / primaryAxisLength) * 100}%`;
                const isSelected = selectedSegmentId === seg.id;
                return (
                  <div key={seg.id}
                    className={`absolute cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-crimson/5' : 'bg-azure/5'} ${isSelected ? '!bg-crimson/20 ring-1 ring-crimson' : ''}`}
                    style={activeRecipe.axis === 'vertical' ? { top: startPct, height: sizePct, left: 0, right: 0 } : { left: startPct, width: sizePct, top: 0, bottom: 0 }}
                    onClick={() => setSelectedSegmentId(isSelected ? null : seg.id)}>
                    <span className="absolute left-1 top-1 panel-cut-sm bg-ink/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-crimson">S{idx + 1}</span>
                  </div>
                );
              })}

              {/* Cut lines */}
              {previewSrc && showOverlay && currentAnalysis && (
                <div className="pointer-events-none absolute inset-0">
                  {currentAnalysis.cuts.map((cut, idx) => {
                    const pos = `${(cut.position / primaryAxisLength) * 100}%`;
                    const isV = activeRecipe.axis === 'vertical';
                    return (
                      <button key={cut.id} type="button"
                        className={`pointer-events-auto absolute ${isV ? 'left-0 right-0 h-0.5 cursor-row-resize' : 'top-0 bottom-0 w-0.5 cursor-col-resize'} ${cut.locked ? 'bg-gold' : 'bg-crimson'}`}
                        style={isV ? { top: pos } : { left: pos }}
                        onMouseDown={() => { if (!cut.locked) dragCutRef.current = cut.id; }}
                        title={t('splitter.workspace.cutTitle', { index: idx + 1 })}>
                        <span className={`absolute ${isV ? 'left-2 -top-2.5' : 'top-2 left-1'} panel-cut-sm bg-ink px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${cut.locked ? 'text-gold' : 'text-crimson'}`}>
                          #{idx + 1} · {Math.round(cut.score * 100)}%{cut.locked ? ' 🔒' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-paper/8 p-3">
            <ToolBtn onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={12} /></ToolBtn>
            <ToolBtn onClick={handleZoomReset} title="Reset zoom">{Math.round(zoom * 100)}%</ToolBtn>
            <ToolBtn onClick={handleZoomIn} title="Zoom In"><ZoomIn size={12} /></ToolBtn>
            <span className="mx-1 h-5 w-px bg-paper/10" aria-hidden="true" />
            <ToolBtn active={showOverlay} onClick={() => setShowOverlay((c) => !c)}>
              {showOverlay ? <EyeOff size={12} /> : <Eye size={12} />} {showOverlay ? t('splitter.workspace.hide') : t('splitter.workspace.show')}
            </ToolBtn>
            <ToolBtn onClick={() => void analyzeActiveImage(true)} disabled={isAnalyzing}>
              <RefreshCcw size={12} className={isAnalyzing ? 'animate-spin' : ''} /> {t('splitter.workspace.recalculate')}
            </ToolBtn>
            {previewSize && <span className="ml-auto font-mono text-[10px] text-paper-dim">{previewSize.width} × {previewSize.height}px</span>}
          </div>
        </WsPanel>

        {/* Diagnostics */}
        <WsPanel accent="azure" className="flex flex-col">
          <div className="border-b border-paper/8 p-4">
            <span className="kicker !text-azure flex items-center gap-1.5"><Layers3 size={11} /> // {t('splitter.workspace.diagnostics')}</span>
          </div>
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard value={currentAnalysis?.diagnostics.engine ?? '—'} label={t('splitter.workspace.engine')} tone="gold" />
              <StatCard value={currentAnalysis?.cuts.length ?? 0} label={t('splitter.workspace.cuts')} />
              <StatCard value={currentAnalysis?.segments.length ?? 0} label={t('splitter.workspace.segments')} tone="mint" />
              <StatCard value={currentAnalysis?.diagnostics.whitespaceCandidates ?? 0} label={t('splitter.workspace.whitespace')} />
            </div>

            {previewSize && (
              <div className="glass panel-cut-sm space-y-1.5 border-l-2 border-l-paper/20 p-3">
                {[
                  [t('splitter.workspace.dimensions'), `${previewSize.width} × ${previewSize.height}`],
                  [t('splitter.workspace.axis'), activeRecipe.axis],
                  [t('splitter.workspace.strategy'), activeRecipe.strategy],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between font-mono text-[10.5px]">
                    <span className="uppercase tracking-wider text-crimson/80">{k}</span>
                    <span className="text-paper">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {(currentAnalysis?.warnings.length ?? 0) > 0 ? (
              currentAnalysis?.warnings.map((w) => (<InfoNote key={w} icon={AlertTriangle} tone="gold" role="alert">{t(w as any)}</InfoNote>))
            ) : (
              <InfoNote icon={Eye} tone="mint">{t('splitter.workspace.noWarnings')}</InfoNote>
            )}
          </div>
        </WsPanel>
      </div>

      {/* CUTS */}
      {currentAnalysis && currentAnalysis.cuts.length > 0 && (
        <WsPanel accent="crimson">
          <div className="border-b border-paper/8 p-4">
            <span className="kicker flex items-center gap-1.5"><Scissors size={11} /> // {t('splitter.workspace.cutsTitle', { count: currentAnalysis.cuts.length })}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3" style={{ scrollbarWidth: 'thin' }}>
            {currentAnalysis.cuts.map((cut, idx) => (
              <div key={cut.id} className={`panel-cut-sm flex w-52 shrink-0 items-center gap-2.5 border p-2.5 ${cut.locked ? 'border-gold/50 bg-gold/8' : 'border-paper/10 bg-ink'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center panel-cut-sm font-display text-[11px] font-black ${cut.locked ? 'bg-gold/20 text-gold' : 'bg-crimson/15 text-crimson'}`}>#{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[11px] font-bold uppercase tracking-tight">{t('splitter.workspace.cutCard', { index: idx + 1 })}</div>
                  <p className="font-mono text-[9px] text-paper-dim">{Math.round(cut.position)}px · {Math.round(cut.score * 100)}% · {cut.source}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <ToolBtn onClick={() => toggleActiveCutLock(cut.id)} title={cut.locked ? 'Unlock' : 'Lock'}>{cut.locked ? <Lock size={10} /> : <Unlock size={10} />}</ToolBtn>
                  <ToolBtn onClick={() => removeActiveCut(cut.id)} title="Remove"><Trash2 size={10} /></ToolBtn>
                  <ToolBtn onClick={() => mergeActiveSegments(idx)} title="Merge"><Layers3 size={10} /></ToolBtn>
                </div>
              </div>
            ))}
          </div>
        </WsPanel>
      )}

      {/* SEGMENTS */}
      {currentAnalysis && currentAnalysis.segments.length > 0 && (
        <WsPanel accent="mint">
          <div className="border-b border-paper/8 p-4">
            <span className="kicker !text-mint flex items-center gap-1.5"><Plus size={11} /> // {t('splitter.workspace.segmentsTitle', { count: currentAnalysis.segments.length })}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3" style={{ scrollbarWidth: 'thin' }}>
            {currentAnalysis.segments.map((seg, idx) => {
              const thumb = segmentThumbs.find((th) => th.id === seg.id);
              const isSelected = selectedSegmentId === seg.id;
              return (
                <div key={seg.id} onClick={() => setSelectedSegmentId(isSelected ? null : seg.id)}
                  className={`panel-cut-sm w-40 shrink-0 cursor-pointer space-y-2 border p-2 transition-all duration-200 ${isSelected ? 'border-crimson/60 bg-crimson/8 -translate-y-0.5' : seg.warning ? 'border-gold/40 bg-gold/5' : 'border-paper/10 bg-ink hover:border-paper/25'
                    }`}>
                  <div className="flex items-center justify-between">
                    <span className="panel-cut-sm bg-mint/15 px-2 py-0.5 font-display text-[10px] font-black text-mint">S{idx + 1}</span>
                  </div>
                  {thumb ? (
                    <img src={thumb.src} alt={t('splitter.workspace.segmentAlt', { index: idx + 1 })} className="w-full panel-cut-sm border border-paper/10" style={{ aspectRatio: `${thumb.aspectRatio}` }} />
                  ) : (
                    <div className="w-full animate-pulse panel-cut-sm bg-paper/5" style={{ aspectRatio: '3/4' }} />
                  )}
                  <div>
                    <div className="truncate font-display text-[10px] font-bold uppercase tracking-tight">{t('splitter.workspace.segmentCard', { index: idx + 1 })}</div>
                    <p className="font-mono text-[8.5px] text-paper-dim">{seg.start}–{seg.end}px · {seg.size}px</p>
                    {seg.warning && <p className="font-mono text-[8.5px] text-gold">{seg.warning}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </WsPanel>
      )}
    </div>
  );
};

export default SplitterWorkspaceNoir;
