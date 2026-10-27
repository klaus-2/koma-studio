'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Check,
  Copy,
  Gauge,
  ImagePlus,
  Link2,
  Loader2,
  Settings2,
  UploadCloud,
} from 'lucide-react';
import { useI18n } from '../../../i18n';

import type { ImgurRateLimitStatus, ImgurUploadResult } from '../../../types';
import { DEFAULT_IMGUR_CONFIG } from '../../../types';
import {
  buildImgurBulkOutput,
  loadImgurConfig,
  preprocessImgurImageFile,
  uploadImgurImages,
} from '../../../services/imgur';
import { NoirInput, Stamp, useNoirMotion } from '../../noir-panels/NoirPrimitives';
import {
  MiniBtn,
  NoirAlert,
  NoirAlertStack,
  QueueBadge,
  ResultField,
  SurfaceHead,
  ToggleCard,
  type QueueStatus,
} from '../../noir-panels/cdn';

type UploadItemStatus = QueueStatus;

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

/* Cor do gauge de rate-limit */
const rateColor = (remaining: number, limit: number): string => {
  const pct = limit > 0 ? remaining / limit : 0;
  if (pct > 0.5) return '#3ef2b0';
  if (pct > 0.2) return '#ffc857';
  return '#ff2e63';
};

export const ImgurWorkspaceNoir = ({ onOpenSettings }: ImgurWorkspaceProps) => {
  const { t } = useI18n();
  const motionProps = useNoirMotion();

  const [configReady, setConfigReady] = useState(false);
  const [rateLimit, setRateLimit] = useState<ImgurRateLimitStatus>({
    limitPerHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
    usedThisHour: 0,
    remainingThisHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
    resetsAt: null,
  });
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<string | null>(null);
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
          config.keys.some((item) => item.enabled && item.clientId.trim().length > 0),
        );
        setRateLimit(status);
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspaceError(
          error instanceof Error ? error.message : t('imgur.error.configLoad'),
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
      uploadDraftsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  useEffect(() => {
    if (!copiedToken) return;
    const timeoutId = window.setTimeout(() => setCopiedToken(null), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copiedToken]);

  const appendUploadDrafts = useCallback((files: File[]) => {
    const nextDrafts = files.map<UploadDraftItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      altText: file.name.replace(/\.[^.]+$/u, ''),
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
      result: null,
      error: null,
    }));
    setUploadDrafts((current) => [...current, ...nextDrafts]);
  }, []);

  const uploadDropzone = useDropzone({
    accept: ACCEPTED_IMAGE_TYPES,
    multiple: true,
    onDrop: appendUploadDrafts,
  });

  const handleDraftAltChange = useCallback((draftId: string, value: string) => {
    setUploadDrafts((current) =>
      current.map((item) => (item.id === draftId ? { ...item, altText: value } : item)),
    );
  }, []);

  const handleRemoveDraft = useCallback((draftId: string) => {
    setUploadDrafts((current) => {
      const target = current.find((item) => item.id === draftId);
      if (target) URL.revokeObjectURL(target.previewUrl);
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
          return { ...prepared, id: draft.id, altText: draft.altText };
        }),
      );

      const response = await uploadImgurImages({ items: preparedItems });

      const resultById = new Map(response.items.map((item) => [item.id, item]));
      setUploadDrafts((current) =>
        current.map((item) => {
          const result = resultById.get(item.id);
          if (!result) return item;
          return { ...item, status: 'uploaded', result, error: null };
        }),
      );
      setRateLimit(response.rateLimit);
      setWorkspaceFeedback(
        response.items.length === 1
          ? t('imgur.feedback.singleSuccess')
          : t('imgur.feedback.multiSuccess', { count: response.items.length }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t('imgur.error.uploadFailed');
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
    downloadTextFile('imgur-urls.txt', buildImgurBulkOutput(results, bulkAsImageTag));
    setCopiedToken('export-all');
  }, [bulkAsImageTag, uploadDrafts]);

  /* ════════════════ Render — Manga Noir ════════════════ */

  const ratePct =
    rateLimit.limitPerHour > 0
      ? Math.round((rateLimit.remainingThisHour / rateLimit.limitPerHour) * 100)
      : 0;
  const rateTint = rateColor(rateLimit.remainingThisHour, rateLimit.limitPerHour);

  return (
    <m.div
      variants={motionProps.container}
      initial={motionProps.initial}
      animate={motionProps.animate}
      className="flex flex-col gap-4"
    >
      {/* ── Hero ── */}
      <m.header variants={motionProps.item} className="glass panel-cut relative overflow-hidden p-5">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-7 right-4 select-none font-display text-[100px] font-black leading-none"
        >
          転送
        </span>
        <div className="halftone-red pointer-events-none absolute inset-y-0 right-0 w-44 opacity-40" aria-hidden />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-lg">
            <p className="kicker mb-2 flex items-center gap-2">
              <UploadCloud size={11} aria-hidden />
              {'// '}
              {t('imgur.hero.eyebrow')}
            </p>
            <h2 className="font-display text-2xl font-black uppercase leading-none tracking-tight text-paper">
              Imgur{' '}
              <em className="font-accent font-normal normal-case italic text-crimson">Direct</em>
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-paper/50">{t('imgur.hero.desc')}</p>
          </div>

          {/* Rate-limit gauge (hanko meter) */}
          <div className="flex flex-col items-end gap-2">
            <Stamp tone={configReady ? 'mint' : 'crimson'} blink={!configReady}>
              {configReady
                ? t('imgur.status.remaining', { remaining: rateLimit.remainingThisHour })
                : t('imgur.status.configure')}
            </Stamp>
            {configReady && (
              <div className="flex items-center gap-2">
                <Gauge size={11} className="text-paper/40" aria-hidden />
                <div
                  className="panel-cut-sm h-2 w-32 border border-paper/15 bg-ink p-px"
                  role="meter"
                  aria-valuenow={rateLimit.remainingThisHour}
                  aria-valuemin={0}
                  aria-valuemax={rateLimit.limitPerHour}
                >
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{ width: `${ratePct}%`, background: rateTint }}
                  />
                </div>
                <span className="font-mono text-[9px] text-paper/45">
                  {rateLimit.usedThisHour}/{rateLimit.limitPerHour}
                </span>
              </div>
            )}
          </div>
        </div>
      </m.header>

      {/* ── Alerts ── */}
      <NoirAlertStack>
        {!configReady && (
          <NoirAlert key="cfg" tone="warn" title={t('imgur.alert.missingConfig')}>
            {t('imgur.alert.addActiveClient')}
          </NoirAlert>
        )}
        {workspaceError && (
          <NoirAlert key="err" tone="error">
            {workspaceError}
          </NoirAlert>
        )}
        {workspaceFeedback && (
          <NoirAlert key="ok" tone="success">
            {workspaceFeedback}
          </NoirAlert>
        )}
      </NoirAlertStack>

      <div className="grid items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* ═══ Upload config ═══ */}
        <m.section variants={motionProps.item} className="glass panel-cut relative p-4">
          <span
            aria-hidden
            className="text-outline pointer-events-none absolute right-3 top-2 select-none font-display text-3xl font-black"
          >
            01
          </span>
          <SurfaceHead
            icon={UploadCloud}
            title={t('imgur.batch.title')}
            desc={t('imgur.batch.limit', {
              limit: rateLimit.limitPerHour,
              used: rateLimit.usedThisHour,
            })}
            right={
              <button type="button" className="btn-ghost" onClick={() => onOpenSettings?.()}>
                <Settings2 size={11} /> Settings
              </button>
            }
          />

          {/* Dropzone */}
          <div
            {...uploadDropzone.getRootProps({
              className: `noir-dropzone flex items-center gap-4 p-5 ${uploadDropzone.isDragActive ? 'noir-dropzone--active' : ''
                }`,
            })}
          >
            <input {...uploadDropzone.getInputProps()} />
            <span className="panel-cut-sm grid h-11 w-11 flex-none place-items-center bg-crimson/15 text-crimson">
              <UploadCloud size={20} />
            </span>
            <div>
              <strong className="block font-display text-[12px] font-extrabold uppercase tracking-wide text-paper">
                {t('imgur.dropzone.title')}
              </strong>
              <p className="mt-0.5 text-[10.5px] text-paper/45">{t('imgur.dropzone.desc')}</p>
            </div>
            <span
              aria-hidden
              className="v-text ml-auto hidden select-none font-mono text-[9px] tracking-[0.3em] text-paper/20 sm:block"
            >
              ドロップ
            </span>
          </div>

          <div className="mt-4">
            <ToggleCard
              checked={bulkAsImageTag}
              onChange={setBulkAsImageTag}
              title={t('imgur.toggle.imgOutput')}
              desc={t('imgur.toggle.imgOutputDesc')}
            />
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-paper/10 pt-4">
            <button type="button" className="btn-ghost" onClick={() => uploadInputRef.current?.click()}>
              <ImagePlus size={11} /> {t('imgur.actions.select')}
            </button>
            <button
              type="button"
              className="btn-primary !py-2 !text-[11px]"
              disabled={!configReady || !queuedDrafts.length || uploadBusy}
              onClick={() => void handleBatchUpload()}
            >
              {uploadBusy ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
              {uploadBusy ? t('imgur.actions.sending') : t('imgur.actions.send')}
              {!uploadBusy && (
                <span
                  aria-hidden
                  className="font-accent text-[13px] normal-case italic tracking-normal opacity-70"
                >
                  送信
                </span>
              )}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={uploadDrafts.every((i) => !i.result)}
              onClick={() => void handleCopyAll()}
            >
              {copiedToken === 'copy-all' ? <Check size={11} /> : <Copy size={11} />}
              {copiedToken === 'copy-all' ? '✓' : t('imgur.actions.copy')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={uploadDrafts.every((i) => !i.result)}
              onClick={handleExportAll}
            >
              {copiedToken === 'export-all' ? <Check size={11} /> : <Copy size={11} />}
              {copiedToken === 'export-all' ? '✓' : '.txt'}
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
        </m.section>

        {/* ═══ Queue ═══ */}
        <m.section variants={motionProps.item} className="glass panel-cut relative min-w-0 p-4">
          <span
            aria-hidden
            className="text-outline pointer-events-none absolute right-3 top-2 select-none font-display text-3xl font-black"
          >
            02
          </span>
          <SurfaceHead
            icon={ImagePlus}
            title={t('imgur.queue.title')}
            desc={
              uploadDrafts.length === 1
                ? t('imgur.queue.items_one', { count: uploadDrafts.length })
                : t('imgur.queue.items_other', { count: uploadDrafts.length })
            }
          />

          <div className="flex flex-col gap-3">
            {!uploadDrafts.length ? (
              <div className="flex flex-col items-center gap-2 border border-dashed border-paper/15 py-12 text-paper/35">
                <ImagePlus size={22} strokeWidth={1.2} />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
                  {t('imgur.queue.empty')}
                </span>
              </div>
            ) : (
              uploadDrafts.map((item) => (
                <article
                  key={item.id}
                  className={`panel-cut-sm flex gap-3 border p-3 transition-colors ${item.status === 'error'
                      ? 'border-crimson/40 bg-crimson/5'
                      : item.status === 'uploaded'
                        ? 'border-mint/25 bg-ink/50'
                        : 'border-paper/10 bg-ink/50'
                    }`}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.altText}
                    className="panel-cut-sm h-16 w-12 flex-none border border-paper/12 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <strong className="truncate font-mono text-[10.5px] font-bold text-paper">
                        {item.file.name}
                      </strong>
                      <QueueBadge status={item.status} label={item.status} />
                    </div>
                    <NoirInput
                      value={item.altText}
                      onChange={(e) => handleDraftAltChange(item.id, e.target.value)}
                      placeholder={t('imgur.queue.altPlaceholder')}
                    />
                    {item.result && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <ResultField
                          label={t('imgur.queue.urlLabel')}
                          value={item.result.directUrl}
                        />
                        <ResultField
                          label={t('imgur.queue.keyLabel')}
                          value={item.result.keyLabel}
                        />
                      </div>
                    )}
                    {item.error && (
                      <p className="mt-1.5 font-mono text-[10px] text-crimson">{item.error}</p>
                    )}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5">
                    {item.result && (
                      <>
                        <MiniBtn
                          onClick={() =>
                            void handleCopyResult(`${item.id}:direct`, item.result?.directUrl ?? '')
                          }
                        >
                          <Copy size={10} />
                          {copiedToken === `${item.id}:direct` ? '✓' : 'URL'}
                        </MiniBtn>
                        <MiniBtn
                          onClick={() =>
                            void handleCopyResult(
                              `${item.id}:tag`,
                              `<img src="${item.result?.directUrl ?? ''}" alt="${(item.result?.altText ?? '').replace(/"/g, '&quot;')}" />`,
                            )
                          }
                        >
                          <Link2 size={10} />
                          {copiedToken === `${item.id}:tag` ? '✓' : 'img'}
                        </MiniBtn>
                      </>
                    )}
                    <MiniBtn danger onClick={() => handleRemoveDraft(item.id)}>
                      {t('imgur.queue.remove')}
                    </MiniBtn>
                  </div>
                </article>
              ))
            )}
          </div>
        </m.section>
      </div>
    </m.div>
  );
};

export default ImgurWorkspaceNoir;
