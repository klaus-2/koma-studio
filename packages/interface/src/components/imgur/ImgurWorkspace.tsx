import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDropzone } from 'react-dropzone';
import {
  AlertTriangle,
  Copy,
  ImagePlus,
  Link2,
  Loader2,
  Settings2,
  UploadCloud,
} from 'lucide-react';
import { useI18n } from '../../i18n';

import type { ImgurRateLimitStatus, ImgurUploadResult } from '../../types';
import { DEFAULT_IMGUR_CONFIG } from '../../types';
import {
  buildImgurBulkOutput,
  loadImgurConfig,
  preprocessImgurImageFile,
  uploadImgurImages,
} from '../../services/imgur';
import '../blogger/CdnWorkspace.css';

type UploadItemStatus = 'queued' | 'processing' | 'uploaded' | 'error';

interface ImgurWorkspaceProps {
  onOpenSettings?: () => void;
}

interface UploadDraftItem {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
  status: UploadItemStatus;
  result: ImgurUploadResult | null;
  error: string | null;
}

const ACCEPTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const copyText = async (value: string): Promise<void> => {
  await navigator.clipboard.writeText(value);
};

const downloadTextFile = (fileName: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const ImgurWorkspace = ({ onOpenSettings }: ImgurWorkspaceProps) => {
  const { t } = useI18n();
  const [configReady, setConfigReady] = useState(false);
  const [rateLimit, setRateLimit] = useState<ImgurRateLimitStatus>({
    limitPerHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
    usedThisHour: 0,
    remainingThisHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
    resetsAt: null,
  });
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<string | null>(
    null,
  );
  const [uploadDrafts, setUploadDrafts] = useState<UploadDraftItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [bulkAsImageTag, setBulkAsImageTag] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDraftsRef = useRef<UploadDraftItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadImgurConfig()
      .then(({ config, rateLimit: status }) => {
        if (cancelled) return;
        setConfigReady(
          config.keys.some(
            (item) => item.enabled && item.clientId.trim().length > 0,
          ),
        );
        setRateLimit(status);
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : t('imgur.error.configLoad'),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    uploadDraftsRef.current = uploadDrafts;
  }, [uploadDrafts]);

  useEffect(
    () => () => {
      uploadDraftsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    },
    [],
  );

  useEffect(() => {
    if (!copiedToken) return;
    const timeoutId = window.setTimeout(() => setCopiedToken(null), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copiedToken]);

  const appendUploadDrafts = useCallback((files: File[]) => {
    const nextDrafts: UploadDraftItem[] = [];
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      nextDrafts.push({
        id: crypto.randomUUID(),
        file,
        altText: file.name.replace(/\.[^.]+$/u, ''),
        previewUrl,
        status: 'queued',
        result: null,
        error: null,
      });
    }
    setUploadDrafts((current) => [...current, ...nextDrafts]);
  }, []);

  const uploadDropzone = useDropzone({
    accept: ACCEPTED_IMAGE_TYPES,
    multiple: true,
    onDrop: appendUploadDrafts,
  });

  const handleDraftAltChange = useCallback((draftId: string, value: string) => {
    setUploadDrafts((current) =>
      current.map((item) =>
        item.id === draftId ? { ...item, altText: value } : item,
      ),
    );
  }, []);

  const handleRemoveDraft = useCallback((draftId: string) => {
    setUploadDrafts((current) => {
      const target = current.find((item) => item.id === draftId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== draftId);
    });
  }, []);

  const queuedDrafts = useMemo(
    () => uploadDrafts.filter((item) => item.status !== 'uploaded'),
    [uploadDrafts],
  );

  const handleBatchUpload = useCallback(async () => {
    if (queuedDrafts.length === 0) return;

    setUploadBusy(true);
    setWorkspaceError(null);
    setWorkspaceFeedback(null);

    try {
      setUploadDrafts((current) =>
        current.map((item) =>
          queuedDrafts.some((draft) => draft.id === item.id)
            ? { ...item, status: 'processing', error: null }
            : item,
        ),
      );

      const preparedItems = await Promise.all(
        queuedDrafts.map(async (draft) => {
          const prepared = await preprocessImgurImageFile(draft.file);
          return {
            ...prepared,
            id: draft.id,
            altText: draft.altText,
          };
        }),
      );

      const response = await uploadImgurImages({
        items: preparedItems,
      });

      const resultById = new Map(response.items.map((item) => [item.id, item]));
      setUploadDrafts((current) =>
        current.map((item) => {
          const result = resultById.get(item.id);
          if (!result) {
            return item;
          }
          return {
            ...item,
            status: 'uploaded',
            result,
            error: null,
          };
        }),
      );
      setRateLimit(response.rateLimit);
      setWorkspaceFeedback(
        response.items.length === 1
          ? t('imgur.feedback.singleSuccess')
          : t('imgur.feedback.multiSuccess', { count: response.items.length }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('imgur.error.uploadFailed');
      setUploadDrafts((current) =>
        current.map((item) =>
          queuedDrafts.some((draft) => draft.id === item.id)
            ? { ...item, status: 'error', error: message }
            : item,
        ),
      );
      setWorkspaceError(message);
    } finally {
      setUploadBusy(false);
    }
  }, [queuedDrafts, t]);

  const handleCopyResult = useCallback(async (token: string, value: string) => {
    await copyText(value);
    setCopiedToken(token);
  }, []);

  const handleCopyAll = useCallback(async () => {
    const results = uploadDrafts
      .map((item) => item.result)
      .filter((item): item is ImgurUploadResult => Boolean(item));
    if (results.length === 0) return;
    await copyText(buildImgurBulkOutput(results, bulkAsImageTag));
    setCopiedToken('copy-all');
  }, [bulkAsImageTag, uploadDrafts]);

  const handleExportAll = useCallback(() => {
    const results = uploadDrafts
      .map((item) => item.result)
      .filter((item): item is ImgurUploadResult => Boolean(item));
    if (results.length === 0) return;
    downloadTextFile(
      'imgur-urls.txt',
      buildImgurBulkOutput(results, bulkAsImageTag),
    );
    setCopiedToken('export-all');
  }, [bulkAsImageTag, uploadDrafts]);

  return (
    <div className="koma-cdn">
      {/* Hero */}
      <div className="koma-cdn__hero">
        <div className="koma-cdn__hero-info">
          <span className="koma-cdn__eyebrow">{t('imgur.hero.eyebrow')}</span>
          <h2 className="koma-cdn__title">
            {t('imgur.hero.title')}
          </h2>
          <p className="koma-cdn__desc">
            {t('imgur.hero.desc')}
          </p>
        </div>
        <div
          className={`koma-cdn__status${configReady ? ' koma-cdn__status--ready' : ''}`}
        >
          <span className="koma-cdn__status-dot" />
          {configReady
            ? t('imgur.status.remaining', { remaining: rateLimit.remainingThisHour })
            : t('imgur.status.configure')}
        </div>
      </div>

      {!configReady && (
        <div className="koma-cdn__alert koma-cdn__alert--warn" role="alert">
          <AlertTriangle size={13} className="koma-cdn__alert-icon" />
          <div>
            <strong>{t('imgur.alert.missingConfig')}</strong>
            <p>{t('imgur.alert.addActiveClient')}</p>
          </div>
        </div>
      )}
      {workspaceError && (
        <div className="koma-cdn__alert koma-cdn__alert--error" role="alert">
          <AlertTriangle size={13} className="koma-cdn__alert-icon" />
          <span>{workspaceError}</span>
        </div>
      )}
      {workspaceFeedback && (
        <div className="koma-cdn__alert koma-cdn__alert--success" role="status">
          <UploadCloud size={13} className="koma-cdn__alert-icon" />
          <span>{workspaceFeedback}</span>
        </div>
      )}

      <div className="koma-cdn__layout">
        {/* Upload config */}
        <section className="koma-cdn__surface">
          <div className="koma-cdn__sec-head">
            <div>
              <h3>{t('imgur.batch.title')}</h3>
              <p>
                {t('imgur.batch.limit', { limit: rateLimit.limitPerHour, used: rateLimit.usedThisHour })}
              </p>
            </div>
            <button
              type="button"
              className="koma-cdn__tab koma-cdn__tab--ghost"
              onClick={() => onOpenSettings?.()}
            >
              <Settings2 size={13} /> Settings
            </button>
          </div>

          <div
            {...uploadDropzone.getRootProps({
              className: 'koma-cdn__dropzone',
            })}
          >
            <input {...uploadDropzone.getInputProps()} />
            <UploadCloud size={20} />
            <div>
              <strong>{t('imgur.dropzone.title')}</strong>
              <p>{t('imgur.dropzone.desc')}</p>
            </div>
          </div>

          <label className="koma-cdn__toggle-card">
            <input
              type="checkbox"
              checked={bulkAsImageTag}
              onChange={(e) => setBulkAsImageTag(e.target.checked)}
            />
            <div>
              <strong>{t('imgur.toggle.imgOutput')}</strong>
              <p>{t('imgur.toggle.imgOutputDesc')}</p>
            </div>
          </label>

          <div className="koma-cdn__actions">
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              onClick={() => uploadInputRef.current?.click()}
            >
              <ImagePlus size={12} /> {t('imgur.actions.select')}
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
              {uploadBusy ? t('imgur.actions.sending') : t('imgur.actions.send')}
            </button>
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              disabled={uploadDrafts.every((i) => !i.result)}
              onClick={() => void handleCopyAll()}
            >
              <Copy size={12} /> {copiedToken === 'copy-all' ? '✓' : t('imgur.actions.copy')}
            </button>
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              disabled={uploadDrafts.every((i) => !i.result)}
              onClick={handleExportAll}
            >
              <Copy size={12} /> {copiedToken === 'export-all' ? '✓' : '.txt'}
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
              <h3>{t('imgur.queue.title')}</h3>
              <p>{uploadDrafts.length === 1 ? t('imgur.queue.items_one', { count: uploadDrafts.length }) : t('imgur.queue.items_other', { count: uploadDrafts.length })}</p>
            </div>
          </div>
          <div className="koma-cdn__list">
            {!uploadDrafts.length ? (
              <div className="koma-cdn__empty">{t('imgur.queue.empty')}</div>
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
                      placeholder={t('imgur.queue.altPlaceholder')}
                    />
                    {item.result && (
                      <div className="koma-cdn__result-grid">
                        <label className="koma-cdn__result-field">
                          <span>{t('imgur.queue.urlLabel')}</span>
                          <input
                            readOnly
                            value={item.result.directUrl}
                            className="koma-cdn__input koma-cdn__input--mono"
                          />
                        </label>
                        <label className="koma-cdn__result-field">
                          <span>{t('imgur.queue.keyLabel')}</span>
                          <input
                            readOnly
                            value={item.result.keyLabel}
                            className="koma-cdn__input"
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
                              `${item.id}:direct`,
                              item.result?.directUrl ?? '',
                            )
                          }
                        >
                          <Copy size={11} />{' '}
                          {copiedToken === `${item.id}:direct` ? '✓' : 'URL'}
                        </button>
                        <button
                          type="button"
                          className="koma-cdn__mini-btn"
                          onClick={() =>
                            void handleCopyResult(
                              `${item.id}:tag`,
                              `<img src="${item.result?.directUrl ?? ''}" alt="${(item.result?.altText ?? '').replace(/"/g, '&quot;')}" />`,
                            )
                          }
                        >
                          <Link2 size={11} />{' '}
                          {copiedToken === `${item.id}:tag` ? '✓' : 'img'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="koma-cdn__mini-btn koma-cdn__mini-btn--danger"
                      onClick={() => handleRemoveDraft(item.id)}
                    >
                      {t('imgur.queue.remove')}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ImgurWorkspace;

