'use client';

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  AlertTriangle,
  Bold,
  Check,
  Code2,
  Copy,
  Eye,
  ExternalLink,
  FileCode2,
  FileImage,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  NotebookPen,
  Quote,
  Save,
  Send,
  Settings2,
  Tags,
  Underline as UnderlineIcon,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  EditorContent,
  useEditor,
  type Editor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';

import {
  DEFAULT_BLOGGER_CONFIG,
  type BloggerUploadResult,
} from '@/types';
import {
  buildBloggerBulkOutput,
  deserializeBloggerLabels,
  loadBloggerConfig,
  preprocessBloggerImageFile,
  previewOptimizerUrl,
  publishBloggerPost,
  serializeBloggerLabels,
  uploadBloggerImages,
} from '@/services/blogger';
import { useI18n } from '@/i18n';

import {
  CDN_IMAGE_ACCEPT,
  CdnMetric,
  copyText,
  downloadTextFile,
  EditorialCdnHero,
  EditorialCdnPanel,
  EmptyQueue,
  formatFileSize,
  KomaSwitchCard,
  KOMA_EASE,
  QueueStatusBadge,
  type QueueItemStatus,
  WorkspaceNotice,
} from './CdnV2Primitives';

type BloggerWorkspaceTab =
  | 'publish'
  | 'upload';

type BloggerEditorView =
  | 'visual'
  | 'html'
  | 'preview';

interface BloggerWorkspaceProps {
  onOpenSettings?: () => void;
}

interface UploadDraftItem {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
  status: QueueItemStatus;
  result: BloggerUploadResult | null;
  error: string | null;
}

const ToolbarButton = ({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={title}
    aria-pressed={active}
    className={[
      'panel-cut-sm grid size-9 shrink-0 place-items-center border transition',
      active
        ? 'border-crimson bg-crimson text-ink drop-shadow-[3px_3px_0_#ffc857]'
        : 'border-paper/10 bg-ink/55 text-paper/45 hover:border-crimson/40 hover:bg-crimson/10 hover:text-crimson',
      disabled
        ? 'cursor-not-allowed opacity-30'
        : '',
    ].join(' ')}
    disabled={disabled}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);

const syncEditorFromHtml = (
  editor: Editor | null,
  html: string,
): void => {
  if (!editor) return;

  if (
    editor.getHTML().trim() === html.trim()
  ) {
    return;
  }

  editor.commands.setContent(html, {
    emitUpdate: false,
  });
};

const buildSafePreviewDocument = (
  html: string,
  localeTag: string,
): string => {
  const baseHref =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : '/';

  const sanitized = html
    .replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      '',
    )
    .replace(
      /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      '',
    )
    .replace(
      /<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi,
      '',
    );

  const trimmed = sanitized.trim();

  if (
    /<!doctype html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed)
  ) {
    return trimmed;
  }

  return `<!doctype html>
<html lang="${localeTag}">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <base href="${baseHref}" />
    <style>
      :root { color-scheme: light; }

      * { box-sizing: border-box; }

      body {
        max-width: 920px;
        margin: 0 auto;
        padding: 32px;
        font-family: Inter, system-ui, sans-serif;
        background: #ffffff;
        color: #111827;
        line-height: 1.75;
      }

      img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 24px auto;
      }

      a { color: #7c3aed; }

      blockquote {
        margin-left: 0;
        padding-left: 18px;
        border-left: 4px solid #ff2e63;
        color: #4b5563;
      }

      pre {
        overflow: auto;
        padding: 16px;
        background: #111827;
        color: #f9fafb;
      }
    </style>
  </head>
  <body>${trimmed}</body>
</html>`;
};

const mergeUploadedItems = (
  current: BloggerUploadResult[],
  incoming: BloggerUploadResult[],
): BloggerUploadResult[] => {
  const next = new Map<
    string,
    BloggerUploadResult
  >();

  current.forEach((item) => {
    next.set(item.canonicalUrl, item);
  });

  incoming.forEach((item) => {
    next.set(item.canonicalUrl, item);
  });

  return Array.from(next.values());
};

