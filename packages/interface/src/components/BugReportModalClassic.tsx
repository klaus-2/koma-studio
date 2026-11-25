import type { JSX } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import { LegalInlineLinks } from './legal/LegalInlineLinks';
import { KomaDialog } from '@koma/ui/components/dialog';
import '@koma/ui/styles/KomaModals.css';
import {
  fmtBytes,
  MAX_ATTACH,
  MAX_FILE,
  useBugReportModalController,
  type BugReportModalProps,
} from './useBugReportModalController';

const BugReportModalClassic = ({
  open,
  onClose,
  context,
}: BugReportModalProps): JSX.Element | null => {
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
    <KomaDialog
      open
      onClose={onClose}
      layerClassName="koma-modal-backdrop"
      modalClassName="koma-modal koma-bug-modal"
      labelledBy="bug-title"
      dismissable={!loading}
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
                  {t('bugReport.field.includeLogs')}
                </label>
                <label className="koma-bug-logs-toggle">
                  <input
                    type="checkbox"
                    checked={includeLogs}
                    onChange={(e) => setIncludeLogs(e.target.checked)}
                  />
                  <span>{t('bugReport.field.includeLogsHint')}</span>
                </label>
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
                      decoding="async"
                      draggable={false}
                    />
                    {rect && (
                      <div
                        className="koma-bug-screenshot__crop"
                        style={{
                          left: 0,
                          top: 0,
                          transform: `translate(${rect.x}px, ${rect.y}px)`,
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
              <div className="koma-bug-attach-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="koma-bug-attach-btn">
                  <Paperclip size={12} /> {t('bugReport.attach')}
                  <input type="file" multiple onChange={addFiles} />
                </label>
                {showOpenLogsFolder && (
                  <button
                    type="button"
                    className="koma-bug-attach-btn"
                    onClick={openLogsFolder}
                  >
                    {t('diagnostics.openLogsFolder')}
                  </button>
                )}
              </div>
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
    </KomaDialog>
  );
};

export default BugReportModalClassic;
