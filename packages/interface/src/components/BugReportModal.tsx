import type { JSX } from "react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import type {
  DesktopBugReportDiagnostics,
  DesktopBugReportPrepareResult,
  DesktopBugReportSubmitPayload,
} from '@shared/desktop-api';
import { useI18n } from '../i18n';
import { LegalInlineLinks } from './legal/LegalInlineLinks';
import '@koma/ui/styles/KomaModals.css';

import { desktopBridge } from "@/lib/desktop-bridge";
type BugSeverity = 'low' | 'medium' | 'high' | 'critical';
type CropRect = { x: number; y: number; width: number; height: number };

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  context?: {
    mode?: string;
    statusMessage?: string;
    route?: string;
    userEmail?: string;
  };
}

interface ManualAttachment {
  id: string;
  file: File;
}

const MAX_ATTACH = 5;
const MAX_FILE = 8 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;
const SEV_KEYS: BugSeverity[] = ['low', 'medium', 'high', 'critical'];
const mkId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const fmtBytes = (v: number) => {
  if (!Number.isFinite(v) || v <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let s = v,
    i = 0;
  for (; i < u.length - 1 && s >= 1024; i++) s /= 1024;
  return `${s.toFixed(s >= 10 ? 0 : 1)} ${u[i]}`;
};
const toB64 = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000)
    s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const loadImg = (src: string, t: (key: any) => string) =>
  new Promise<HTMLImageElement>((r, j) => {
    const i = new Image();
    i.onload = () => r(i);
    i.onerror = () => j(new Error(t('bugReport.error.imgLoadFailed')));
    i.src = src;
  });
const cropDataUrl = async (
  src: string,
  rect: CropRect,
  size: { width: number; height: number },
  t: (key: any) => string,
) => {
  const img = await loadImg(src, t);
  const sx = img.naturalWidth / Math.max(1, size.width),
    sy = img.naturalHeight / Math.max(1, size.height);
  const cx = Math.max(0, Math.floor(rect.x * sx)),
    cy = Math.max(0, Math.floor(rect.y * sy));
  const cw = Math.max(1, Math.floor(rect.width * sx)),
    ch = Math.max(1, Math.floor(rect.height * sy));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error(t('bugReport.error.canvasFailed'));
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
  return c.toDataURL('image/png', 1);
};
const emptyDiag = (): DesktopBugReportDiagnostics => ({
  timestamp: new Date(0).toISOString(),
  appVersion: '',
  platform: '',
  release: '',
  arch: '',
  nodeVersion: '',
  electronVersion: '',
  chromeVersion: '',
  appPackaged: false,
  envMode: '',
  updateChannel: '',
  miniBackendRunning: false,
  miniBackendRuntimeLineCount: 0,
  authApiUrl: '',
  localApiUrl: '',
  machineProfileSchemaVersion: 1,
  machineProfile: null,
  machineProfileSync: {
    lastSyncedAt: null,
    lastChangedAt: null,
    lastError: null,
    profileHash: null,
    changedFields: [],
    lastReason: null,
  },
});