export function BloggerWorkspaceV2({
  onOpenSettings,
}: BloggerWorkspaceProps) {
  const { localeTag, t } = useI18n();
  const reduceMotion = useReducedMotion();

  const defaultEditorTemplate = useMemo(
    () =>
      `
<h2>${t('blogger.template.title')}</h2>
<p>${t('blogger.template.description')}</p>
<p>${t('blogger.template.insertPrefix')} <strong>${t('blogger.editor.insertImages')}</strong> ${t('blogger.template.insertSuffix')}</p>
`.trim(),
    [t],
  );

  const [workspaceTab, setWorkspaceTab] =
    useState<BloggerWorkspaceTab>('publish');

  const [editorView, setEditorView] =
    useState<BloggerEditorView>('visual');

  const [editorHtml, setEditorHtml] = useState(
    defaultEditorTemplate,
  );

  const [postTitle, setPostTitle] =
    useState('');

  const [
    postLabelsInput,
    setPostLabelsInput,
  ] = useState('');

  const [publishLive, setPublishLive] =
    useState(false);

  const [
    workspaceError,
    setWorkspaceError,
  ] = useState<string | null>(null);

  const [
    workspaceFeedback,
    setWorkspaceFeedback,
  ] = useState<string | null>(null);

  const [publishBusy, setPublishBusy] =
    useState(false);

  const [insertBusy, setInsertBusy] =
    useState(false);

  const [configReady, setConfigReady] =
    useState(false);

  const [defaultLabels, setDefaultLabels] =
    useState('');

  const [uploadDrafts, setUploadDrafts] =
    useState<UploadDraftItem[]>([]);

  const [uploadBusy, setUploadBusy] =
    useState(false);

  const [uploadedItems, setUploadedItems] =
    useState<BloggerUploadResult[]>([]);

  const [copiedToken, setCopiedToken] =
    useState<string | null>(null);

  const [
    batchOptimizerEnabled,
    setBatchOptimizerEnabled,
  ] = useState(true);

  const [
    bulkPreferOptimizedUrl,
    setBulkPreferOptimizedUrl,
  ] = useState(true);

  const [
    bulkAsImageTag,
    setBulkAsImageTag,
  ] = useState(false);

  const editorImageInputRef =
    useRef<HTMLInputElement | null>(null);

  const uploadInputRef =
    useRef<HTMLInputElement | null>(null);

  const uploadDraftsRef =
    useRef<UploadDraftItem[]>([]);

  const editorUploadHandlerRef = useRef<
    (
      files: File[],
      position?: number,
    ) => Promise<void>
  >(async () => undefined);

  const previewSrcDoc = useMemo(
    () =>
      buildSafePreviewDocument(
        editorHtml,
        localeTag,
      ),
    [editorHtml, localeTag],
  );

  useEffect(() => {
    let cancelled = false;

    void loadBloggerConfig()
      .then(({ config }) => {
        if (cancelled) return;

        setConfigReady(
          Boolean(
            config.clientId &&
            config.clientSecret &&
            config.refreshToken &&
            config.blogId,
          ),
        );

        setDefaultLabels(
          serializeBloggerLabels(
            config.defaultLabels,
          ),
        );

        setBatchOptimizerEnabled(
          config.optimizer.enabled,
        );
      })
      .catch((error) => {
        if (cancelled) return;

        setWorkspaceError(
          error instanceof Error
            ? error.message
            : t(
              'blogger.loadConfigFailed',
            ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    void fetch(
      '/resources/utilitys/blogger/default-post-template.html',
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            'template-unavailable',
          );
        }

        return response.text();
      })
      .then((template) => {
        if (cancelled) return;

        const normalized =
          template.trim() ||
          defaultEditorTemplate;

        setEditorHtml((current) =>
          current === defaultEditorTemplate
            ? normalized
            : current,
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [defaultEditorTemplate]);

  useEffect(() => {
    if (!copiedToken) return;

    const timeoutId = window.setTimeout(
      () => setCopiedToken(null),
      1400,
    );

    return () =>
      window.clearTimeout(timeoutId);
  }, [copiedToken]);

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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Underline,
      Image.configure({
        inline: false,
      }),
    ],
    content: editorHtml,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      setEditorHtml(nextEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'koma-editor-prosemirror',
        spellcheck: 'true',
      },
      handlePaste: (_view, event) => {
        const files = Array.from(
          event.clipboardData?.files ?? [],
        ).filter((file) =>
          file.type.startsWith('image/'),
        );

        if (files.length === 0) {
          return false;
        }

        event.preventDefault();

        void editorUploadHandlerRef.current(
          files,
        );

        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(
          event.dataTransfer?.files ?? [],
        ).filter((file) =>
          file.type.startsWith('image/'),
        );

        if (files.length === 0) {
          return false;
        }

        event.preventDefault();

        const position = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;

        void editorUploadHandlerRef.current(
          files,
          position,
        );

        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (editor.isEmpty && editorHtml.trim()) {
      editor.commands.setContent(
        editorHtml,
        {
          emitUpdate: false,
        },
      );
    }
  }, [editor, editorHtml]);

  const handleViewChange = useCallback(
    (nextView: BloggerEditorView) => {
      if (editorView === 'html') {
        syncEditorFromHtml(
          editor,
          editorHtml,
        );
      }

      setEditorView(nextView);
    },
    [editor, editorHtml, editorView],
  );

  const insertUploadedImagesIntoEditor =
    useCallback(
      (
        results: BloggerUploadResult[],
        position?: number,
      ) => {
        if (!editor || results.length === 0) {
          return;
        }

        const content = results.flatMap(
          (item, index) => {
            const blocks: Array<
              Record<string, unknown>
            > = [
                {
                  type: 'image',
                  attrs: {
                    src: item.canonicalUrl,
                    alt: item.altText,
                  },
                },
              ];

            if (
              index !==
              results.length - 1
            ) {
              blocks.push({
                type: 'paragraph',
              });
            }

            return blocks;
          },
        );

        if (
          typeof position === 'number'
        ) {
          editor
            .chain()
            .focus()
            .insertContentAt(
              position,
              content,
            )
            .run();

          return;
        }

        editor
          .chain()
          .focus()
          .insertContent(content)
          .run();
      },
      [editor],
    );

  const handleEditorImageUpload =
    useCallback(
      async (
        files: File[],
        position?: number,
      ) => {
        if (files.length === 0) return;

        setInsertBusy(true);
        setWorkspaceError(null);
        setWorkspaceFeedback(null);

        try {
          const configPayload =
            await loadBloggerConfig();

          const config =
            configPayload.config ??
            DEFAULT_BLOGGER_CONFIG;

          const preparedItems =
            await Promise.all(
              files.map(async (file) => {
                const prepared =
                  await preprocessBloggerImageFile(
                    file,
                    config.preprocess,
                  );

                return {
                  ...prepared,
                  altText: file.name.replace(
                    /\.[^.]+$/u,
                    '',
                  ),
                };
              }),
            );

          const result =
            await uploadBloggerImages({
              items: preparedItems,
            });

          setUploadedItems((current) =>
            mergeUploadedItems(
              current,
              result.items,
            ),
          );

          insertUploadedImagesIntoEditor(
            result.items,
            position,
          );

          setWorkspaceFeedback(
            result.items.length === 1
              ? t(
                'blogger.imageInsertedSingle',
              )
              : t(
                'blogger.imageInsertedMany',
                {
                  count:
                    result.items.length,
                },
              ),
          );
        } catch (error) {
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : t(
                'blogger.uploadFailed',
              ),
          );
        } finally {
          setInsertBusy(false);
        }
      },
      [
        insertUploadedImagesIntoEditor,
        t,
      ],
    );

  editorUploadHandlerRef.current =
    handleEditorImageUpload;

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
        const configPayload =
          await loadBloggerConfig();

        const config =
          configPayload.config ??
          DEFAULT_BLOGGER_CONFIG;

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
                  await preprocessBloggerImageFile(
                    draft.file,
                    config.preprocess,
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
          await uploadBloggerImages({
            items: preparedItems,
          });

        const effectiveItems =
          response.items.map((item) => ({
            ...item,
            optimizedUrl:
              batchOptimizerEnabled
                ? (item.optimizedUrl ??
                  previewOptimizerUrl(
                    config,
                    item.canonicalUrl,
                  ))
                : null,
          }));

        const resultById = new Map(
          effectiveItems.map((item) => [
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

        setUploadedItems((current) =>
          mergeUploadedItems(
            current,
            effectiveItems,
          ),
        );

        setWorkspaceFeedback(
          effectiveItems.length === 1
            ? t(
              'blogger.batchUploadSuccessSingle',
            )
            : t(
              'blogger.batchUploadSuccessMany',
              {
                count:
                  effectiveItems.length,
              },
            ),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t(
              'blogger.uploadFailedShort',
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
    }, [
      batchOptimizerEnabled,
      queuedDrafts,
      t,
    ]);

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
          ): item is BloggerUploadResult =>
            Boolean(item),
        );

      if (results.length === 0) return;

      await copyText(
        buildBloggerBulkOutput(results, {
          preferOptimizedUrl:
            bulkPreferOptimizedUrl,
          asImageTag: bulkAsImageTag,
        }),
      );

      setCopiedToken('copy-all');
    }, [
      bulkAsImageTag,
      bulkPreferOptimizedUrl,
      uploadDrafts,
    ]);

  const handleExportAll =
    useCallback(() => {
      const results = uploadDrafts
        .map((item) => item.result)
        .filter(
          (
            item,
          ): item is BloggerUploadResult =>
            Boolean(item),
        );

      if (results.length === 0) return;

      const content =
        buildBloggerBulkOutput(results, {
          preferOptimizedUrl:
            bulkPreferOptimizedUrl,
          asImageTag: bulkAsImageTag,
        });

      downloadTextFile(
        'blogger-cdn-urls.txt',
        content,
      );

      setCopiedToken('export-all');
    }, [
      bulkAsImageTag,
      bulkPreferOptimizedUrl,
      uploadDrafts,
    ]);

  const handlePublishPost =
    useCallback(async () => {
      setPublishBusy(true);
      setWorkspaceError(null);
      setWorkspaceFeedback(null);

      try {
        if (editorView === 'html') {
          syncEditorFromHtml(
            editor,
            editorHtml,
          );
        }

        const labels = [
          ...deserializeBloggerLabels(
            defaultLabels,
          ),
          ...deserializeBloggerLabels(
            postLabelsInput,
          ),
        ];

        const result =
          await publishBloggerPost({
            title: postTitle,
            html:
              editorView === 'html'
                ? editorHtml
                : (editor?.getHTML() ??
                  editorHtml),
            labels,
            publish: publishLive,
            uploadedImages: uploadedItems,
          });

        const verb = result.isDraft
          ? t(
            'blogger.post.status.draft',
          )
          : t(
            'blogger.post.status.published',
          );

        setWorkspaceFeedback(
          result.postUrl
            ? t(
              'blogger.publishSuccessWithUrl',
              {
                verb,
                url: result.postUrl,
              },
            )
            : t(
              'blogger.publishSuccessWithId',
              {
                verb,
                id: result.postId,
              },
            ),
        );
      } catch (error) {
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : t(
              'blogger.publishFailed',
            ),
        );
      } finally {
        setPublishBusy(false);
      }
    }, [
      defaultLabels,
      editor,
      editorHtml,
      editorView,
      postLabelsInput,
      postTitle,
      publishLive,
      t,
      uploadedItems,
    ]);

  const publishLabelPreview =
    useMemo(
      () => [
        ...deserializeBloggerLabels(
          defaultLabels,
        ),
        ...deserializeBloggerLabels(
          postLabelsInput,
        ),
      ],
      [defaultLabels, postLabelsInput],
    );

  const editorViewButton = (
    view: BloggerEditorView,
  ) =>
    [
      'panel-cut-sm inline-flex min-h-9 items-center justify-center gap-2 border px-3',
      'font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] transition',
      editorView === view
        ? 'border-crimson bg-crimson text-ink drop-shadow-[3px_3px_0_#ffc857]'
        : 'border-paper/10 bg-ink/55 text-paper/42 hover:border-paper/25 hover:text-paper',
    ].join(' ');

  return (
    <div
      className="relative isolate space-y-4"
    >
      <EditorialCdnHero
        index="03"
        eyebrow={t('blogger.title')}
        title={t('blogger.heroTitle')}
        accentWord="press"
        description={t(
          'blogger.heroDescription',
        )}
        serviceCode="Blogger / Editorial"
        statusReady={configReady}
        statusText={
          configReady
            ? t('blogger.ready')
            : t(
              'blogger.configureInSettings',
            )
        }
      >
        <CdnMetric
          icon={FileImage}
          value={uploadedItems.length}
          label="Media"
          tone="crimson"
        />

        <CdnMetric
          icon={Tags}
          value={
            publishLabelPreview.length
          }
          label="Labels"
          tone="gold"
        />

        <CdnMetric
          icon={publishLive ? Send : Save}
          value={
            publishLive
              ? t(
                'blogger.post.publishNow',
              )
              : t('blogger.post.draft')
          }
          label="Mode"
          tone={
            publishLive
              ? 'mint'
              : 'azure'
          }
        />
      </EditorialCdnHero>

      {/* Navigation */}
      <nav
        className="glass panel-cut flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
        role="tablist"
        aria-label={t('blogger.title')}
      >
        <button
          id="blogger-tab-publish"
          type="button"
          role="tab"
          aria-controls="blogger-panel-publish"
          aria-selected={
            workspaceTab === 'publish'
          }
          className={[
            'panel-cut-sm inline-flex min-h-11 items-center justify-center gap-2 border px-4',
            'font-mono text-[0.68rem] font-black uppercase tracking-[0.08em] transition',
            workspaceTab === 'publish'
              ? 'border-crimson bg-crimson text-ink drop-shadow-[4px_4px_0_#ffc857]'
              : 'border-paper/10 bg-paper/[0.025] text-paper/45 hover:border-crimson/40 hover:text-paper',
          ].join(' ')}
          onClick={() =>
            setWorkspaceTab('publish')
          }
        >
          <NotebookPen
            size={14}
            aria-hidden="true"
          />
          {t('blogger.publishTab')}
        </button>

        <button
          id="blogger-tab-upload"
          type="button"
          role="tab"
          aria-controls="blogger-panel-upload"
          aria-selected={
            workspaceTab === 'upload'
          }
          className={[
            'panel-cut-sm inline-flex min-h-11 items-center justify-center gap-2 border px-4',
            'font-mono text-[0.68rem] font-black uppercase tracking-[0.08em] transition',
            workspaceTab === 'upload'
              ? 'border-azure bg-azure text-ink drop-shadow-[4px_4px_0_rgba(255,46,99,0.75)]'
              : 'border-paper/10 bg-paper/[0.025] text-paper/45 hover:border-azure/40 hover:text-paper',
          ].join(' ')}
          onClick={() =>
            setWorkspaceTab('upload')
          }
        >
          <UploadCloud
            size={14}
            aria-hidden="true"
          />
          {t('blogger.uploadTab')}

          {uploadDrafts.length > 0 ? (
            <span className="grid min-w-5 place-items-center bg-ink px-1 py-0.5 text-[0.55rem] text-paper">
              {uploadDrafts.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="btn-ghost sm:ml-auto"
          onClick={() =>
            onOpenSettings?.()
          }
        >
          <Settings2
            size={14}
            aria-hidden="true"
          />
          {t('blogger.settings')}
        </button>
      </nav>

      {/* Notices */}
      <AnimatePresence>
        {!configReady ? (
          <WorkspaceNotice
            key="config"
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
                <Settings2
                  size={13}
                  aria-hidden="true"
                />
                {t('blogger.settings')}
              </button>
            }
          >
            <strong className="block font-display text-xs font-black uppercase text-gold">
              {t(
                'blogger.missingConfigTitle',
              )}
            </strong>

            <span>
              {t(
                'blogger.missingConfigBody',
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
            icon={Check}
          >
            {workspaceFeedback}
          </WorkspaceNotice>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {workspaceTab === 'publish' ? (
          <motion.div
            key="publish"
            id="blogger-panel-publish"
            role="tabpanel"
            aria-labelledby="blogger-tab-publish"
            initial={
              reduceMotion
                ? false
                : {
                  opacity: 0,
                  x: -18,
                }
            }
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: 18,
            }}
            transition={{
              duration:
                reduceMotion ? 0 : 0.42,
              ease: KOMA_EASE,
            }}
            className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"
          >
            {/* Metadata */}
            <EditorialCdnPanel
              index="01"
              icon={NotebookPen}
              kicker="Post metadata"
              title={t(
                'blogger.post.title',
              )}
              description={t(
                'blogger.post.description',
              )}
              sticky
            >
              <div className="space-y-5 p-4 sm:p-5">
                <label className="block">
                  <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/45">
                    {t(
                      'blogger.post.postTitle',
                    )}
                  </span>

                  <input
                    className="koma-control"
                    value={postTitle}
                    onChange={(event) =>
                      setPostTitle(
                        event.target.value,
                      )
                    }
                    placeholder={t(
                      'blogger.post.postTitlePlaceholder',
                    )}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/45">
                    {t(
                      'blogger.post.defaultLabels',
                    )}
                  </span>

                  <input
                    className="koma-control"
                    value={defaultLabels}
                    onChange={(event) =>
                      setDefaultLabels(
                        event.target.value,
                      )
                    }
                    placeholder={t(
                      'blogger.post.defaultLabelsPlaceholder',
                    )}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/45">
                    {t(
                      'blogger.post.postLabels',
                    )}
                  </span>

                  <input
                    className="koma-control"
                    value={postLabelsInput}
                    onChange={(event) =>
                      setPostLabelsInput(
                        event.target.value,
                      )
                    }
                    placeholder={t(
                      'blogger.post.postLabelsPlaceholder',
                    )}
                  />
                </label>

                <KomaSwitchCard
                  checked={publishLive}
                  onChange={setPublishLive}
                  title={
                    publishLive
                      ? t(
                        'blogger.post.publishNow',
                      )
                      : t(
                        'blogger.post.draft',
                      )
                  }
                  icon={
                    publishLive
                      ? Send
                      : Save
                  }
                  tone={
                    publishLive
                      ? 'crimson'
                      : 'azure'
                  }
                />

                {publishLabelPreview.length >
                  0 ? (
                  <div className="border-t border-paper/[0.065] pt-4">
                    <span className="mb-3 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-paper/32">
                      Active taxonomy
                    </span>

                    <div className="flex flex-wrap gap-2">
                      {publishLabelPreview.map(
                        (label, index) => (
                          <span
                            key={`${label}-${index}`}
                            className="stamp !border-paper/15 !bg-paper/[0.035] !text-paper/52"
                          >
                            #{label}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </EditorialCdnPanel>

            {/* Editor */}
            <EditorialCdnPanel
              index="02"
              icon={FileCode2}
              kicker="Editorial canvas"
              title={t(
                'blogger.editor.title',
              )}
              description={t(
                'blogger.editor.description',
              )}
              action={
                <div
                  className="flex flex-wrap gap-1"
                  role="group"
                  aria-label={t(
                    'blogger.editor.title',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={
                      editorView === 'visual'
                    }
                    className={editorViewButton(
                      'visual',
                    )}
                    onClick={() =>
                      handleViewChange(
                        'visual',
                      )
                    }
                  >
                    <NotebookPen size={12} />
                    {t(
                      'blogger.editor.visual',
                    )}
                  </button>

                  <button
                    type="button"
                    aria-pressed={
                      editorView === 'html'
                    }
                    className={editorViewButton(
                      'html',
                    )}
                    onClick={() =>
                      handleViewChange('html')
                    }
                  >
                    <Code2 size={12} />
                    HTML
                  </button>

                  <button
                    type="button"
                    aria-pressed={
                      editorView === 'preview'
                    }
                    className={editorViewButton(
                      'preview',
                    )}
                    onClick={() =>
                      handleViewChange(
                        'preview',
                      )
                    }
                  >
                    <Eye size={12} />
                    {t(
                      'blogger.editor.preview',
                    )}
                  </button>
                </div>
              }
            >
              <AnimatePresence mode="wait">
                {editorView === 'visual' ? (
                  <motion.div
                    key="visual"
                    initial={{
                      opacity: 0,
                    }}
                    animate={{
                      opacity: 1,
                    }}
                    exit={{
                      opacity: 0,
                    }}
                  >
                    <div className="koma-scrollbar flex flex-wrap items-center gap-1.5 border-b border-paper/[0.065] bg-ink/45 p-3">
                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'heading',
                            {
                              level: 1,
                            },
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.h1',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({
                              level: 1,
                            })
                            .run()
                        }
                      >
                        <Heading1 size={14} />
                      </ToolbarButton>

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'heading',
                            {
                              level: 2,
                            },
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.h2',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({
                              level: 2,
                            })
                            .run()
                        }
                      >
                        <Heading2 size={14} />
                      </ToolbarButton>

                      <span
                        className="mx-1 h-6 w-px bg-paper/10"
                        aria-hidden="true"
                      />

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'bold',
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.bold',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleBold()
                            .run()
                        }
                      >
                        <Bold size={14} />
                      </ToolbarButton>

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'italic',
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.italic',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleItalic()
                            .run()
                        }
                      >
                        <Italic size={14} />
                      </ToolbarButton>

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'underline',
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.underline',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleUnderline()
                            .run()
                        }
                      >
                        <UnderlineIcon
                          size={14}
                        />
                      </ToolbarButton>

                      <span
                        className="mx-1 h-6 w-px bg-paper/10"
                        aria-hidden="true"
                      />

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'bulletList',
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.list',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleBulletList()
                            .run()
                        }
                      >
                        <List size={14} />
                      </ToolbarButton>

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'orderedList',
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.numbered',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleOrderedList()
                            .run()
                        }
                      >
                        <ListOrdered size={14} />
                      </ToolbarButton>

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'blockquote',
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.quote',
                        )}
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleBlockquote()
                            .run()
                        }
                      >
                        <Quote size={14} />
                      </ToolbarButton>

                      <ToolbarButton
                        active={
                          editor?.isActive(
                            'link',
                          ) ?? false
                        }
                        disabled={!editor}
                        title={t(
                          'blogger.editor.link',
                        )}
                        onClick={() => {
                          const url =
                            window.prompt(
                              t(
                                'blogger.editor.promptUrl',
                              ),
                            );

                          if (!url) return;

                          editor
                            ?.chain()
                            .focus()
                            .extendMarkRange(
                              'link',
                            )
                            .setLink({
                              href: url,
                            })
                            .run();
                        }}
                      >
                        <Link2 size={14} />
                      </ToolbarButton>

                      <button
                        type="button"
                        className="btn-primary ml-auto !min-h-9 !px-3 !py-2"
                        disabled={
                          !configReady ||
                          insertBusy
                        }
                        onClick={() =>
                          editorImageInputRef.current?.click()
                        }
                      >
                        {insertBusy ? (
                          <Loader2
                            size={13}
                            className="animate-spin"
                          />
                        ) : (
                          <ImagePlus
                            size={13}
                          />
                        )}

                        {t(
                          'blogger.editor.insertImages',
                        )}
                      </button>
                    </div>

                    <div className="koma-editor-shell min-h-[560px] bg-paper">
                      <EditorContent
                        editor={editor}
                      />
                    </div>
                  </motion.div>
                ) : null}

                {editorView === 'html' ? (
                  <motion.div
                    key="html"
                    initial={{
                      opacity: 0,
                      x: 12,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    exit={{
                      opacity: 0,
                      x: -12,
                    }}
                    className="relative"
                  >
                    <span className="pointer-events-none absolute right-4 top-3 z-10 font-mono text-[0.56rem] uppercase tracking-[0.15em] text-azure/55">
                      HTML source / UTF-8
                    </span>

                    <textarea
                      className="koma-source-editor"
                      value={editorHtml}
                      onChange={(event) =>
                        setEditorHtml(
                          event.target.value,
                        )
                      }
                      spellCheck={false}
                      aria-label="HTML"
                    />
                  </motion.div>
                ) : null}

                {editorView === 'preview' ? (
                  <motion.div
                    key="preview"
                    initial={{
                      opacity: 0,
                      scale: 0.985,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                    }}
                    className="halftone bg-ink/55 p-3 sm:p-5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="kicker">
                        // Safe sandbox proof
                      </span>

                      <span className="stamp !border-azure/45 !bg-azure/10 !text-azure">
                        Browser preview
                      </span>
                    </div>

                    <iframe
                      className="koma-preview-frame"
                      sandbox=""
                      srcDoc={previewSrcDoc}
                      referrerPolicy="no-referrer"
                      title={t(
                        'blogger.editor.preview',
                      )}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <input
                ref={editorImageInputRef}
                type="file"
                hidden
                multiple
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(event) => {
                  void handleEditorImageUpload(
                    Array.from(
                      event.target.files ??
                      [],
                    ),
                  );

                  event.currentTarget.value =
                    '';
                }}
              />

              <footer className="flex flex-col gap-3 border-t border-paper/[0.065] bg-ink/55 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-paper/30">
                  {editorHtml.length.toLocaleString()}{' '}
                  chars /{' '}
                  {uploadedItems.length} assets
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={
                      !editorHtml.trim()
                    }
                    onClick={() =>
                      void handleCopyResult(
                        'html',
                        editorHtml,
                      )
                    }
                  >
                    {copiedToken ===
                      'html' ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}

                    {copiedToken ===
                      'html'
                      ? t(
                        'blogger.copied',
                      )
                      : 'HTML'}
                  </button>

                  <button
                    type="button"
                    className="btn-primary min-w-40"
                    disabled={
                      !configReady ||
                      publishBusy
                    }
                    onClick={() =>
                      void handlePublishPost()
                    }
                  >
                    {publishBusy ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : publishLive ? (
                      <Send size={14} />
                    ) : (
                      <Save size={14} />
                    )}

                    {publishBusy
                      ? t('common.sending')
                      : publishLive
                        ? t(
                          'blogger.post.publish',
                        )
                        : t(
                          'blogger.post.draft',
                        )}
                  </button>
                </div>
              </footer>
            </EditorialCdnPanel>
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            id="blogger-panel-upload"
            role="tabpanel"
            aria-labelledby="blogger-tab-upload"
            initial={
              reduceMotion
                ? false
                : {
                  opacity: 0,
                  x: 18,
                }
            }
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={{
              opacity: 0,
              x: -18,
            }}
            transition={{
              duration:
                reduceMotion ? 0 : 0.42,
              ease: KOMA_EASE,
            }}
            className="grid items-start gap-5 xl:grid-cols-2"
          >
            {/* Upload controller */}
            <EditorialCdnPanel
              index="01"
              icon={UploadCloud}
              kicker="CDN intake"
              title={t(
                'blogger.uploadSection.title',
              )}
              description={t(
                'blogger.uploadSection.description',
              )}
            >
              <div className="space-y-4 p-4 sm:p-5">
                <div
                  {...uploadDropzone.getRootProps({
                    className: [
                      'panel-cut-sm halftone-red relative flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-all',
                      'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson',
                      uploadDropzone.isDragActive
                        ? 'border-crimson bg-crimson/10 -translate-y-1 shadow-[4px_4px_0_var(--color-crimson)]'
                        : 'border-paper/15 hover:-translate-y-0.5 hover:border-crimson/60',
                      uploadDropzone.isDragReject
                        ? '!border-crimson !bg-crimson/10'
                        : '',
                    ].join(' '),
                    'aria-label': t(
                      'blogger.uploadSection.dropTitle',
                    ),
                  })}
                >
                  <input
                    {...uploadDropzone.getInputProps()}
                  />

                  <span className="stamp panel-cut-sm flex size-12 items-center justify-center text-crimson">
                    <UploadCloud
                      size={22}
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <strong className="block font-display text-sm font-black uppercase tracking-tight text-paper">
                      {t(
                        'blogger.uploadSection.dropTitle',
                      )}
                    </strong>

                    <p className="mt-1 font-mono text-[10px] text-paper/50">
                      {t(
                        'blogger.uploadSection.dropDescription',
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <KomaSwitchCard
                    checked={
                      batchOptimizerEnabled
                    }
                    onChange={
                      setBatchOptimizerEnabled
                    }
                    title={t(
                      'blogger.uploadSection.optimizedUrl',
                    )}
                    description={t(
                      'blogger.uploadSection.optimizedUrlDesc',
                    )}
                    icon={ExternalLink}
                    tone="azure"
                  />

                  <KomaSwitchCard
                    checked={
                      bulkPreferOptimizedUrl
                    }
                    onChange={
                      setBulkPreferOptimizedUrl
                    }
                    title={t(
                      'blogger.uploadSection.exportOptimized',
                    )}
                    description={t(
                      'blogger.uploadSection.exportOptimizedDesc',
                    )}
                    icon={Copy}
                    tone="gold"
                  />

                  <KomaSwitchCard
                    checked={bulkAsImageTag}
                    onChange={
                      setBulkAsImageTag
                    }
                    title={t(
                      'blogger.uploadSection.outputImg',
                    )}
                    description={t(
                      'blogger.uploadSection.outputImgDesc',
                    )}
                    icon={Code2}
                  />
                </div>

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
                      'blogger.uploadSection.select',
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      !configReady ||
                      queuedDrafts.length ===
                      0 ||
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
                      <UploadCloud
                        size={14}
                      />
                    )}

                    {uploadBusy
                      ? t('common.sending')
                      : t(
                        'blogger.uploadSection.send',
                      )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-paper/[0.065] pt-4">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={
                      completedDrafts.length ===
                      0
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

                    {copiedToken ===
                      'copy-all'
                      ? t(
                        'blogger.copied',
                      )
                      : t(
                        'dashboard.translator.copy',
                      )}
                  </button>

                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={
                      completedDrafts.length ===
                      0
                    }
                    onClick={handleExportAll}
                  >
                    {copiedToken ===
                      'export-all' ? (
                      <Check size={14} />
                    ) : (
                      <FileCode2
                        size={14}
                      />
                    )}

                    {copiedToken ===
                      'export-all'
                      ? t(
                        'blogger.uploadSection.exported',
                      )
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
                        event.target.files ??
                        [],
                      ),
                    );

                    event.currentTarget.value =
                      '';
                  }}
                />
              </div>
            </EditorialCdnPanel>

            {/* Queue */}
            <EditorialCdnPanel
              index="02"
              icon={FileImage}
              kicker="Asset manifest"
              title={t(
                'blogger.queue.title',
              )}
              description={t(
                'blogger.queue.items',
                {
                  count:
                    uploadDrafts.length,
                },
              )}
              action={
                uploadDrafts.length > 0 ? (
                  <div className="flex gap-2">
                    <span className="stamp !border-gold/45 !bg-gold/10 !text-gold">
                      {queuedDrafts.length}{' '}
                      pending
                    </span>

                    <span className="stamp !border-mint/45 !bg-mint/10 !text-mint">
                      {
                        completedDrafts.length
                      }{' '}
                      ready
                    </span>
                  </div>
                ) : null
              }
            >
              {uploadDrafts.length === 0 ? (
                <EmptyQueue
                  message={t(
                    'blogger.queue.empty',
                  )}
                />
              ) : (
                <motion.div
                  layout
                  className="grid gap-3 p-4"
                >
                  <AnimatePresence initial={false}>
                    {uploadDrafts.map(
                      (item, index) => (
                        <motion.article
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
                          className="offset-card panel-cut-sm relative overflow-hidden border border-paper/10 bg-ink/48"
                        >
                          <span
                            className="text-outline pointer-events-none absolute right-4 top-0 font-display text-6xl font-black leading-none"
                            aria-hidden="true"
                          >
                            {String(
                              index + 1,
                            ).padStart(2, '0')}
                          </span>

                          <div className="grid md:grid-cols-[112px_minmax(0,1fr)_auto]">
                            <div className="relative min-h-32 overflow-hidden bg-ink">
                              <img
                                src={
                                  item.previewUrl
                                }
                                alt={item.altText}
                                className="absolute inset-0 size-full object-cover"
                              />

                              <div
                                className="absolute inset-0 bg-gradient-to-t from-ink/75 to-transparent"
                                aria-hidden="true"
                              />

                              <span className="absolute bottom-2 left-2 font-mono text-[0.56rem] text-paper/65">
                                {formatFileSize(
                                  item.file
                                    .size,
                                )}
                              </span>
                            </div>

                            <div className="relative z-10 min-w-0 space-y-3 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3 pr-12">
                                <div className="min-w-0">
                                  <span className="kicker block text-[0.55rem]">
                                    CDN asset
                                  </span>

                                  <strong className="mt-1 block truncate font-mono text-xs text-paper">
                                    {item.file.name}
                                  </strong>
                                </div>

                                <QueueStatusBadge
                                  status={
                                    item.status
                                  }
                                />
                              </div>

                              <label className="block">
                                <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-paper/32">
                                  {t(
                                    'blogger.queue.altText',
                                  )}
                                </span>

                                <input
                                  className="koma-control"
                                  value={
                                    item.altText
                                  }
                                  disabled={
                                    item.status ===
                                    'processing'
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    handleDraftAltChange(
                                      item.id,
                                      event.target
                                        .value,
                                    )
                                  }
                                  placeholder={t(
                                    'blogger.queue.altText',
                                  )}
                                />
                              </label>

                              {item.result ? (
                                <div className="grid gap-2 xl:grid-cols-2">
                                  <label className="block">
                                    <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-[0.1em] text-paper/30">
                                      {t(
                                        'blogger.queue.canonical',
                                      )}
                                    </span>

                                    <input
                                      readOnly
                                      value={
                                        item.result
                                          .canonicalUrl
                                      }
                                      className="koma-control !font-mono !text-[0.62rem]"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-[0.1em] text-paper/30">
                                      {t(
                                        'blogger.queue.optimized',
                                      )}
                                    </span>

                                    <input
                                      readOnly
                                      value={
                                        item.result
                                          .optimizedUrl ??
                                        ''
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
                            </div>

                            <div className="relative z-10 flex flex-row gap-1 border-t border-paper/[0.065] p-3 md:flex-col md:border-l md:border-t-0">
                              {item.result ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn-ghost !min-h-9 !px-3 !py-2"
                                    onClick={() =>
                                      void handleCopyResult(
                                        `${item.id}:canonical`,
                                        item
                                          .result
                                          ?.canonicalUrl ??
                                        '',
                                      )
                                    }
                                  >
                                    {copiedToken ===
                                      `${item.id}:canonical` ? (
                                      <Check
                                        size={
                                          13
                                        }
                                      />
                                    ) : (
                                      <Copy
                                        size={
                                          13
                                        }
                                      />
                                    )}

                                    {t(
                                      'blogger.queue.url',
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn-ghost !min-h-9 !px-3 !py-2"
                                    disabled={
                                      !item.result
                                        .optimizedUrl
                                    }
                                    onClick={() =>
                                      void handleCopyResult(
                                        `${item.id}:optimized`,
                                        item
                                          .result
                                          ?.optimizedUrl ??
                                        '',
                                      )
                                    }
                                  >
                                    {copiedToken ===
                                      `${item.id}:optimized` ? (
                                      <Check
                                        size={
                                          13
                                        }
                                      />
                                    ) : (
                                      <ExternalLink
                                        size={
                                          13
                                        }
                                      />
                                    )}

                                    {t(
                                      'blogger.queue.opt',
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn-ghost !min-h-9 !px-3 !py-2"
                                    onClick={() =>
                                      void handleCopyResult(
                                        `${item.id}:tag`,
                                        item
                                          .result
                                          ?.imageTag ??
                                        '',
                                      )
                                    }
                                  >
                                    {copiedToken ===
                                      `${item.id}:tag` ? (
                                      <Check
                                        size={
                                          13
                                        }
                                      />
                                    ) : (
                                      <Link2
                                        size={
                                          13
                                        }
                                      />
                                    )}

                                    {t(
                                      'blogger.queue.img',
                                    )}
                                  </button>
                                </>
                              ) : null}

                              <button
                                type="button"
                                className="panel-cut-sm mt-auto inline-flex min-h-9 items-center justify-center gap-2 border border-crimson/25 bg-crimson/[0.045] px-3 font-mono text-[0.6rem] font-bold uppercase text-crimson transition hover:border-crimson hover:bg-crimson hover:text-ink"
                                onClick={() =>
                                  handleRemoveDraft(
                                    item.id,
                                  )
                                }
                              >
                                <X size={13} />
                                {t(
                                  'common.remove',
                                )}
                              </button>
                            </div>
                          </div>
                        </motion.article>
                      ),
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </EditorialCdnPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BloggerWorkspaceV2;

