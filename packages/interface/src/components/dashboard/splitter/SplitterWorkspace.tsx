import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Layers3, Lock, Plus, RefreshCcw, Scissors, Trash2, Unlock, ZoomIn, ZoomOut } from 'lucide-react';
import './SplitterWorkspace.css';
import { buildProcessedCanvasForImage } from './splitterUtils';
import type { SplitterController } from './useSplitterController';
import type { SplitterSegmentPreview } from './types';
import { useI18n } from '../../../i18n';

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

export const SplitterWorkspace = ({ controller }: SplitterWorkspaceProps) => {
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

  /* Latest controller for effects/handlers — written in an effect (declared
     before the effects that read it), never during render. */
  const controllerRef = useRef(controller);
  useEffect(() => {
    controllerRef.current = controller;
  });

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
      void ctrl.analyzeActiveImage(false).catch(() => {});
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
      <div className="koma-split-ws">
        <div className="koma-split-ws__empty">
          <Scissors size={42} className="koma-split-ws__empty-icon" />
          <p className="koma-split-ws__empty-title">{t("splitter.workspace.emptyTitle")}</p>
          <p className="koma-split-ws__empty-desc">
            {t("splitter.workspace.emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="koma-split-ws">

      {/* ═══ Hero: Preview + Diagnostics ═══ */}
      <div className="koma-split-hero">

        {/* Preview */}
        <div className="koma-split-preview">
          <div className="koma-split-preview__head">
            <div className="koma-split-preview__title">
              <span className="koma-split-preview__title-icon" aria-hidden="true"><Scissors size={11} /></span>
              {t("splitter.workspace.previewTitle")}
              {isAnalyzing && <span className="koma-split-preview__badge koma-split-preview__badge--analyzing">{t("splitter.workspace.analyzing")}</span>}
            </div>
            <p className="koma-split-preview__desc">
              {t("splitter.workspace.previewDescription")}
            </p>
          </div>

          <div className="koma-split-stage-wrap">
            <div
              ref={previewStageRef}
              className="koma-split-stage"
              style={{ zoom }}
              onDoubleClick={(e) => {
                if (!previewStageRef.current || !previewSize) return;
                const rect = previewStageRef.current.getBoundingClientRect();
                const ratio = activeRecipe.axis === "vertical"
                  ? (e.clientY - rect.top) / rect.height
                  : (e.clientX - rect.left) / rect.width;
                void addCutToActive(ratio * primaryAxisLength);
              }}
            >
              {previewSrc && (
                <img src={previewSrc} alt={t("splitter.workspace.previewAlt", { name: activeImage.file.name })} className="koma-split-stage__img" />
              )}

              {/* Segment highlight bands */}
              {previewSrc && showOverlay && currentAnalysis && currentAnalysis.segments.map((seg, idx) => {
                const startPct = `${(seg.start / primaryAxisLength) * 100}%`;
                const sizePct = `${(seg.size / primaryAxisLength) * 100}%`;
                const isSelected = selectedSegmentId === seg.id;
                return (
                  <div
                    key={seg.id}
                    className={`koma-split-segment-band${idx % 2 === 0 ? ' koma-split-segment-band--even' : ' koma-split-segment-band--odd'}${isSelected ? ' koma-split-segment-band--selected' : ''}`}
                    style={activeRecipe.axis === 'vertical'
                      ? { top: startPct, height: sizePct, left: 0, right: 0 }
                      : { left: startPct, width: sizePct, top: 0, bottom: 0 }
                    }
                    onClick={() => setSelectedSegmentId(isSelected ? null : seg.id)}
                  >
                    <span className="koma-split-segment-band__label">S{idx + 1}</span>
                  </div>
                );
              })}

              {/* Cut lines */}
              {previewSrc && showOverlay && currentAnalysis && (
                <div className="koma-split-cut-map">
                  {currentAnalysis.cuts.map((cut, idx) => {
                    const pos = `${(cut.position / primaryAxisLength) * 100}%`;
                    return (
                      <button
                        key={cut.id}
                        type="button"
                        className={`koma-split-cut-line${activeRecipe.axis === "vertical" ? " koma-split-cut-line--v" : " koma-split-cut-line--h"}${cut.locked ? " koma-split-cut-line--locked" : ""}`}
                        style={activeRecipe.axis === "vertical" ? { top: pos } : { left: pos }}
                        onMouseDown={() => { if (!cut.locked) dragCutRef.current = cut.id; }}
                        title={t("splitter.workspace.cutTitle", { index: idx + 1 })}
                      >
                        <span className="koma-split-cut-badge">
                          #{idx + 1} · {Math.round(cut.score * 100)}%{cut.locked ? ' 🔒' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="koma-split-preview__bar">
            <div className="koma-split-preview__zoom-group">
              <button type="button" className="koma-btn koma-btn--ghost" onClick={handleZoomOut} title="Zoom Out">
                <ZoomOut size={12} />
              </button>
              <button type="button" className="koma-split-preview__zoom-label" onClick={handleZoomReset} title="Reset zoom">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="koma-btn koma-btn--ghost" onClick={handleZoomIn} title="Zoom In">
                <ZoomIn size={12} />
              </button>
            </div>
            <div className="koma-split-preview__bar-sep" />
            <button type="button" className="koma-btn koma-btn--ghost" onClick={() => setShowOverlay((c) => !c)}>
              {showOverlay ? <EyeOff size={12} /> : <Eye size={12} />}
              {showOverlay ? t("splitter.workspace.hide") : t("splitter.workspace.show")}
            </button>
            <button type="button" className="koma-btn koma-btn--ghost" onClick={() => void analyzeActiveImage(true)} disabled={isAnalyzing}>
              <RefreshCcw size={12} className={isAnalyzing ? 'koma-spin' : ''} /> {t("splitter.workspace.recalculate")}
            </button>
            {previewSize && (
              <span className="koma-split-preview__size-info">
                {previewSize.width} × {previewSize.height}px
              </span>
            )}
          </div>
        </div>

        {/* Diagnostics */}
        <aside className="koma-split-diag">
          <div className="koma-split-diag__title">
            <span className="koma-split-diag__title-icon" aria-hidden="true"><Layers3 size={11} /></span>
            {t("splitter.workspace.diagnostics")}
          </div>

          <div className="koma-split-metrics">
            <div className="koma-split-metric">
              <span className="koma-split-metric__value">{currentAnalysis?.diagnostics.engine ?? "—"}</span>
              <span className="koma-split-metric__label">{t("splitter.workspace.engine")}</span>
            </div>
            <div className="koma-split-metric">
              <span className="koma-split-metric__value">{currentAnalysis?.cuts.length ?? 0}</span>
              <span className="koma-split-metric__label">{t("splitter.workspace.cuts")}</span>
            </div>
            <div className="koma-split-metric">
              <span className="koma-split-metric__value">{currentAnalysis?.segments.length ?? 0}</span>
              <span className="koma-split-metric__label">{t("splitter.workspace.segments")}</span>
            </div>
            <div className="koma-split-metric">
              <span className="koma-split-metric__value">{currentAnalysis?.diagnostics.whitespaceCandidates ?? 0}</span>
              <span className="koma-split-metric__label">{t("splitter.workspace.whitespace")}</span>
            </div>
          </div>

          {/* Image info */}
          {previewSize && (
            <div className="koma-split-diag__info">
              <div className="koma-split-diag__info-row">
                <span className="koma-split-diag__info-label">{t("splitter.workspace.dimensions")}</span>
                <span className="koma-split-diag__info-value">{previewSize.width} × {previewSize.height}</span>
              </div>
              <div className="koma-split-diag__info-row">
                <span className="koma-split-diag__info-label">{t("splitter.workspace.axis")}</span>
                <span className="koma-split-diag__info-value">{activeRecipe.axis}</span>
              </div>
              <div className="koma-split-diag__info-row">
                <span className="koma-split-diag__info-label">{t("splitter.workspace.strategy")}</span>
                <span className="koma-split-diag__info-value">{activeRecipe.strategy}</span>
              </div>
            </div>
          )}

          <div className="koma-split-diag__warnings">
            {(currentAnalysis?.warnings.length ?? 0) > 0 ? (
              currentAnalysis?.warnings.map((w) => (
                <div key={w} className="koma-split-diag__alert koma-split-diag__alert--warn">
                  <AlertTriangle size={11} className="koma-split-diag__alert-icon" />
                  <span>{t(w as any)}</span>
                </div>
              ))
            ) : (
              <div className="koma-split-diag__alert koma-split-diag__alert--info">
                <Eye size={11} className="koma-split-diag__alert-icon" />
                <span>{t("splitter.workspace.noWarnings")}</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ═══ Cuts Panel ═══ */}
      {currentAnalysis && currentAnalysis.cuts.length > 0 && (
        <div className="koma-split-panel">
          <div className="koma-split-panel__head">
            <span className="koma-split-panel__head-icon" aria-hidden="true"><Scissors size={11} /></span>
            {t("splitter.workspace.cutsTitle", { count: currentAnalysis.cuts.length })}
          </div>
          <div className="koma-split-strip koma-split-strip--cuts">
            {currentAnalysis.cuts.map((cut, idx) => (
              <div key={cut.id} className={`koma-split-card koma-split-card--cut${cut.locked ? ' koma-split-card--locked' : ''}`}>
                <div className="koma-split-card__badge">#{idx + 1}</div>
                <div className="koma-split-card__info">
                  <div className="koma-split-card__name">{t("splitter.workspace.cutCard", { index: idx + 1 })}</div>
                  <p className="koma-split-card__meta">
                    {Math.round(cut.position)}px · {Math.round(cut.score * 100)}% · {cut.source}
                  </p>
                </div>
                <div className="koma-split-card__actions">
                  <button type="button" className="koma-split-card__btn" onClick={() => toggleActiveCutLock(cut.id)} title={cut.locked ? 'Unlock' : 'Lock'}>
                    {cut.locked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                  <button type="button" className="koma-split-card__btn koma-split-card__btn--danger" onClick={() => removeActiveCut(cut.id)} title="Remove">
                    <Trash2 size={10} />
                  </button>
                  <button type="button" className="koma-split-card__btn" onClick={() => mergeActiveSegments(idx)} title="Merge">
                    <Layers3 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Segments Panel ═══ */}
      {currentAnalysis && currentAnalysis.segments.length > 0 && (
        <div className="koma-split-panel">
          <div className="koma-split-panel__head">
            <span className="koma-split-panel__head-icon" aria-hidden="true"><Plus size={11} /></span>
            {t("splitter.workspace.segmentsTitle", { count: currentAnalysis.segments.length })}
          </div>
          <div className="koma-split-strip koma-split-strip--segments">
            {currentAnalysis.segments.map((seg, idx) => {
              const thumb = segmentThumbs.find(t => t.id === seg.id);
              const isSelected = selectedSegmentId === seg.id;
              return (
                <div
                  key={seg.id}
                  className={`koma-split-card koma-split-card--segment${isSelected ? ' koma-split-card--selected' : ''}${seg.warning ? ' koma-split-card--warned' : ''}`}
                  onClick={() => setSelectedSegmentId(isSelected ? null : seg.id)}
                >
                  <div className="koma-split-card__badge">S{idx + 1}</div>
                  {thumb ? (
                    <img
                      src={thumb.src}
                      alt={t("splitter.workspace.segmentAlt", { index: idx + 1 })}
                      className="koma-split-card__thumb"
                      style={{
                        aspectRatio: `${thumb.aspectRatio}`,
                      }}
                    />
                  ) : (
                    <div className="koma-split-card__thumb--placeholder" />
                  )}
                  <div className="koma-split-card__info">
                    <div className="koma-split-card__name">{t("splitter.workspace.segmentCard", { index: idx + 1 })}</div>
                    <p className="koma-split-card__meta">
                      {seg.start}–{seg.end}px · {seg.size}px
                    </p>
                    {seg.warning && <p className="koma-split-card__warn">{seg.warning}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SplitterWorkspace;
