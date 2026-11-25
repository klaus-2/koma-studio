import type { JSX, ReactNode } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bug, CheckCircle2, Paperclip, Send, X } from 'lucide-react';
import { LegalInlineLinks } from '../legal/LegalInlineLinks';
import { EASE, btnPrimary, btnGhost } from '../system/v2/kit';
import {
  fmtBytes,
  MAX_ATTACH,
  MAX_FILE,
  useBugReportModalController,
  type BugReportModalProps,
} from '../useBugReportModalController';

const inputCls =
  'panel-cut-sm w-full border border-paper/12 bg-ink px-3 py-2 font-mono text-[11px] text-paper placeholder:text-paper/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson';
const FieldLbl = ({ children, required }: { children: ReactNode; required?: boolean }) => (
  <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">
    <span aria-hidden className="text-crimson">//</span> {children}
    {required && <span className="ml-1 text-crimson">*</span>}
  </span>
);
const MiniAlert = ({ tone, children }: { tone: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) => {
  const c = {
    info: 'border-azure text-azure bg-azure/8',
    warn: 'border-gold text-gold bg-gold/8',
    error: 'border-crimson text-crimson bg-crimson/8',
    success: 'border-mint text-mint bg-mint/8',
  }[tone];
  const I = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 border-l-2 px-3 py-2 font-mono text-[10px] ${c}`}
    >
      <I size={11} className="mt-0.5 shrink-0" />
      <span className="text-paper/75">{children}</span>
    </div>
  );
};

const BugReportModalNoir = ({ open, onClose, context }: BugReportModalProps): JSX.Element | null => {
  const {
    t,
    prep,
    prepLoading,
    screenshot,
    rect,
    totalBytes,
    canSubmit,
    showOpenLogsFolder,
    title,
    setTitle,
    desc,
    setDesc,
    includeLogs,
    setIncludeLogs,
    steps,
    setSteps,
    expected,
    setExpected,
    actual,
    setActual,
    contact,
    setContact,
    crop,
    setCrop,
    wrapRef,
    imgRef,
    attachments,
    attachErr,
    loading,
    err,
    success,
    addFiles,
    rmAttach,
    onDown,
    onMove,
    onUp,
    openLogsFolder,
    submit,
  } = useBugReportModalController({ open, context });

  if (!open) return null;

  return (
    <m.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-ink/85 p-3 backdrop-blur-md sm:p-6"
      onClick={loading ? undefined : onClose}
    >
      <m.div
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
            <m.span aria-hidden
              initial={{ rotate: -10, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.1 }}
              className="panel-cut-sm flex h-10 w-10 items-center justify-center border-2 border-crimson bg-crimson/10 text-crimson">
              <Bug size={16} strokeWidth={2.5} />
            </m.span>
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

              {/* Technical logs — consent toggle */}
              <div>
                <FieldLbl>{t("bugReport.field.includeLogs")}</FieldLbl>
                <label className="panel-cut-sm flex cursor-pointer items-center gap-2.5 border border-paper/12 px-3 py-2 transition-colors hover:border-crimson/40">
                  <input type="checkbox" checked={includeLogs}
                    onChange={(e) => setIncludeLogs(e.target.checked)}
                    className="h-3.5 w-3.5 accent-crimson" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper/60">
                    {t("bugReport.field.includeLogsHint")}
                  </span>
                </label>
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
                        style={{ left: 0, top: 0, transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.width, height: rect.height }}
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
                <div className="flex items-center gap-2">
                  <label className={`${btnGhost} cursor-pointer`}>
                    <Paperclip size={11} /> {t("bugReport.attach")}
                    <input type="file" multiple className="sr-only" onChange={addFiles} />
                  </label>
                  {showOpenLogsFolder && (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={openLogsFolder}
                    >
                      {t("diagnostics.openLogsFolder")}
                    </button>
                  )}
                </div>
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
                      <m.li key={a.id}
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
                      </m.li>
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
      </m.div>
    </m.div>
  );
};

export default BugReportModalNoir;
