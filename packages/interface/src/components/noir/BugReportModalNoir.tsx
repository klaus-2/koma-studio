import type { JSX } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bug, CheckCircle2, Paperclip, Send, X } from "lucide-react";
import type { DesktopBugReportSubmitPayload } from "@shared/desktop-api";
import { useI18n } from "../../i18n";
import { LegalInlineLinks } from "../legal/LegalInlineLinks";
import { useBugReportPrepare } from "../useBugReportPrepare";
import { EASE, btnPrimary, btnGhost } from "../system/v2/kit";
import { desktopBridge } from "@/lib/desktop-bridge";

type BugSeverity = "low" | "medium" | "high" | "critical";
type CropRect = { x: number; y: number; width: number; height: number };

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  context?: { mode?: string; statusMessage?: string; route?: string; userEmail?: string };
}
interface ManualAttachment { id: string; file: File }

const MAX_ATTACH = 5;
const MAX_FILE = 8 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;
const SEV_KEYS: BugSeverity[] = ["low", "medium", "high", "critical"];
const SEV_TONE: Record<BugSeverity, string> = {
  low: "border-mint/50 bg-mint/10 text-mint",
  medium: "border-azure/50 bg-azure/10 text-azure",
  high: "border-gold/50 bg-gold/10 text-gold",
  critical: "border-crimson/50 bg-crimson/10 text-crimson",
};
const mkId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const fmtBytes = (v: number) => {
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let s = v, i = 0;
  for (; i < u.length - 1 && s >= 1024; i++) s /= 1024;
  return `${s.toFixed(s >= 10 ? 0 : 1)} ${u[i]}`;
};
const toB64 = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const loadImg = (src: string, t: (key: any) => string) =>
  new Promise<HTMLImageElement>((r, j) => {
    const i = new Image();
    i.onload = () => r(i);
    i.onerror = () => j(new Error(t("bugReport.error.imgLoadFailed")));
    i.src = src;
  });
const cropDataUrl = async (src: string, rect: CropRect, size: { width: number; height: number }, t: (key: any) => string) => {
  const img = await loadImg(src, t);
  const sx = img.naturalWidth / Math.max(1, size.width), sy = img.naturalHeight / Math.max(1, size.height);
  const cx = Math.max(0, Math.floor(rect.x * sx)), cy = Math.max(0, Math.floor(rect.y * sy));
  const cw = Math.max(1, Math.floor(rect.width * sx)), ch = Math.max(1, Math.floor(rect.height * sy));
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error(t("bugReport.error.canvasFailed"));
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
  return c.toDataURL("image/png", 1);
};

/* ── UI locals ──────────────────────────────────────────────── */
const inputCls =
  "panel-cut-sm w-full border border-paper/12 bg-ink px-3 py-2 font-mono text-[11px] text-paper placeholder:text-paper/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";
