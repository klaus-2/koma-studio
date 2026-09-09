import type { MutableRefObject } from 'react';
import type { useDropzone } from 'react-dropzone';
import {
  Copy,
  ExternalLink,
  ImagePlus,
  Link2,
  Loader2,
  UploadCloud,
} from 'lucide-react';

import type { useI18n } from '../../i18n';
import type { UploadDraftItem } from './BloggerWorkspace';

type I18nTranslate = ReturnType<typeof useI18n>['t'];

interface BloggerUploadPanelProps {
  t: I18nTranslate;
  uploadDropzone: ReturnType<typeof useDropzone>;
  batchOptimizerEnabled: boolean;
  setBatchOptimizerEnabled: (value: boolean) => void;
  bulkPreferOptimizedUrl: boolean;
  setBulkPreferOptimizedUrl: (value: boolean) => void;
  bulkAsImageTag: boolean;
  setBulkAsImageTag: (value: boolean) => void;
  uploadInputRef: MutableRefObject<HTMLInputElement | null>;
  appendUploadDrafts: (files: File[]) => void;
  configReady: boolean;
  queuedDrafts: UploadDraftItem[];
  uploadBusy: boolean;
  handleBatchUpload: () => Promise<void>;
  uploadDrafts: UploadDraftItem[];
  copiedToken: string | null;
  handleCopyAll: () => Promise<void>;
  handleExportAll: () => void;
  handleDraftAltChange: (draftId: string, value: string) => void;
  handleCopyResult: (token: string, value: string) => Promise<void>;
  handleRemoveDraft: (draftId: string) => void;
}