const BugReportModal = ({
  open,
  onClose,
  context,
}: BugReportModalProps): JSX.Element | null => {
  const { t } = useI18n();
  const [prep, setPrep] = useState<DesktopBugReportPrepareResult | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [sev, setSev] = useState<BugSeverity>('medium');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [contact, setContact] = useState('');
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [drag, setDrag] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState(false);
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
  const totalBytes = useMemo(
    () => attachments.reduce((s, a) => s + a.file.size, 0),
    [attachments],
  );
  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(desc.trim()) &&
    Boolean(screenshot) &&
    Boolean(prep?.ready) &&
    !loading;

  const reset = useCallback(() => {
    setTitle('');
    setDesc('');
    setSev('medium');
    setSteps('');
    setExpected('');
    setActual('');
    setContact('');
    setCrop(null);
    setDrag(null);
    setDragging(false);
    dragStart.current = null;
    setAttachments([]);
    setAttachErr(null);
    setErr(null);
    setSuccess(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    setPrepLoading(true);
    void (async () => {
      if (!api) {
        setPrep({
          screenshotDataUrl: null,
          autoLogs: [],
          diagnostics: emptyDiag(),
          ready: false,
          error: t('bugReport.error.bridgeUnavailable'),
        });
        setPrepLoading(false);
        return;
      }
      try {
        setPrep(await api.prepare());
      } catch (e) {
        setPrep({
          screenshotDataUrl: null,
          autoLogs: [],
          diagnostics: emptyDiag(),
          ready: false,
          error: e instanceof Error ? e.message : t('bugReport.error.prepareFailed'),
        });
      } finally {
        setPrepLoading(false);
      }
    })();
  }, [api, open, reset]);

  const addFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.currentTarget.value = '';
      if (!files.length) return;
      setAttachErr(null);
      const next = [...attachments];
      for (const f of files) {
        if (next.length >= MAX_ATTACH) {
          setAttachErr(t('bugReport.attach.maxCount', { count: MAX_ATTACH }));
          break;
        }
        if (f.size > MAX_FILE) {
          setAttachErr(
            t('bugReport.attach.fileTooLarge', {
              name: f.name,
              size: Math.round(MAX_FILE / 1048576),
            }),
          );
          continue;
        }
        if (next.reduce((s, a) => s + a.file.size, 0) + f.size > MAX_TOTAL) {
          setAttachErr(
            t('bugReport.attach.totalTooLarge', {
              size: Math.round(MAX_TOTAL / 1048576),
            }),
          );
          break;
        }
        next.push({ id: mkId(), file: f });
      }
      setAttachments(next);
    },
    [attachments],
  );

  const rmAttach = useCallback((id: string) => {
    setAttachments((p) => p.filter((a) => a.id !== id));
    setAttachErr(null);
  }, []);

  const relPt = useCallback((cx: number, cy: number) => {
    const h = wrapRef.current;
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(r.width, cx - r.left)),
      y: Math.max(0, Math.min(r.height, cy - r.top)),
      w: r.width,
      h: r.height,
    };
  }, []);

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      if (!screenshot) return;
      const p = relPt(e.clientX, e.clientY);
      if (!p) return;
      dragStart.current = { x: p.x, y: p.y };
      setDrag({ x: p.x, y: p.y, width: 0, height: 0 });
      setDragging(true);
    },
    [relPt, screenshot],
  );
  const onMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !dragStart.current) return;
      const p = relPt(e.clientX, e.clientY);
      if (!p) return;
      setDrag({
        x: Math.min(dragStart.current.x, p.x),
        y: Math.min(dragStart.current.y, p.y),
        width: Math.abs(p.x - dragStart.current.x),
        height: Math.abs(p.y - dragStart.current.y),
      });
    },
    [dragging, relPt],
  );
  const onUp = useCallback(() => {
    if (drag) {
      setCrop(drag.width >= 8 && drag.height >= 8 ? drag : null);
    }
    setDrag(null);
    setDragging(false);
    dragStart.current = null;
  }, [drag]);

  const getScreenshot = useCallback(async () => {
    if (!screenshot) throw new Error(t('bugReport.error.noScreenshot'));
    if (!crop || !imgRef.current) return screenshot;
    const r = imgRef.current.getBoundingClientRect();
    return cropDataUrl(screenshot, crop, { width: r.width, height: r.height }, t);
  }, [crop, screenshot, t]);

  const submit = useCallback(async () => {
    if (!api || !prep?.ready) {
      setErr(prep?.error ?? t('bugReport.error.bridgeUnavailable'));
      return;
    }
    if (!title.trim() || !desc.trim()) {
      setErr(t('bugReport.error.fillTitleDescription'));
      return;
    }
    setLoading(true);
    setErr(null);
    setSuccess(null);
    try {
      const ss = await getScreenshot();
      const atts = await Promise.all(
        attachments.map(async ({ file }) => ({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          contentBase64: toB64(await file.arrayBuffer()),
        })),
      );
      const payload: DesktopBugReportSubmitPayload = {
        title: title.trim(),
        description: desc.trim(),
        severity: sev,
        stepsToReproduce: steps.trim() || undefined,
        expectedResult: expected.trim() || undefined,
        actualResult: actual.trim() || undefined,
        contact: contact.trim() || undefined,
        screenshotDataUrl: ss,
        autoLogIds: prep.autoLogs.map((l) => l.id),
        attachments: atts,
        context: {
          mode: context?.mode,
          statusMessage: context?.statusMessage,
          route: context?.route,
          userEmail: context?.userEmail,
        },
      };
      const res = await api.submit(payload);
      if (!res.ok) {
        setErr(res.error ?? t('bugReport.error.generic'));
        return;
      }
      setSuccess(
        t('bugReport.success.sent', {
          screenshot: res.screenshotUrl
            ? ` ${t('bugReport.success.screenshot', { url: res.screenshotUrl })}`
            : '',
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('bugReport.error.generic'));
    } finally {
      setLoading(false);
    }
  }, [
    api,
    attachments,
    contact,
    context,
    desc,
    expected,
    actual,
    getScreenshot,
    prep,
    sev,
    steps,
    title,
  ]);

  if (!open) return null;

  return (
    <div
      className="koma-modal-backdrop"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="koma-modal koma-bug-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-title"
      >
        {/* Header */}
        <div className="koma-modal__header">
          <div className="koma-modal__header-icon">
            <Bug size={16} />
          </div>
          <div className="koma-modal__title-group">
            <h2 id="bug-title" className="koma-modal__title">
              {t('bugReport.title')}
            </h2>
            <p className="koma-modal__subtitle">
              {t('bugReport.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="koma-modal__close"
            aria-label={t('bugReport.close')}
            disabled={loading}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="koma-modal__body">
          <div className="koma-bug-grid">
            {/* Left: Details */}
            <section className="koma-bug-section">
              <div className="koma-bug-section__title">{t('bugReport.details')}</div>

              <div className="koma-modal-alert koma-modal-alert--info">
                <AlertTriangle size={12} className="koma-modal-alert__icon" />
                <span>{t('bugReport.machineSnapshotIncluded')}</span>
              </div>

              <div className="koma-bug-field">
                <label className="koma-bug-field__label koma-bug-field__label--required">
                  {t('bugReport.field.title')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('bugReport.placeholder.title')}
                />
              </div>

              <div className="koma-bug-field">
                <label className="koma-bug-field__label koma-bug-field__label--required">
                  {t('bugReport.field.description')}
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  placeholder={t('bugReport.placeholder.description')}
                />
              </div>

              <div className="koma-bug-field">
                <label className="koma-bug-field__label koma-bug-field__label--required">
                  {t('bugReport.field.severity')}
                </label>
                <select
                  value={sev}
                  onChange={(e) => setSev(e.target.value as BugSeverity)}
                >
                  {SEV_KEYS.map((v) => (
                    <option key={v} value={v}>
                      {v === 'low'
                        ? t('bugReport.severity.low')
                        : v === 'medium'
                          ? t('bugReport.severity.medium')
                          : v === 'high'
                            ? t('bugReport.severity.high')
                            : t('bugReport.severity.critical')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="koma-bug-field">
                <label className="koma-bug-field__label">
                  {t('bugReport.field.steps')}
                </label>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  rows={2}
                  placeholder={t('bugReport.placeholder.steps')}
                />
              </div>

              <div className="koma-bug-2col">
                <div className="koma-bug-field">
                  <label className="koma-bug-field__label">{t('bugReport.field.expected')}</label>
                  <textarea
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="koma-bug-field">
                  <label className="koma-bug-field__label">{t('bugReport.field.actual')}</label>
                  <textarea
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="koma-bug-field">
                <label className="koma-bug-field__label">{t('bugReport.field.contact')}</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t('bugReport.placeholder.contact')}
                />
              </div>
            </section>

            {/* Right: Evidence */}
            <section className="koma-bug-section">
              <div className="koma-bug-section__title">{t('bugReport.evidence')}</div>

              {prepLoading ? (
                <div className="koma-modal-alert koma-modal-alert--info">
                  <Loader2
                    size={13}
                    className="koma-spin koma-modal-alert__icon"
                  />
                  <span>{t('bugReport.preparingEvidence')}</span>
                </div>
              ) : screenshot ? (
                <>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: 'var(--auth-text-muted)',
                    }}
                  >
                    {t('bugReport.dragToCrop')}
                  </p>
                  <div
                    ref={wrapRef}
                    className="koma-bug-screenshot"
                    onMouseDown={onDown}
                    onMouseMove={onMove}
                    onMouseUp={onUp}
                    onMouseLeave={onUp}
                  >
                    <img
                      ref={imgRef}
                      src={screenshot}
                      alt={t('bugReport.screenshot.alt')}
                      draggable={false}
                    />
                    {rect && (
                      <div
                        className="koma-bug-screenshot__crop"
                        style={{
                          left: rect.x,
                          top: rect.y,
                          width: rect.width,
                          height: rect.height,
                        }}
                      />
                    )}
                  </div>
                  <div className="koma-bug-screenshot__actions">
                    <button
                      type="button"
                      className="koma-btn koma-btn--ghost koma-btn--sm"
                      onClick={() => setCrop(null)}
                      disabled={!crop}
                    >
                      {t('bugReport.clearCrop')}
                    </button>
                    {crop && (
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--auth-text-muted)',
                          fontFamily: 'ui-monospace, monospace',
                        }}
                      >
                        {Math.round(crop.width)}×{Math.round(crop.height)}px
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="koma-modal-alert koma-modal-alert--warning">
                  <AlertTriangle size={12} className="koma-modal-alert__icon" />
                  <span>{prep?.error ?? t('bugReport.screenshotUnavailable')}</span>
                </div>
              )}

              {/* Manual attachments */}
              <div className="koma-bug-sub">{t('bugReport.manualAttachments')}</div>
              <label className="koma-bug-attach-btn">
                <Paperclip size={12} /> {t('bugReport.attach')}
                <input type="file" multiple onChange={addFiles} />
              </label>
              <p
                style={{
                  margin: 0,
                  fontSize: 9.5,
                  color: 'var(--auth-text-muted)',
                }}
              >
                {t('bugReport.attach.summary', {
                  count: MAX_ATTACH,
                  size: Math.round(MAX_FILE / 1048576),
                  total: fmtBytes(totalBytes),
                })}
              </p>

              {attachErr && (
                <div className="koma-modal-alert koma-modal-alert--warning">
                  <AlertTriangle size={11} className="koma-modal-alert__icon" />
                  <span>{attachErr}</span>
                </div>
              )}

              {attachments.length > 0 && (
                <ul className="koma-bug-attach-list">
                  {attachments.map((a) => (
                    <li key={a.id}>
                      <span>
                        {a.file.name} ({fmtBytes(a.file.size)})
                      </span>
                      <button
                        type="button"
                        onClick={() => rmAttach(a.id)}
                        aria-label={t('bugReport.attach.remove', {
                          name: a.file.name,
                        })}
                      >
                        <X size={10} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Status messages */}
          {err && (
            <div
              className="koma-modal-alert koma-modal-alert--error"
              style={{ marginTop: 12 }}
            >
              <AlertTriangle size={12} className="koma-modal-alert__icon" />
              <span>{err}</span>
            </div>
          )}
          {success && (
            <div
              className="koma-modal-alert koma-modal-alert--success"
              style={{ marginTop: 12 }}
            >
              <CheckCircle2 size={12} className="koma-modal-alert__icon" />
              <span>{success}</span>
            </div>
          )}
          {!prep?.ready && prep?.error && !prepLoading && (
            <div
              className="koma-modal-alert koma-modal-alert--warning"
              style={{ marginTop: 12 }}
            >
              <AlertTriangle size={12} className="koma-modal-alert__icon" />
              <span>{prep.error}</span>
            </div>
          )}
        </div>

        {/* Legal */}
        <p className="koma-bug-legal">
          {t('bugReport.legalPrefix')} <LegalInlineLinks />.
        </p>

        {/* Footer */}
        <div className="koma-modal__footer">
          <button
            type="button"
            className="koma-modal__btn koma-modal__btn--ghost"
            onClick={onClose}
            disabled={loading}
          >
            {t('bugReport.close')}
          </button>
          <button
            type="button"
            className="koma-modal__btn koma-modal__btn--primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <span
                  className="auth-spinner"
                  style={{ width: 12, height: 12 }}
                />{' '}
                {t('bugReport.sending')}
              </>
            ) : (
              <>
                <Send size={12} /> {t('bugReport.submit')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BugReportModal;
