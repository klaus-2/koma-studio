'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Bold,
  Check,
  Code2,
  Copy,
  Eye,
  ExternalLink,
  FileText,
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
} from 'lucide-react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';

import { DEFAULT_BLOGGER_CONFIG, type BloggerUploadResult } from '../../../types';
import {
  buildBloggerBulkOutput,
  deserializeBloggerLabels,
  loadBloggerConfig,
  preprocessBloggerImageFile,
  previewOptimizerUrl,
  publishBloggerPost,
  serializeBloggerLabels,
  uploadBloggerImages,
} from '../../../services/blogger';
import { useI18n } from '../../../i18n';
import { NoirField, NoirInput, NoirToggle, Stamp, useNoirMotion } from '../../noir-panels/NoirPrimitives';
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

type BloggerWorkspaceTab = 'publish' | 'upload';
type BloggerEditorView = 'visual' | 'html' | 'preview';
type UploadItemStatus = QueueStatus;

interface BloggerWorkspaceProps {
  onOpenSettings?: () => void;
}

interface UploadDraftItem {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
  status: UploadItemStatus;
  result: BloggerUploadResult | null;
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

const mergeUploadedItems = (
  current: BloggerUploadResult[],
  incoming: BloggerUploadResult[],
): BloggerUploadResult[] => {
  const next = new Map<string, BloggerUploadResult>();
  current.forEach((item) => next.set(item.canonicalUrl, item));
  incoming.forEach((item) => next.set(item.canonicalUrl, item));
  return Array.from(next.values());
};

const syncEditorFromHtml = (editor: Editor | null, html: string): void => {
  if (!editor) return;
  if (editor.getHTML().trim() === html.trim()) return;
  editor.commands.setContent(html, { emitUpdate: false });
};

const buildSafePreviewDocument = (html: string, localeTag: string): string => {
  const baseHref = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
  const sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '');

  const trimmed = sanitized.trim();
  if (/<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }

  return `<!doctype html>
<html lang="${localeTag}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="${baseHref}" />
    <style>
      :root { color-scheme: light; }
      body {
        margin:0; padding: 24px;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #ffffff; color: #111827;
      }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    ${trimmed}
  </body>
</html>`;
};

/* ── TipTap toolbar button (noir) ── */
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
    disabled={disabled}
    title={title}
    aria-pressed={active}
    onClick={onClick}
    className={`grid h-7 w-7 place-items-center transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-30 ${active
      ? 'bg-crimson text-ink drop-shadow-[2px_2px_0_#ffc857]'
      : 'text-paper/55 hover:bg-paper/8 hover:text-paper'
      }`}
    style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
  >
    {children}
  </button>
);

/* ════════════════ Component ════════════════ */

