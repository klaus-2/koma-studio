'use client';

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  FileCode2,
  FileImage,
  Gauge,
  ImagePlus,
  KeyRound,
  Link2,
  Loader2,
  Network,
  Settings2,
  UploadCloud,
  X,
} from 'lucide-react';

import { useI18n } from '@/i18n';
import type {
  ImgurRateLimitStatus,
  ImgurUploadResult,
} from '@/types';
import { DEFAULT_IMGUR_CONFIG } from '@/types';
import {
  buildImgurBulkOutput,
  loadImgurConfig,
  preprocessImgurImageFile,
  uploadImgurImages,
} from '@/services/imgur';

import {
  CDN_IMAGE_ACCEPT,
  CdnMetric,
  copyText,
  downloadTextFile,
  EditorialCdnHero,
  EditorialCdnPanel,
  EmptyQueue,
  KomaSwitchCard,
  KOMA_EASE,
  QueueStatusBadge,
  type QueueItemStatus,
  WorkspaceNotice,
} from './CdnV2Primitives';

interface ImgurWorkspaceProps {
  onOpenSettings?: () => void;
}

interface UploadDraftItem {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
  status: QueueItemStatus;
  result: ImgurUploadResult | null;
  error: string | null;
}

export function ImgurWorkspaceV2({
  onOpenSettings,
}: ImgurWorkspaceProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  const [configReady, setConfigReady] =
    useState(false);

  const [rateLimit, setRateLimit] =
    useState<ImgurRateLimitStatus>({
      limitPerHour:
        DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
      usedThisHour: 0,
      remainingThisHour:
        DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
      resetsAt: null,
    });

  const [
    workspaceError,
    setWorkspaceError,
  ] = useState<string | null>(null);

  const [
    workspaceFeedback,
    setWorkspaceFeedback,
  ] = useState<string | null>(null);

  const [uploadDrafts, setUploadDrafts] =
    useState<UploadDraftItem[]>([]);

  const [uploadBusy, setUploadBusy] =
    useState(false);

  const [
    bulkAsImageTag,
    setBulkAsImageTag,
  ] = useState(false);

  const [copiedToken, setCopiedToken] =
    useState<string | null>(null);

  const uploadInputRef =
    useRef<HTMLInputElement | null>(null);

  const uploadDraftsRef =
    useRef<UploadDraftItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadImgurConfig()
      .then(
        ({
          config,
          rateLimit: status,
        }) => {
          if (cancelled) return;

          setConfigReady(
            config.keys.some(
              (item) =>
                item.enabled &&
                item.clientId.trim().length >
                0,
            ),
          );

          setRateLimit(status);
        },
      )
      .catch((error) => {
        if (cancelled) return;

        setWorkspaceError(
          error instanceof Error
            ? error.message
            : t(
              'imgur.error.configLoad',
            ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    uploadDraftsRef.current =
      uploadDrafts;
  }, [uploadDrafts]);

  useEffect(
    () => () => {
      uploadDraftsRef.current.forEach(
        (item) => {
          URL.revokeObjectURL(
            item.previewUrl,
          );
        },
      );
    },
    [],
  );

  useEffect(() => {
    if (!copiedToken) return;

    const timeoutId = window.setTimeout(
      () => setCopiedToken(null),
      1400,
    );

    return () =>
      window.clearTimeout(timeoutId);
  }, [copiedToken]);

  const appendUploadDrafts =
    useCallback((files: File[]) => {
      const nextDrafts =
        files.map<UploadDraftItem>(
          (file) => ({
            id: crypto.randomUUID(),
            file,
            altText: file.name.replace(
              /\.[^.]+$/u,
              '',
            ),
            previewUrl:
              URL.createObjectURL(file),
            status: 'queued',
            result: null,
            error: null,
          }),
        );

      setUploadDrafts((current) => [
        ...current,
        ...nextDrafts,
      ]);
    }, []);

  const uploadDropzone = useDropzone({
    accept: CDN_IMAGE_ACCEPT,
    multiple: true,
    onDrop: appendUploadDrafts,
  });

  const handleDraftAltChange =
    useCallback(
      (
        draftId: string,
        value: string,
      ) => {
        setUploadDrafts((current) =>
          current.map((item) =>
            item.id === draftId
              ? {
                ...item,
                altText: value,
              }
              : item,
          ),
        );
      },
      [],
    );

  const handleRemoveDraft = useCallback(
    (draftId: string) => {
      setUploadDrafts((current) => {
        const target = current.find(
          (item) => item.id === draftId,
        );

        if (target) {
          URL.revokeObjectURL(
            target.previewUrl,
          );
        }

        return current.filter(
          (item) => item.id !== draftId,
        );
      });
    },
    [],
  );

  const queuedDrafts = useMemo(
    () =>
      uploadDrafts.filter(
        (item) =>
          item.status !== 'uploaded',
      ),
    [uploadDrafts],
  );

  const completedDrafts = useMemo(
    () =>
      uploadDrafts.filter(
        (item) =>
          item.status === 'uploaded',
      ),
    [uploadDrafts],
  );

  const handleBatchUpload =
    useCallback(async () => {
      if (queuedDrafts.length === 0) {
        return;
      }

      setUploadBusy(true);
      setWorkspaceError(null);
      setWorkspaceFeedback(null);

      try {
        setUploadDrafts((current) =>
          current.map((item) =>
            queuedDrafts.some(
              (draft) =>
                draft.id === item.id,
            )
              ? {
                ...item,
                status: 'processing',
                error: null,
              }
              : item,
          ),
        );

        const preparedItems =
          await Promise.all(
            queuedDrafts.map(
              async (draft) => {
                const prepared =
                  await preprocessImgurImageFile(
                    draft.file,
                  );

                return {
                  ...prepared,
                  id: draft.id,
                  altText: draft.altText,
                };
              },
            ),
          );

        const response =
          await uploadImgurImages({
            items: preparedItems,
          });

        const resultById = new Map(
          response.items.map((item) => [
            item.id,
            item,
          ]),
        );

        setUploadDrafts((current) =>
          current.map((item) => {
            const result =
              resultById.get(item.id);

            if (!result) return item;

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
            ? t(
              'imgur.feedback.singleSuccess',
            )
            : t(
              'imgur.feedback.multiSuccess',
              {
                count:
                  response.items.length,
              },
            ),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t(
              'imgur.error.uploadFailed',
            );

        setUploadDrafts((current) =>
          current.map((item) =>
            queuedDrafts.some(
              (draft) =>
                draft.id === item.id,
            )
              ? {
                ...item,
                status: 'error',
                error: message,
              }
              : item,
          ),
        );

        setWorkspaceError(message);
      } finally {
        setUploadBusy(false);
      }
    }, [queuedDrafts, t]);

  const handleCopyResult = useCallback(
    async (
      token: string,
      value: string,
    ) => {
      await copyText(value);
      setCopiedToken(token);
    },
    [],
  );

  const handleCopyAll =
    useCallback(async () => {
      const results = uploadDrafts
        .map((item) => item.result)
        .filter(
          (
            item,
          ): item is ImgurUploadResult =>
            Boolean(item),
        );

      if (results.length === 0) return;

      await copyText(
        buildImgurBulkOutput(
          results,
          bulkAsImageTag,
        ),
      );

      setCopiedToken('copy-all');
    }, [
      bulkAsImageTag,
      uploadDrafts,
    ]);

  const handleExportAll =
    useCallback(() => {
      const results = uploadDrafts
        .map((item) => item.result)
        .filter(
          (
            item,
          ): item is ImgurUploadResult =>
            Boolean(item),
        );

      if (results.length === 0) return;

      downloadTextFile(
        'imgur-urls.txt',
        buildImgurBulkOutput(
          results,
          bulkAsImageTag,
        ),
      );

      setCopiedToken('export-all');
    }, [
      bulkAsImageTag,
      uploadDrafts,
    ]);

  const rateUsagePercent = useMemo(() => {
    if (rateLimit.limitPerHour <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (rateLimit.usedThisHour /
            rateLimit.limitPerHour) *
          100,
        ),
      ),
    );
  }, [rateLimit]);

  return (
    <div
      className="relative isolate space-y-4"
    >
      <EditorialCdnHero
        index="04"
        eyebrow={t(
          'imgur.hero.eyebrow',
        )}
        title={t('imgur.hero.title')}
        accentWord="relay"
        description={t(
          'imgur.hero.desc',
        )}
        serviceCode="Imgur / CDN Node"
        statusReady={configReady}
        statusText={
          configReady
            ? t(
              'imgur.status.remaining',
              {
                remaining:
                  rateLimit.remainingThisHour,
              },
            )
            : t(
              'imgur.status.configure',
            )
        }
        accent="azure"
      >
        <CdnMetric
          icon={Gauge}
          value={`${rateLimit.remainingThisHour}`}
          label="Remaining"
          tone="mint"
        />

        <CdnMetric
          icon={Network}
          value={`${rateUsagePercent}%`}
          label="Usage"
          tone={
            rateUsagePercent > 80
              ? 'crimson'
              : 'azure'
          }
        />

        <CdnMetric
          icon={FileImage}
          value={completedDrafts.length}
          label="Uploaded"
          tone="gold"
        />
      </EditorialCdnHero>

      <AnimatePresence>
        {!configReady ? (
          <WorkspaceNotice
            key="configuration"
            tone="warning"
            icon={AlertTriangle}
            action={
              <button
                type="button"
                className="btn-ghost !min-h-9 !px-3 !py-2"
                onClick={() =>
                  onOpenSettings?.()
                }
              >
                <Settings2 size={13} />
                Settings
              </button>
            }
          >
            <strong className="block font-display text-xs font-black uppercase text-gold">
              {t(
                'imgur.alert.missingConfig',
              )}
            </strong>

            <span>
              {t(
                'imgur.alert.addActiveClient',
              )}
            </span>
          </WorkspaceNotice>
        ) : null}

        {workspaceError ? (
          <WorkspaceNotice
            key="error"
            tone="error"
            icon={AlertTriangle}
          >
            {workspaceError}
          </WorkspaceNotice>
        ) : null}

        {workspaceFeedback ? (
          <WorkspaceNotice
            key="feedback"
            tone="success"
            icon={UploadCloud}
          >
            {workspaceFeedback}
          </WorkspaceNotice>
        ) : null}
      </AnimatePresence>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* Controller */}
        <EditorialCdnPanel
          index="01"
          icon={Network}
          kicker="Relay controller"
          title={t('imgur.batch.title')}
          description={t(
            'imgur.batch.limit',
            {
              limit:
                rateLimit.limitPerHour,
              used:
                rateLimit.usedThisHour,
            },
          )}
          action={
            <button
              type="button"
              className="btn-ghost !min-h-9 !px-3 !py-2"
              onClick={() =>
                onOpenSettings?.()
              }
            >
              <Settings2 size={13} />
              Settings
            </button>
          }
        >
          <div className="space-y-4 p-4 sm:p-5">
            {/* Rate-limit meter */}
            <div className="panel-cut-sm border border-paper/10 bg-ink/48 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span>
                  <span className="kicker block text-[0.56rem]">
                    API budget
                  </span>

                  <strong className="mt-1 block font-display text-sm font-black uppercase text-paper">
                    {rateLimit.usedThisHour}/
                    {rateLimit.limitPerHour}
                  </strong>
                </span>

                <span
                  className={[
                    'stamp',
                    rateUsagePercent > 80
                      ? ''
                      : '!border-azure/45 !bg-azure/10 !text-azure',
                  ].join(' ')}
                >
                  {rateUsagePercent}%
                </span>
              </div>

              <div
                className="h-2 overflow-hidden bg-paper/[0.055] panel-cut-sm"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={
                  rateLimit.limitPerHour
                }
                aria-valuenow={
                  rateLimit.usedThisHour
                }
              >
                <m.div
                  initial={
                    reduceMotion
                      ? false
                      : {
                        scaleX: 0,
                      }
                  }
                  animate={{
                    scaleX: rateUsagePercent / 100,
                  }}
                  transition={{
                    duration:
                      reduceMotion
                        ? 0
                        : 0.72,
                    ease: KOMA_EASE,
                  }}
                  className={[
                    'h-full',
                    'w-full',
                    'origin-left',
                    rateUsagePercent > 80
                      ? 'bg-crimson'
                      : rateUsagePercent >
                        55
                        ? 'bg-gold'
                        : 'bg-azure',
                  ].join(' ')}
                />
              </div>

              <div className="mt-2 flex justify-between font-mono text-[0.55rem] uppercase tracking-[0.1em] text-paper/28">
                <span>Used</span>
                <span>
                  {
                    rateLimit.remainingThisHour
                  }{' '}
                  remaining
                </span>
              </div>
            </div>

            {/* Dropzone */}
            <div
              {...uploadDropzone.getRootProps({
                className: [
                  'panel-cut-sm halftone relative flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-all',
                  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure',
                  uploadDropzone.isDragActive
                    ? 'border-azure bg-azure/10 -translate-y-1 shadow-[4px_4px_0_var(--color-azure)]'
                    : 'border-paper/15 hover:-translate-y-0.5 hover:border-azure/60',
                  uploadDropzone.isDragReject
                    ? '!border-crimson !bg-crimson/10'
                    : '',
                ].join(' '),
                'aria-label': t(
                  'imgur.dropzone.title',
                ),
              })}
            >
              <input
                {...uploadDropzone.getInputProps()}
              />

              <span className="stamp panel-cut-sm flex size-12 items-center justify-center text-azure">
                <UploadCloud size={22} />
              </span>

              <div>
                <strong className="block font-display text-sm font-black uppercase tracking-tight text-paper">
                  {t(
                    'imgur.dropzone.title',
                  )}
                </strong>

                <p className="mt-1 font-mono text-[10px] text-paper/50">
                  {t(
                    'imgur.dropzone.desc',
                  )}
                </p>
              </div>
            </div>

            <KomaSwitchCard
              checked={bulkAsImageTag}
              onChange={setBulkAsImageTag}
              title={t(
                'imgur.toggle.imgOutput',
              )}
              description={t(
                'imgur.toggle.imgOutputDesc',
              )}
              icon={Code2}
              tone="azure"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  uploadInputRef.current?.click()
                }
              >
                <ImagePlus size={14} />
                {t(
                  'imgur.actions.select',
                )}
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={
                  !configReady ||
                  queuedDrafts.length === 0 ||
                  uploadBusy
                }
                onClick={() =>
                  void handleBatchUpload()
                }
              >
                {uploadBusy ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <UploadCloud size={14} />
                )}

                {uploadBusy
                  ? t(
                    'imgur.actions.sending',
                  )
                  : t(
                    'imgur.actions.send',
                  )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-paper/[0.065] pt-4">
              <button
                type="button"
                className="btn-ghost"
                disabled={
                  completedDrafts.length === 0
                }
                onClick={() =>
                  void handleCopyAll()
                }
              >
                {copiedToken ===
                  'copy-all' ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}

                {copiedToken === 'copy-all'
                  ? '✓'
                  : t(
                    'imgur.actions.copy',
                  )}
              </button>

              <button
                type="button"
                className="btn-ghost"
                disabled={
                  completedDrafts.length === 0
                }
                onClick={handleExportAll}
              >
                {copiedToken ===
                  'export-all' ? (
                  <Check size={14} />
                ) : (
                  <FileCode2 size={14} />
                )}

                {copiedToken ===
                  'export-all'
                  ? '✓'
                  : '.TXT'}
              </button>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              hidden
              multiple
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(event) => {
                appendUploadDrafts(
                  Array.from(
                    event.target.files ?? [],
                  ),
                );

                event.currentTarget.value = '';
              }}
            />
          </div>
        </EditorialCdnPanel>

        {/* Queue */}
        <EditorialCdnPanel
          index="02"
          icon={FileImage}
          kicker="Image manifest"
          title={t('imgur.queue.title')}
          description={
            uploadDrafts.length === 1
              ? t(
                'imgur.queue.items_one',
                {
                  count:
                    uploadDrafts.length,
                },
              )
              : t(
                'imgur.queue.items_other',
                {
                  count:
                    uploadDrafts.length,
                },
              )
          }
          action={
            uploadDrafts.length > 0 ? (
              <div className="flex gap-2">
                <span className="stamp !border-gold/45 !bg-gold/10 !text-gold">
                  {queuedDrafts.length} pending
                </span>

                <span className="stamp !border-mint/45 !bg-mint/10 !text-mint">
                  {completedDrafts.length} ready
                </span>
              </div>
            ) : null
          }
        >
          {uploadDrafts.length === 0 ? (
            <EmptyQueue
              message={t(
                'imgur.queue.empty',
              )}
            />
          ) : (
            <m.div
              layout
              className="grid gap-3 p-4"
            >
              <AnimatePresence initial={false}>
                {uploadDrafts.map(
                  (item, index) => (
                    <m.article
                      layout
                      key={item.id}
                      initial={
                        reduceMotion
                          ? false
                          : {
                            opacity: 0,
                            y: 14,
                          }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        x: 20,
                      }}
                      transition={{
                        duration:
                          reduceMotion
                            ? 0
                            : 0.35,
                        ease: KOMA_EASE,
                      }}
                      className="offset-card panel-cut-sm relative flex gap-4 overflow-hidden border border-paper/10 bg-ink/48 transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--color-gold)]"
                    >
                      {/* Thumb */}
                      <div className="panel-cut-sm relative h-20 w-16 shrink-0 overflow-hidden border border-paper/12">
                        <img
                          src={item.previewUrl}
                          alt={item.altText}
                          className="h-full w-full object-cover"
                        />

                        <span className="absolute bottom-0 left-0 bg-ink/90 px-1.5 py-0.5 font-mono text-[8px] text-crimson">
                          {String(
                            index + 1,
                          ).padStart(2, '0')}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="min-w-0 flex-1 space-y-2 py-3 pr-3">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="min-w-0 truncate font-mono text-[11px] text-paper">
                            {item.file.name}
                          </strong>

                          <QueueStatusBadge
                            status={item.status}
                          />
                        </div>

                        <input
                          className="koma-control"
                          value={item.altText}
                          disabled={
                            item.status ===
                            'processing'
                          }
                          onChange={(event) =>
                            handleDraftAltChange(
                              item.id,
                              event.target
                                .value,
                            )
                          }
                          placeholder={t(
                            'imgur.queue.altPlaceholder',
                          )}
                        />

                        {item.result ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-[0.1em] text-paper/30">
                                {t(
                                  'imgur.queue.urlLabel',
                                )}
                              </span>

                              <input
                                readOnly
                                value={
                                  item.result
                                    .directUrl
                                }
                                className="koma-control !font-mono !text-[0.62rem]"
                              />
                            </label>

                            <label className="block">
                              <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[0.54rem] uppercase tracking-[0.1em] text-paper/30">
                                <KeyRound
                                  size={10}
                                  className="text-gold"
                                />
                                {t(
                                  'imgur.queue.keyLabel',
                                )}
                              </span>

                              <input
                                readOnly
                                value={
                                  item.result
                                    .keyLabel
                                }
                                className="koma-control !font-mono !text-[0.62rem]"
                              />
                            </label>
                          </div>
                        ) : null}

                        {item.error ? (
                          <p
                            role="alert"
                            className="border-l-2 border-crimson bg-crimson/[0.055] px-3 py-2 text-xs leading-5 text-crimson panel-cut-sm"
                          >
                            {item.error}
                          </p>
                        ) : null}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {item.result ? (
                            <>
                              <button
                                type="button"
                                className="btn-ghost !min-h-9 !px-3 !py-2"
                                onClick={() =>
                                  void handleCopyResult(
                                    `${item.id}:direct`,
                                    item.result
                                      ?.directUrl ??
                                    '',
                                  )
                                }
                              >
                                {copiedToken ===
                                  `${item.id}:direct` ? (
                                  <Check
                                    size={13}
                                  />
                                ) : (
                                  <Copy
                                    size={13}
                                  />
                                )}

                                URL
                              </button>

                              <button
                                type="button"
                                className="btn-ghost !min-h-9 !px-3 !py-2"
                                onClick={() =>
                                  void handleCopyResult(
                                    `${item.id}:tag`,
                                    `<img src="${item.result?.directUrl ?? ''}" alt="${(item.result?.altText ?? '').replace(/"/g, '&quot;')}" />`,
                                  )
                                }
                              >
                                {copiedToken ===
                                  `${item.id}:tag` ? (
                                  <Check
                                    size={13}
                                  />
                                ) : (
                                  <Link2
                                    size={13}
                                  />
                                )}

                                IMG
                              </button>
                            </>
                          ) : null}

                          <button
                            type="button"
                            className="panel-cut-sm ml-auto inline-flex min-h-9 items-center justify-center gap-2 border border-crimson/25 bg-crimson/[0.045] px-3 font-mono text-[0.6rem] font-bold uppercase text-crimson transition hover:border-crimson hover:bg-crimson hover:text-ink"
                            onClick={() =>
                              handleRemoveDraft(
                                item.id,
                              )
                            }
                          >
                            <X size={13} />
                            {t(
                              'imgur.queue.remove',
                            )}
                          </button>
                        </div>
                      </div>
                    </m.article>
                  ),
                )}
              </AnimatePresence>
            </m.div>
          )}
        </EditorialCdnPanel>
      </div>
    </div>
  );
}

export default ImgurWorkspaceV2;