const FieldLbl = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">
    <span aria-hidden className="text-crimson">//</span> {children}
    {required && <span className="ml-1 text-crimson">*</span>}
  </span>
);
const MiniAlert = ({ tone, children }: { tone: "info" | "warn" | "error" | "success"; children: React.ReactNode }) => {
  const c = {
    info: "border-azure text-azure bg-azure/8", warn: "border-gold text-gold bg-gold/8",
    error: "border-crimson text-crimson bg-crimson/8", success: "border-mint text-mint bg-mint/8"
  }[tone];
  const I = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 border-l-2 px-3 py-2 font-mono text-[10px] ${c}`}>
      <I size={11} className="mt-0.5 shrink-0" />
      <span className="text-paper/75">{children}</span>
    </div>
  );
};

const BugReportModalNoir = ({ open, onClose, context }: BugReportModalProps): JSX.Element | null => {
  const { t } = useI18n();
  const { prep, prepLoading } = useBugReportPrepare(open);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [sev, setSev] = useState<BugSeverity>("medium");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [contact, setContact] = useState("");
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [drag, setDrag] = useState<CropRect | null>(null);
  // Handler-only: never rendered, so a ref avoids re-rendering the modal on
  // crop-drag start/end (react.dev "Referencing Values with Refs").
  const draggingRef = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [attachments, setAttachments] = useState<ManualAttachment[]>([]);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const api = desktopBridge.desktop?.api?.bugReport;
  const screenshot = prep?.screenshotDataUrl ?? null;
  const rect = drag ?? crop;
  const totalBytes = useMemo(() => attachments.reduce((s, a) => s + a.file.size, 0), [attachments]);
  const canSubmit = Boolean(title.trim()) && Boolean(desc.trim()) && Boolean(screenshot) && Boolean(prep?.ready) && !loading;

  const reset = useCallback(() => {
    setTitle(""); setDesc(""); setSev("medium"); setSteps(""); setExpected(""); setActual(""); setContact("");
    setCrop(null); setDrag(null); draggingRef.current = false; dragStart.current = null;
    setAttachments([]); setAttachErr(null); setErr(null); setSuccess(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  const addFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;
    setAttachErr(null);
    const next = [...attachments];
    for (const f of files) {
      if (next.length >= MAX_ATTACH) { setAttachErr(t("bugReport.attach.maxCount", { count: MAX_ATTACH })); break; }
      if (f.size > MAX_FILE) {
        setAttachErr(t("bugReport.attach.fileTooLarge", { name: f.name, size: Math.round(MAX_FILE / 1048576) }));
        continue;
      }
      if (next.reduce((s, a) => s + a.file.size, 0) + f.size > MAX_TOTAL) {
        setAttachErr(t("bugReport.attach.totalTooLarge", { size: Math.round(MAX_TOTAL / 1048576) }));
        break;
      }
      next.push({ id: mkId(), file: f });
    }
    setAttachments(next);
  }, [attachments, t]);

  const rmAttach = useCallback((id: string) => {
    setAttachments((p) => p.filter((a) => a.id !== id));
    setAttachErr(null);
  }, []);

  const relPt = useCallback((cx: number, cy: number) => {
    const h = wrapRef.current;
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: Math.max(0, Math.min(r.width, cx - r.left)), y: Math.max(0, Math.min(r.height, cy - r.top)), w: r.width, h: r.height };
  }, []);

  const onDown = useCallback((e: React.MouseEvent) => {
    if (!screenshot) return;
    const p = relPt(e.clientX, e.clientY);
    if (!p) return;
    dragStart.current = { x: p.x, y: p.y };
    setDrag({ x: p.x, y: p.y, width: 0, height: 0 });
    draggingRef.current = true;
  }, [relPt, screenshot]);
  const onMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current || !dragStart.current) return;
    const p = relPt(e.clientX, e.clientY);
    if (!p) return;
    setDrag({
      x: Math.min(dragStart.current.x, p.x), y: Math.min(dragStart.current.y, p.y),
      width: Math.abs(p.x - dragStart.current.x), height: Math.abs(p.y - dragStart.current.y),
    });
  }, [relPt]);
  const onUp = useCallback(() => {
    if (drag) setCrop(drag.width >= 8 && drag.height >= 8 ? drag : null);
    setDrag(null); draggingRef.current = false; dragStart.current = null;
  }, [drag]);

  const getScreenshot = useCallback(async () => {
    if (!screenshot) throw new Error(t("bugReport.error.noScreenshot"));
    if (!crop || !imgRef.current) return screenshot;
    const r = imgRef.current.getBoundingClientRect();
    return cropDataUrl(screenshot, crop, { width: r.width, height: r.height }, t);
  }, [crop, screenshot, t]);

  const submit = useCallback(async () => {
    if (!api || !prep?.ready) { setErr(prep?.error ?? t("bugReport.error.bridgeUnavailable")); return; }
    if (!title.trim() || !desc.trim()) { setErr(t("bugReport.error.fillTitleDescription")); return; }
    setLoading(true); setErr(null); setSuccess(null);
    try {
      const ss = await getScreenshot();
      const atts = await Promise.all(attachments.map(async ({ file }) => ({
        name: file.name, mimeType: file.type || "application/octet-stream",
        size: file.size, contentBase64: toB64(await file.arrayBuffer()),
      })));
      const payload: DesktopBugReportSubmitPayload = {
        title: title.trim(), description: desc.trim(), severity: sev,
        stepsToReproduce: steps.trim() || undefined,
        expectedResult: expected.trim() || undefined,
        actualResult: actual.trim() || undefined,
        contact: contact.trim() || undefined,
        screenshotDataUrl: ss,
        autoLogIds: prep.autoLogs.map((l) => l.id),
        attachments: atts,
        context: { mode: context?.mode, statusMessage: context?.statusMessage, route: context?.route, userEmail: context?.userEmail },
      };
      const res = await api.submit(payload);
      if (!res.ok) { setErr(res.error ?? t("bugReport.error.generic")); return; }
      setSuccess(t("bugReport.success.sent", {
        screenshot: res.screenshotUrl ? ` ${t("bugReport.success.screenshot", { url: res.screenshotUrl })}` : "",
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("bugReport.error.generic"));
    } finally { setLoading(false); }
  }, [api, attachments, contact, context, desc, expected, actual, getScreenshot, prep, sev, steps, title, t]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-ink/85 p-3 backdrop-blur-md sm:p-6"
      onClick={loading ? undefined : onClose}
    >
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby="bug-title"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="glass panel-cut halftone relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="absolute left-0 top-0 z-10 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />
        <span aria-hidden className="v-text pointer-events-none absolute bottom-6 right-2 select-none font-display text-lg font-black tracking-widest text-paper/[0.06]">
          事件報告書
        </span>

        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <motion.span aria-hidden
              initial={{ rotate: -10, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.1 }}
              className="panel-cut-sm flex h-10 w-10 items-center justify-center border-2 border-crimson bg-crimson/10 text-crimson">
              <Bug size={16} strokeWidth={2.5} />
            </motion.span>
            <div>
              <p className="kicker">// INCIDENT REPORT</p>
              <h2 id="bug-title" className="font-display text-lg font-black uppercase tracking-tight text-paper">
                {t("bugReport.title")}
              </h2>
              <p className="font-mono text-[10px] text-paper/45">{t("bugReport.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label={t("bugReport.close")}
            className="panel-cut-sm border border-paper/15 p-1.5 text-paper/45 transition-colors hover:border-crimson/50 hover:text-crimson disabled:opacity-40">
            <X size={12} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* ── 01 · DETAILS ── */}
            <section className="relative space-y-3.5">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-outline font-display text-2xl font-black">01</span>
                <span className="kicker">// {t("bugReport.details")}</span>
              </div>

              <MiniAlert tone="info">{t("bugReport.machineSnapshotIncluded")}</MiniAlert>

              <label className="block">
                <FieldLbl required>{t("bugReport.field.title")}</FieldLbl>
                <input type="text" className={inputCls} value={title}
                  onChange={(e) => setTitle(e.target.value)} placeholder={t("bugReport.placeholder.title")} />
              </label>

              <label className="block">
                <FieldLbl required>{t("bugReport.field.description")}</FieldLbl>
                <textarea className={`${inputCls} resize-y`} rows={3} value={desc}
                  onChange={(e) => setDesc(e.target.value)} placeholder={t("bugReport.placeholder.description")} />
              </label>

              {/* Severity — segmented hanko */}
              <div>
                <FieldLbl required>{t("bugReport.field.severity")}</FieldLbl>
                <div role="radiogroup" aria-label={t("bugReport.field.severity")} className="flex flex-wrap gap-1.5">
                  {SEV_KEYS.map((v) => {
                    const label = v === "low" ? t("bugReport.severity.low")
                      : v === "medium" ? t("bugReport.severity.medium")
                        : v === "high" ? t("bugReport.severity.high") : t("bugReport.severity.critical");
                    const active = sev === v;
                    return (
                      <button key={v} type="button" role="radio" aria-checked={active}
                        onClick={() => setSev(v)}
                        className={`panel-cut-sm border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition-all ${active ? SEV_TONE[v] : "border-paper/12 text-paper/35 hover:text-paper/70"
                          } ${active && v === "critical" ? "blink" : ""}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <FieldLbl>{t("bugReport.field.steps")}</FieldLbl>
                <textarea className={`${inputCls} resize-y`} rows={2} value={steps}
                  onChange={(e) => setSteps(e.target.value)} placeholder={t("bugReport.placeholder.steps")} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <FieldLbl>{t("bugReport.field.expected")}</FieldLbl>
                  <textarea className={`${inputCls} resize-y`} rows={2} value={expected}
                    onChange={(e) => setExpected(e.target.value)} />
                </label>
                <label className="block">
                  <FieldLbl>{t("bugReport.field.actual")}</FieldLbl>
                  <textarea className={`${inputCls} resize-y`} rows={2} value={actual}
                    onChange={(e) => setActual(e.target.value)} />
                </label>
              </div>

              <label className="block">
                <FieldLbl>{t("bugReport.field.contact")}</FieldLbl>
                <input type="text" className={inputCls} value={contact}
                  onChange={(e) => setContact(e.target.value)} placeholder={t("bugReport.placeholder.contact")} />
              </label>
            </section>

            {/* ── 02 · EVIDENCE ── */}
            <section className="relative space-y-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-outline font-display text-2xl font-black">02</span>
                <span className="kicker">// {t("bugReport.evidence")}</span>
              </div>

              {prepLoading ? (
                <MiniAlert tone="info"><span className="blink">●</span> {t("bugReport.preparingEvidence")}</MiniAlert>
              ) : screenshot ? (
                <>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-paper/35">
                    {t("bugReport.dragToCrop")}
                  </p>
                  <div ref={wrapRef}
                    className="panel-cut-sm relative cursor-crosshair select-none overflow-hidden border border-paper/12 bg-ink"
                    onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
                    <img ref={imgRef} src={screenshot} alt={t("bugReport.screenshot.alt")} draggable={false}
                      className="block w-full" />
                    {rect && (
                      <div
                        className="pointer-events-none absolute border-2 border-dashed border-crimson bg-crimson/10 shadow-[0_0_0_9999px_rgba(7,7,12,0.6)]"
                        style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <button type="button" className={btnGhost} onClick={() => setCrop(null)} disabled={!crop}>
                      {t("bugReport.clearCrop")}
                    </button>
                    {crop && (
                      <span className="stamp !text-[8px]">
                        ✂ {Math.round(crop.width)}×{Math.round(crop.height)}px
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <MiniAlert tone="warn">{prep?.error ?? t("bugReport.screenshotUnavailable")}</MiniAlert>
              )}

              {/* Attachments */}
              <div className="border-t border-paper/8 pt-3">
                <FieldLbl>{t("bugReport.manualAttachments")}</FieldLbl>
                <label className={`${btnGhost} cursor-pointer`}>
                  <Paperclip size={11} /> {t("bugReport.attach")}
                  <input type="file" multiple className="sr-only" onChange={addFiles} />
                </label>
                <p className="mt-1.5 font-mono text-[8px] uppercase tracking-wider text-paper/30">
                  {t("bugReport.attach.summary", {
                    count: MAX_ATTACH, size: Math.round(MAX_FILE / 1048576), total: fmtBytes(totalBytes),
                  })}
                </p>
              </div>

              {attachErr && <MiniAlert tone="warn">{attachErr}</MiniAlert>}

              {attachments.length > 0 && (
                <ul className="space-y-1.5">
                  <AnimatePresence>
                    {attachments.map((a, i) => (
                      <motion.li key={a.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                        className="panel-cut-sm flex items-center gap-2 border border-paper/10 bg-ink/50 px-2.5 py-1.5">
                        <span aria-hidden className="font-display text-xs font-black text-paper/20">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-paper/70">
                          {a.file.name} <span className="text-gold">({fmtBytes(a.file.size)})</span>
                        </span>
                        <button type="button" onClick={() => rmAttach(a.id)}
                          aria-label={t("bugReport.attach.remove", { name: a.file.name })}
                          className="p-1 text-paper/30 hover:text-crimson">
                          <X size={10} />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          </div>

          {/* Status */}
          <div className="mt-4 space-y-2">
            {err && <MiniAlert tone="error">{err}</MiniAlert>}
            {success && <MiniAlert tone="success">{success}</MiniAlert>}
            {!prep?.ready && prep?.error && !prepLoading && <MiniAlert tone="warn">{prep.error}</MiniAlert>}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-paper/10 px-5 py-4 sm:px-6">
          <p className="mb-3 font-mono text-[9px] text-paper/35">
            {t("bugReport.legalPrefix")} <LegalInlineLinks />.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={onClose} disabled={loading}>
              {t("bugReport.close")}
            </button>
            <button type="button" className={btnPrimary} onClick={() => void submit()} disabled={!canSubmit}>
              {loading
                ? <span className="blink">{t("bugReport.sending")}</span>
                : <><Send size={11} /> {t("bugReport.submit")}</>}
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
};

export default BugReportModalNoir;