export const BloggerUploadPanel = ({
  t,
  uploadDropzone,
  batchOptimizerEnabled,
  setBatchOptimizerEnabled,
  bulkPreferOptimizedUrl,
  setBulkPreferOptimizedUrl,
  bulkAsImageTag,
  setBulkAsImageTag,
  uploadInputRef,
  appendUploadDrafts,
  configReady,
  queuedDrafts,
  uploadBusy,
  handleBatchUpload,
  uploadDrafts,
  copiedToken,
  handleCopyAll,
  handleExportAll,
  handleDraftAltChange,
  handleCopyResult,
  handleRemoveDraft,
}: BloggerUploadPanelProps) => (
        <div className="koma-cdn__layout">
          {/* Upload config */}
          <section className="koma-cdn__surface">
            <div className="koma-cdn__sec-head">
              <div>
                <h3>{t('blogger.uploadSection.title')}</h3>
                <p>{t('blogger.uploadSection.description')}</p>
              </div>
            </div>
            <div
              {...uploadDropzone.getRootProps({
                className: 'koma-cdn__dropzone',
              })}
            >
              <input {...uploadDropzone.getInputProps()} />
              <UploadCloud size={20} />
              <div>
                <strong>{t('blogger.uploadSection.dropTitle')}</strong>
                <p>{t('blogger.uploadSection.dropDescription')}</p>
              </div>
            </div>
            <div className="koma-cdn__option-grid">
              <label className="koma-cdn__toggle-card">
                <input
                  type="checkbox"
                  checked={batchOptimizerEnabled}
                  onChange={(e) => setBatchOptimizerEnabled(e.target.checked)}
                />
                <div>
                  <strong>{t('blogger.uploadSection.optimizedUrl')}</strong>
                  <p>{t('blogger.uploadSection.optimizedUrlDesc')}</p>
                </div>
              </label>
              <label className="koma-cdn__toggle-card">
                <input
                  type="checkbox"
                  checked={bulkPreferOptimizedUrl}
                  onChange={(e) => setBulkPreferOptimizedUrl(e.target.checked)}
                />
                <div>
                  <strong>{t('blogger.uploadSection.exportOptimized')}</strong>
                  <p>{t('blogger.uploadSection.exportOptimizedDesc')}</p>
                </div>
              </label>
              <label className="koma-cdn__toggle-card">
                <input
                  type="checkbox"
                  checked={bulkAsImageTag}
                  onChange={(e) => setBulkAsImageTag(e.target.checked)}
                />
                <div>
                  <strong>{t('blogger.uploadSection.outputImg')}</strong>
                  <p>{t('blogger.uploadSection.outputImgDesc')}</p>
                </div>
              </label>
            </div>
            <div className="koma-cdn__actions">
              <button
                type="button"
                className="koma-btn koma-btn--ghost koma-btn--sm"
                onClick={() => uploadInputRef.current?.click()}
              >
                <ImagePlus size={12} /> {t('blogger.uploadSection.select')}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--primary koma-btn--sm"
                disabled={!configReady || !queuedDrafts.length || uploadBusy}
                onClick={() => void handleBatchUpload()}
              >
                {uploadBusy ? (
                  <Loader2 size={12} className="koma-cdn-spin" />
                ) : (
                  <UploadCloud size={12} />
                )}{' '}
                {uploadBusy ? t('common.sending') : t('blogger.uploadSection.send')}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--ghost koma-btn--sm"
                disabled={uploadDrafts.every((i) => !i.result)}
                onClick={() => void handleCopyAll()}
              >
                <Copy size={12} />{' '}
                {copiedToken === 'copy-all' ? t('blogger.copied') : t('dashboard.translator.copy')}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--ghost koma-btn--sm"
                disabled={uploadDrafts.every((i) => !i.result)}
                onClick={handleExportAll}
              >
                <Copy size={12} />{' '}
                {copiedToken === 'export-all' ? t('blogger.uploadSection.exported') : '.txt'}
              </button>
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              hidden
              multiple
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                appendUploadDrafts(Array.from(e.target.files ?? []));
                e.currentTarget.value = '';
              }}
            />
          </section>

          {/* File queue */}
          <section className="koma-cdn__surface">
            <div className="koma-cdn__sec-head">
              <div>
                <h3>{t('blogger.queue.title')}</h3>
                <p>{t('blogger.queue.items', { count: uploadDrafts.length })}</p>
              </div>
            </div>
            <div className="koma-cdn__list">
              {!uploadDrafts.length ? (
                <div className="koma-cdn__empty">{t('blogger.queue.empty')}</div>
              ) : (
                uploadDrafts.map((item) => (
                  <article key={item.id} className="koma-cdn__item">
                    <img
                      src={item.previewUrl}
                      alt={item.altText}
                      className="koma-cdn__thumb"
                    />
                    <div className="koma-cdn__meta">
                      <div className="koma-cdn__meta-top">
                        <strong>{item.file.name}</strong>
                        <span
                          className={`koma-cdn__badge koma-cdn__badge--${item.status}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <input
                        className="koma-cdn__input"
                        value={item.altText}
                        onChange={(e) =>
                          handleDraftAltChange(item.id, e.target.value)
                        }
                        placeholder={t('blogger.queue.altText')}
                      />
                      {item.result && (
                        <div className="koma-cdn__result-grid">
                          <label className="koma-cdn__result-field">
                            <span>{t('blogger.queue.canonical')}</span>
                            <input
                              readOnly
                              value={item.result.canonicalUrl}
                              className="koma-cdn__input koma-cdn__input--mono"
                            />
                          </label>
                          <label className="koma-cdn__result-field">
                            <span>{t('blogger.queue.optimized')}</span>
                            <input
                              readOnly
                              value={item.result.optimizedUrl ?? ''}
                              className="koma-cdn__input koma-cdn__input--mono"
                            />
                          </label>
                        </div>
                      )}
                      {item.error && (
                        <p className="koma-cdn__error-text">{item.error}</p>
                      )}
                    </div>
                    <div className="koma-cdn__item-actions">
                      {item.result && (
                        <>
                          <button
                            type="button"
                            className="koma-cdn__mini-btn"
                            onClick={() =>
                              void handleCopyResult(
                                `${item.id}:canonical`,
                                item.result?.canonicalUrl ?? '',
                              )
                            }
                          >
                            <Copy size={11} />{' '}
                            {copiedToken === `${item.id}:canonical`
                              ? '✓'
                              : t('blogger.queue.url')}
                          </button>
                          <button
                            type="button"
                            className="koma-cdn__mini-btn"
                            disabled={!item.result.optimizedUrl}
                            onClick={() =>
                              void handleCopyResult(
                                `${item.id}:optimized`,
                                item.result?.optimizedUrl ?? '',
                              )
                            }
                          >
                            <ExternalLink size={11} />{' '}
                            {copiedToken === `${item.id}:optimized`
                              ? '✓'
                              : t('blogger.queue.opt')}
                          </button>
                          <button
                            type="button"
                            className="koma-cdn__mini-btn"
                            onClick={() =>
                              void handleCopyResult(
                                `${item.id}:tag`,
                                item.result?.imageTag ?? '',
                              )
                            }
                          >
                            <Link2 size={11} />{' '}
                            {copiedToken === `${item.id}:tag` ? '✓' : t('blogger.queue.img')}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="koma-cdn__mini-btn koma-cdn__mini-btn--danger"
                        onClick={() => handleRemoveDraft(item.id)}
                      >
                        {t('common.remove')}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
);