export const BloggerWorkspaceNoir = ({ onOpenSettings }: BloggerWorkspaceProps) => {
  const { localeTag, t } = useI18n();
  const m = useNoirMotion();

  const defaultEditorTemplate = useMemo(
    () =>
      `
<h2>${t('blogger.template.title')}</h2>
<p>${t('blogger.template.description')}</p>
<p>${t('blogger.template.insertPrefix')} <strong>${t('blogger.editor.insertImages')}</strong> ${t('blogger.template.insertSuffix')}</p>
`.trim(),
    [t],
  );

  const [workspaceTab, setWorkspaceTab] = useState<BloggerWorkspaceTab>('publish');
  const [editorView, setEditorView] = useState<BloggerEditorView>('visual');
  const [editorHtml, setEditorHtml] = useState(defaultEditorTemplate);
  const [postTitle, setPostTitle] = useState('');
  const [postLabelsInput, setPostLabelsInput] = useState('');
  const [publishLive, setPublishLive] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [insertBusy, setInsertBusy] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [defaultLabels, setDefaultLabels] = useState('');
  const [uploadDrafts, setUploadDrafts] = useState<UploadDraftItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  // Upload results are consumed only by publish — never rendered — so a ref
  // keeps batch completions from re-rendering the whole workspace
  // (react.dev "Referencing Values with Refs").
  const uploadedItemsRef = useRef<BloggerUploadResult[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [batchOptimizerEnabled, setBatchOptimizerEnabled] = useState(true);
  const [bulkPreferOptimizedUrl, setBulkPreferOptimizedUrl] = useState(true);
  const [bulkAsImageTag, setBulkAsImageTag] = useState(false);
  const editorImageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDraftsRef = useRef<UploadDraftItem[]>([]);
  const editorUploadHandlerRef = useRef<(files: File[], position?: number) => Promise<void>>(
    async () => undefined,
  );

  const previewSrcDoc = useMemo(
    () => buildSafePreviewDocument(editorHtml, localeTag),
    [editorHtml, localeTag],
  );

  useEffect(() => {
    let cancelled = false;
    void loadBloggerConfig()
      .then(({ config }) => {
        if (cancelled) return;
        setConfigReady(
          Boolean(config.clientId && config.clientSecret && config.refreshToken && config.blogId),
        );
        setDefaultLabels(serializeBloggerLabels(config.defaultLabels));
        setBatchOptimizerEnabled(config.optimizer.enabled);
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspaceError(
          error instanceof Error ? error.message : t('blogger.loadConfigFailed'),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/resources/utilitys/blogger/default-post-template.html')
      .then(async (response) => {
        if (!response.ok) throw new Error('template-unavailable');
        return response.text();
      })
      .then((template) => {
        if (cancelled) return;
        const normalized = template.trim() || defaultEditorTemplate;
        setEditorHtml((current) => (current === defaultEditorTemplate ? normalized : current));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [defaultEditorTemplate]);

  useEffect(() => {
    if (!copiedToken) return;
    const timeoutId = window.setTimeout(() => setCopiedToken(null), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copiedToken]);

  useEffect(() => {
    uploadDraftsRef.current = uploadDrafts;
  }, [uploadDrafts]);

  useEffect(
    () => () => {
      uploadDraftsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Underline,
      Image.configure({ inline: false }),
    ],
    content: editorHtml,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      setEditorHtml(nextEditor.getHTML());
    },
    editorProps: {
      attributes: { class: 'noir-prose' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith('image/'),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        void editorUploadHandlerRef.current(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith('image/'),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void editorUploadHandlerRef.current(files, position);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.isEmpty && editorHtml.trim()) {
      editor.commands.setContent(editorHtml, { emitUpdate: false });
    }
  }, [editor, editorHtml]);

  const handleViewChange = useCallback(
    (nextView: BloggerEditorView) => {
      if (editorView === 'html') syncEditorFromHtml(editor, editorHtml);
      setEditorView(nextView);
    },
    [editor, editorHtml, editorView],
  );

  const insertUploadedImagesIntoEditor = useCallback(
    (results: BloggerUploadResult[], position?: number) => {
      if (!editor || results.length === 0) return;

      const content = results.flatMap((item, index) => {
        const blocks: Array<Record<string, unknown>> = [
          { type: 'image', attrs: { src: item.canonicalUrl, alt: item.altText } },
        ];
        if (index !== results.length - 1) blocks.push({ type: 'paragraph' });
        return blocks;
      });

      if (typeof position === 'number') {
        editor.chain().focus().insertContentAt(position, content).run();
        return;
      }
      editor.chain().focus().insertContent(content).run();
    },
    [editor],
  );

  const handleEditorImageUpload = useCallback(
    async (files: File[], position?: number) => {
      if (files.length === 0) return;

      setInsertBusy(true);
      setWorkspaceError(null);
      setWorkspaceFeedback(null);

      try {
        const configPayload = await loadBloggerConfig();
        const config = configPayload.config ?? DEFAULT_BLOGGER_CONFIG;
        const preparedItems = await Promise.all(
          files.map(async (file) => {
            const prepared = await preprocessBloggerImageFile(file, config.preprocess);
            return { ...prepared, altText: file.name.replace(/\.[^.]+$/u, '') };
          }),
        );

        const result = await uploadBloggerImages({ items: preparedItems });

        uploadedItemsRef.current = mergeUploadedItems(uploadedItemsRef.current, result.items);
        insertUploadedImagesIntoEditor(result.items, position);
        setWorkspaceFeedback(
          result.items.length === 1
            ? t('blogger.imageInsertedSingle')
            : t('blogger.imageInsertedMany', { count: result.items.length }),
        );
      } catch (error) {
        setWorkspaceError(error instanceof Error ? error.message : t('blogger.uploadFailed'));
      } finally {
        setInsertBusy(false);
      }
    },
    [insertUploadedImagesIntoEditor, t],
  );

  editorUploadHandlerRef.current = handleEditorImageUpload;

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

  const onUploadDrop = useCallback(
    (acceptedFiles: File[]) => appendUploadDrafts(acceptedFiles),
    [appendUploadDrafts],
  );

  const uploadDropzone = useDropzone({
    accept: ACCEPTED_IMAGE_TYPES,
    multiple: true,
    onDrop: onUploadDrop,
  });

  const handleRemoveDraft = useCallback((draftId: string) => {
    setUploadDrafts((current) => {
      const target = current.find((item) => item.id === draftId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== draftId);
    });
  }, []);

  const handleDraftAltChange = useCallback((draftId: string, value: string) => {
    setUploadDrafts((current) =>
      current.map((item) => (item.id === draftId ? { ...item, altText: value } : item)),
    );
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
      const configPayload = await loadBloggerConfig();
      const config = configPayload.config ?? DEFAULT_BLOGGER_CONFIG;
      setUploadDrafts((current) =>
        current.map((item) =>
          queuedDrafts.some((draft) => draft.id === item.id)
            ? { ...item, status: 'processing', error: null }
            : item,
        ),
      );

      const preparedItems = await Promise.all(
        queuedDrafts.map(async (draft) => {
          const prepared = await preprocessBloggerImageFile(draft.file, config.preprocess);
          return { ...prepared, id: draft.id, altText: draft.altText };
        }),
      );

      const response = await uploadBloggerImages({ items: preparedItems });

      const effectiveItems = response.items.map((item) => ({
        ...item,
        optimizedUrl: batchOptimizerEnabled
          ? (item.optimizedUrl ?? previewOptimizerUrl(config, item.canonicalUrl))
          : null,
      }));
      const resultById = new Map(effectiveItems.map((item) => [item.id, item]));
      setUploadDrafts((current) =>
        current.map((item) => {
          const result = resultById.get(item.id);
          if (!result) return item;
          return { ...item, status: 'uploaded', result, error: null };
        }),
      );
      uploadedItemsRef.current = mergeUploadedItems(uploadedItemsRef.current, effectiveItems);
      setWorkspaceFeedback(
        effectiveItems.length === 1
          ? t('blogger.batchUploadSuccessSingle')
          : t('blogger.batchUploadSuccessMany', { count: effectiveItems.length }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t('blogger.uploadFailedShort');
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
  }, [batchOptimizerEnabled, queuedDrafts, t]);

  const handleCopyResult = useCallback(async (token: string, value: string) => {
    await copyText(value);
    setCopiedToken(token);
  }, []);

  const handleCopyAll = useCallback(async () => {
    const results = uploadDrafts
      .map((item) => item.result)
      .filter((item): item is BloggerUploadResult => Boolean(item));
    if (results.length === 0) return;
    await copyText(
      buildBloggerBulkOutput(results, {
        preferOptimizedUrl: bulkPreferOptimizedUrl,
        asImageTag: bulkAsImageTag,
      }),
    );
    setCopiedToken('copy-all');
  }, [bulkAsImageTag, bulkPreferOptimizedUrl, uploadDrafts]);

  const handleExportAll = useCallback(() => {
    const results = uploadDrafts
      .map((item) => item.result)
      .filter((item): item is BloggerUploadResult => Boolean(item));
    if (results.length === 0) return;
    const content = buildBloggerBulkOutput(results, {
      preferOptimizedUrl: bulkPreferOptimizedUrl,
      asImageTag: bulkAsImageTag,
    });
    downloadTextFile('blogger-cdn-urls.txt', content);
    setCopiedToken('export-all');
  }, [bulkAsImageTag, bulkPreferOptimizedUrl, uploadDrafts]);

  const handlePublishPost = useCallback(async () => {
    setPublishBusy(true);
    setWorkspaceError(null);
    setWorkspaceFeedback(null);

    try {
      if (editorView === 'html') syncEditorFromHtml(editor, editorHtml);

      const labels = [
        ...deserializeBloggerLabels(defaultLabels),
        ...deserializeBloggerLabels(postLabelsInput),
      ];

      const result = await publishBloggerPost({
        title: postTitle,
        html: editorView === 'html' ? editorHtml : (editor?.getHTML() ?? editorHtml),
        labels,
        publish: publishLive,
        uploadedImages: uploadedItemsRef.current,
      });

      const verb = result.isDraft
        ? t('blogger.post.status.draft')
        : t('blogger.post.status.published');
      setWorkspaceFeedback(
        result.postUrl
          ? t('blogger.publishSuccessWithUrl', { verb, url: result.postUrl })
          : t('blogger.publishSuccessWithId', { verb, id: result.postId }),
      );
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : t('blogger.publishFailed'));
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
  ]);

  const publishLabelPreview = useMemo(
    () => [
      ...deserializeBloggerLabels(defaultLabels),
      ...deserializeBloggerLabels(postLabelsInput),
    ],
    [defaultLabels, postLabelsInput],
  );

  /* ════════════════ Render — Manga Noir ════════════════ */

  const editorViewOptions: Array<{ value: BloggerEditorView; icon: typeof Eye; label: ReactNode }> = [
    { value: 'visual', icon: NotebookPen, label: t('blogger.editor.visual') },
    { value: 'html', icon: Code2, label: 'HTML' },
    { value: 'preview', icon: Eye, label: t('blogger.editor.preview') },
  ];

  return (
    <motion.div
      variants={m.container}
      initial={m.initial}
      animate={m.animate}
      className="flex flex-col gap-4"
    >
      {/* ── Hero ── */}
      <motion.header variants={m.item} className="glass panel-cut relative overflow-hidden p-5">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-7 right-4 select-none font-display text-[100px] font-black leading-none"
        >
          配信
        </span>
        <div className="halftone-red pointer-events-none absolute inset-y-0 right-0 w-44 opacity-40" aria-hidden />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-lg">
            <p className="kicker mb-2 flex items-center gap-2">
              <UploadCloud size={11} aria-hidden />
              {'// '}
              {t('blogger.title')}
            </p>
            <h2 className="font-display text-2xl font-black uppercase leading-none tracking-tight text-paper">
              Blogger{' '}
              <em className="font-accent font-normal normal-case italic text-crimson">CDN</em>
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-paper/50">
              {t('blogger.heroDescription')}
            </p>
          </div>

          <Stamp tone={configReady ? 'mint' : 'crimson'} blink={!configReady}>
            {configReady ? t('blogger.ready') : t('blogger.configureInSettings')}
          </Stamp>
        </div>
      </motion.header>

      {/* ── Tabs (hanko stamps) ── */}
      <motion.div
        variants={m.item}
        role="tablist"
        aria-label={t('blogger.title')}
        className="flex flex-wrap items-center gap-2"
      >
        {(
          [
            { key: 'publish' as const, icon: NotebookPen, label: t('blogger.publishTab') },
            { key: 'upload' as const, icon: UploadCloud, label: t('blogger.uploadTab') },
          ] as const
        ).map(({ key, icon: Icon, label }) => {
          const active = workspaceTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setWorkspaceTab(key)}
              className={`panel-cut-sm flex items-center gap-2 px-4 py-2 font-display text-[11px] font-extrabold uppercase tracking-wider transition-all duration-150 ${active
                ? 'bg-crimson text-ink -translate-x-0.5 -translate-y-0.5 drop-shadow-[4px_4px_0_#ffc857]'
                : 'border border-paper/15 text-paper/55 hover:border-paper/40 hover:text-paper'
                }`}
            >
              <Icon size={13} strokeWidth={2.5} /> {label}
            </button>
          );
        })}
        <button type="button" className="btn-ghost ml-auto" onClick={() => onOpenSettings?.()}>
          <Settings2 size={11} /> {t('blogger.settings')}
        </button>
      </motion.div>

      {/* ── Alerts ── */}
      <NoirAlertStack>
        {!configReady && (
          <NoirAlert key="cfg" tone="warn" title={t('blogger.missingConfigTitle')}>
            {t('blogger.missingConfigBody')}
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

      {workspaceTab === 'publish' ? (
        <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* ═══ Post config ═══ */}
          <motion.section variants={m.item} className="glass panel-cut relative p-4">
            <span
              aria-hidden
              className="text-outline pointer-events-none absolute right-3 top-2 select-none font-display text-3xl font-black"
            >
              01
            </span>
            <SurfaceHead
              icon={FileText}
              title={t('blogger.post.title')}
              desc={t('blogger.post.description')}
            />

            <div className="flex flex-col gap-3.5">
              <NoirField label={t('blogger.post.postTitle')}>
                <NoirInput
                  id="bl-title"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder={t('blogger.post.postTitlePlaceholder')}
                />
              </NoirField>

              <NoirField label={t('blogger.post.defaultLabels')}>
                <NoirInput
                  value={defaultLabels}
                  onChange={(e) => setDefaultLabels(e.target.value)}
                  placeholder={t('blogger.post.defaultLabelsPlaceholder')}
                />
              </NoirField>

              <NoirField label={t('blogger.post.postLabels')}>
                <NoirInput
                  value={postLabelsInput}
                  onChange={(e) => setPostLabelsInput(e.target.value)}
                  placeholder={t('blogger.post.postLabelsPlaceholder')}
                />
              </NoirField>

              <div className="panel-cut-sm border border-paper/10 bg-ink/50 p-3">
                <NoirToggle checked={publishLive} onChange={setPublishLive} icon={publishLive ? Send : Save}>
                  {publishLive ? t('blogger.post.publishNow') : t('blogger.post.draft')}
                </NoirToggle>
              </div>

              {publishLabelPreview.length > 0 && (
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-paper/40">
                    <Tags size={10} aria-hidden /> Labels
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {publishLabelPreview.map((label) => (
                      <span
                        key={label}
                        className="panel-cut-sm border border-azure/35 bg-azure/8 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-azure"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.section>

          {/* ═══ Editor ═══ */}
          <motion.section variants={m.item} className="glass panel-cut relative min-w-0 p-4">
            <span
              aria-hidden
              className="text-outline pointer-events-none absolute right-3 top-2 select-none font-display text-3xl font-black"
            >
              02
            </span>
            <SurfaceHead
              icon={NotebookPen}
              title={t('blogger.editor.title')}
              desc={t('blogger.editor.description')}
              right={
                <div className="flex gap-1.5" role="tablist">
                  {editorViewOptions.map(({ value, icon: Icon, label }) => {
                    const active = editorView === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => handleViewChange(value)}
                        className={`panel-cut-sm flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-all duration-150 ${active
                          ? 'bg-crimson font-bold text-ink drop-shadow-[2px_2px_0_#ffc857]'
                          : 'border border-paper/15 text-paper/50 hover:border-paper/40 hover:text-paper'
                          }`}
                      >
                        <Icon size={11} /> {label}
                      </button>
                    );
                  })}
                </div>
              }
            />

            {editorView === 'visual' && (
              <>
                {/* Toolbar */}
                <div className="mb-0 flex flex-wrap items-center gap-1 border border-b-0 border-paper/12 bg-ink/70 px-2 py-1.5">
                  <ToolbarButton
                    active={editor?.isActive('heading', { level: 1 }) ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.h1')}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  >
                    <Heading1 size={14} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor?.isActive('heading', { level: 2 }) ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.h2')}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  >
                    <Heading2 size={14} />
                  </ToolbarButton>

                  <span aria-hidden className="mx-1 h-4 w-px bg-paper/12" />

                  <ToolbarButton
                    active={editor?.isActive('bold') ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.bold')}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                  >
                    <Bold size={14} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor?.isActive('italic') ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.italic')}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                  >
                    <Italic size={14} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor?.isActive('underline') ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.underline')}
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  >
                    <UnderlineIcon size={14} />
                  </ToolbarButton>

                  <span aria-hidden className="mx-1 h-4 w-px bg-paper/12" />

                  <ToolbarButton
                    active={editor?.isActive('bulletList') ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.list')}
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  >
                    <List size={14} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor?.isActive('orderedList') ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.numbered')}
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  >
                    <ListOrdered size={14} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor?.isActive('blockquote') ?? false}
                    disabled={!editor}
                    title={t('blogger.editor.quote')}
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  >
                    <Quote size={14} />
                  </ToolbarButton>
                  <ToolbarButton
                    disabled={!editor}
                    title={t('blogger.editor.link')}
                    onClick={() => {
                      const u = window.prompt(t('blogger.editor.promptUrl'));
                      if (u)
                        editor?.chain().focus().extendMarkRange('link').setLink({ href: u }).run();
                    }}
                  >
                    <Link2 size={14} />
                  </ToolbarButton>

                  <button
                    type="button"
                    disabled={!configReady || insertBusy}
                    onClick={() => editorImageInputRef.current?.click()}
                    className="panel-cut-sm ml-auto flex items-center gap-1.5 bg-crimson px-2.5 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:drop-shadow-[3px_3px_0_#ffc857] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {insertBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ImagePlus size={12} />
                    )}
                    {t('blogger.editor.insertImages')}
                  </button>
                </div>

                {/* Editor surface */}
                <div className="halftone border border-paper/12 bg-ink/60">
                  <EditorContent editor={editor} />
                </div>
              </>
            )}

            {editorView === 'html' && (
              <textarea
                className="noir-code-area"
                value={editorHtml}
                onChange={(e) => setEditorHtml(e.target.value)}
                spellCheck={false}
                aria-label="HTML"
              />
            )}

            {editorView === 'preview' && (
              <iframe
                className="panel-cut-sm h-[420px] w-full border border-paper/12 bg-white"
                sandbox=""
                srcDoc={previewSrcDoc}
                title={t('blogger.editor.preview')}
              />
            )}

            <input
              ref={editorImageInputRef}
              type="file"
              hidden
              multiple
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                void handleEditorImageUpload(Array.from(e.target.files ?? []));
                e.currentTarget.value = '';
              }}
            />

            {/* Actions */}
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-paper/10 pt-4">
              <button
                type="button"
                className="btn-ghost"
                disabled={!editorHtml.trim()}
                onClick={() => void handleCopyResult('html', editorHtml)}
              >
                {copiedToken === 'html' ? <Check size={11} /> : <Copy size={11} />}
                {copiedToken === 'html' ? t('blogger.copied') : 'HTML'}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!configReady || publishBusy}
                onClick={() => void handlePublishPost()}
              >
                {publishBusy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : publishLive ? (
                  <Send size={13} />
                ) : (
                  <Save size={13} />
                )}
                {publishBusy
                  ? t('common.sending')
                  : publishLive
                    ? t('blogger.post.publish')
                    : t('blogger.post.draft')}
                <span
                  aria-hidden
                  className="font-accent text-[14px] normal-case italic tracking-normal opacity-70"
                >
                  {publishLive ? '公開' : '下書き'}
                </span>
              </button>
            </div>
          </motion.section>
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          {/* ═══ Upload config ═══ */}
          <motion.section variants={m.item} className="glass panel-cut relative p-4">
            <span
              aria-hidden
              className="text-outline pointer-events-none absolute right-3 top-2 select-none font-display text-3xl font-black"
            >
              01
            </span>
            <SurfaceHead
              icon={UploadCloud}
              title={t('blogger.uploadSection.title')}
              desc={t('blogger.uploadSection.description')}
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
                  {t('blogger.uploadSection.dropTitle')}
                </strong>
                <p className="mt-0.5 text-[10.5px] text-paper/45">
                  {t('blogger.uploadSection.dropDescription')}
                </p>
              </div>
              <span
                aria-hidden
                className="v-text ml-auto hidden select-none font-mono text-[9px] tracking-[0.3em] text-paper/20 sm:block"
              >
                ドロップ
              </span>
            </div>

            {/* Options */}
            <div className="mt-4 flex flex-col gap-2">
              <ToggleCard
                checked={batchOptimizerEnabled}
                onChange={setBatchOptimizerEnabled}
                title={t('blogger.uploadSection.optimizedUrl')}
                desc={t('blogger.uploadSection.optimizedUrlDesc')}
              />
              <ToggleCard
                checked={bulkPreferOptimizedUrl}
                onChange={setBulkPreferOptimizedUrl}
                title={t('blogger.uploadSection.exportOptimized')}
                desc={t('blogger.uploadSection.exportOptimizedDesc')}
              />
              <ToggleCard
                checked={bulkAsImageTag}
                onChange={setBulkAsImageTag}
                title={t('blogger.uploadSection.outputImg')}
                desc={t('blogger.uploadSection.outputImgDesc')}
              />
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-paper/10 pt-4">
              <button type="button" className="btn-ghost" onClick={() => uploadInputRef.current?.click()}>
                <ImagePlus size={11} /> {t('blogger.uploadSection.select')}
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !text-[11px]"
                disabled={!configReady || !queuedDrafts.length || uploadBusy}
                onClick={() => void handleBatchUpload()}
              >
                {uploadBusy ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                {uploadBusy ? t('common.sending') : t('blogger.uploadSection.send')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={uploadDrafts.every((i) => !i.result)}
                onClick={() => void handleCopyAll()}
              >
                {copiedToken === 'copy-all' ? <Check size={11} /> : <Copy size={11} />}
                {copiedToken === 'copy-all' ? t('blogger.copied') : t('dashboard.translator.copy')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={uploadDrafts.every((i) => !i.result)}
                onClick={handleExportAll}
              >
                {copiedToken === 'export-all' ? <Check size={11} /> : <Copy size={11} />}
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
          </motion.section>

          {/* ═══ Queue ═══ */}
          <motion.section variants={m.item} className="glass panel-cut relative min-w-0 p-4">
            <span
              aria-hidden
              className="text-outline pointer-events-none absolute right-3 top-2 select-none font-display text-3xl font-black"
            >
              02
            </span>
            <SurfaceHead
              icon={ImagePlus}
              title={t('blogger.queue.title')}
              desc={t('blogger.queue.items', { count: uploadDrafts.length })}
            />

            <div className="flex flex-col gap-3">
              {!uploadDrafts.length ? (
                <div className="flex flex-col items-center gap-2 border border-dashed border-paper/15 py-12 text-paper/35">
                  <ImagePlus size={22} strokeWidth={1.2} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
                    {t('blogger.queue.empty')}
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
                        placeholder={t('blogger.queue.altText')}
                      />
                      {item.result && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <ResultField
                            label={t('blogger.queue.canonical')}
                            value={item.result.canonicalUrl}
                          />
                          <ResultField
                            label={t('blogger.queue.optimized')}
                            value={item.result.optimizedUrl ?? ''}
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
                              void handleCopyResult(
                                `${item.id}:canonical`,
                                item.result?.canonicalUrl ?? '',
                              )
                            }
                          >
                            <Copy size={10} />
                            {copiedToken === `${item.id}:canonical` ? '✓' : t('blogger.queue.url')}
                          </MiniBtn>
                          <MiniBtn
                            disabled={!item.result.optimizedUrl}
                            onClick={() =>
                              void handleCopyResult(
                                `${item.id}:optimized`,
                                item.result?.optimizedUrl ?? '',
                              )
                            }
                          >
                            <ExternalLink size={10} />
                            {copiedToken === `${item.id}:optimized` ? '✓' : t('blogger.queue.opt')}
                          </MiniBtn>
                          <MiniBtn
                            onClick={() =>
                              void handleCopyResult(`${item.id}:tag`, item.result?.imageTag ?? '')
                            }
                          >
                            <Link2 size={10} />
                            {copiedToken === `${item.id}:tag` ? '✓' : t('blogger.queue.img')}
                          </MiniBtn>
                        </>
                      )}
                      <MiniBtn danger onClick={() => handleRemoveDraft(item.id)}>
                        {t('common.remove')}
                      </MiniBtn>
                    </div>
                  </article>
                ))
              )}
            </div>
          </motion.section>
        </div>
      )}
    </motion.div>
  );
};

export default BloggerWorkspaceNoir;
