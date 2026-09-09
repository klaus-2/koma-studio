import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useDropzone } from 'react-dropzone';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Eye,
  Loader2,
  NotebookPen,
  Save,
  Send,
  Settings2,
  UploadCloud,
} from 'lucide-react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';

import { DEFAULT_BLOGGER_CONFIG, type BloggerUploadResult } from '../../types';
import {
  buildBloggerBulkOutput,
  deserializeBloggerLabels,
  loadBloggerConfig,
  preprocessBloggerImageFile,
  previewOptimizerUrl,
  publishBloggerPost,
  serializeBloggerLabels,
  uploadBloggerImages,
} from '../../services/blogger';
import { useI18n } from '../../i18n';
import { BloggerEditorToolbar } from './BloggerEditorToolbar';
import { BloggerUploadPanel } from './BloggerUploadPanel';
import './CdnWorkspace.css';

type BloggerWorkspaceTab = 'publish' | 'upload';
type BloggerEditorView = 'visual' | 'html' | 'preview';

interface BloggerWorkspaceProps {
  onOpenSettings?: () => void;
}

export interface UploadDraftItem {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
  status: 'queued' | 'processing' | 'uploaded' | 'error';
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
  current.forEach((item) => {
    next.set(item.canonicalUrl, item);
  });
  incoming.forEach((item) => {
    next.set(item.canonicalUrl, item);
  });
  return Array.from(next.values());
};

const syncEditorFromHtml = (editor: Editor | null, html: string): void => {
  if (!editor) {
    return;
  }

  if (editor.getHTML().trim() === html.trim()) {
    return;
  }

  editor.commands.setContent(html, { emitUpdate: false });
};

const buildSafePreviewDocument = (html: string, localeTag: string): string => {
  const baseHref =
    typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
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
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        padding: 24px;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #ffffff;
        color: #111827;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    ${trimmed}
  </body>
</html>`;
};

export const BloggerWorkspace = ({ onOpenSettings }: BloggerWorkspaceProps) => {
  const { localeTag, t } = useI18n();
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
  const [editorView, setEditorView] = useState<BloggerEditorView>('visual');
  const [editorHtml, setEditorHtml] = useState(defaultEditorTemplate);
  const [postTitle, setPostTitle] = useState('');
  const [postLabelsInput, setPostLabelsInput] = useState('');
  const [publishLive, setPublishLive] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<string | null>(
    null,
  );
  const [publishBusy, setPublishBusy] = useState(false);
  const [insertBusy, setInsertBusy] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [defaultLabels, setDefaultLabels] = useState('');
  const [uploadDrafts, setUploadDrafts] = useState<UploadDraftItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadedItems, setUploadedItems] = useState<BloggerUploadResult[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [batchOptimizerEnabled, setBatchOptimizerEnabled] = useState(true);
  const [bulkPreferOptimizedUrl, setBulkPreferOptimizedUrl] = useState(true);
  const [bulkAsImageTag, setBulkAsImageTag] = useState(false);
  const editorImageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDraftsRef = useRef<UploadDraftItem[]>([]);
  const editorUploadHandlerRef = useRef<
    (files: File[], position?: number) => Promise<void>
  >(async () => undefined);

  const previewSrcDoc = useMemo(
    () => buildSafePreviewDocument(editorHtml, localeTag),
    [editorHtml, localeTag],
  );

  useEffect(() => {
    let cancelled = false;

    void loadBloggerConfig()
      .then(({ config }) => {
        if (cancelled) {
          return;
        }
        setConfigReady(
          Boolean(
            config.clientId &&
            config.clientSecret &&
            config.refreshToken &&
            config.blogId,
          ),
        );
        setDefaultLabels(serializeBloggerLabels(config.defaultLabels));
        setBatchOptimizerEnabled(config.optimizer.enabled);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : t('blogger.loadConfigFailed'),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    void fetch('/resources/utilities/blogger/default-post-template.html')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('template-unavailable');
        }
        return response.text();
      })
      .then((template) => {
        if (cancelled) {
          return;
        }
        const normalized = template.trim() || defaultEditorTemplate;
        setEditorHtml((current) =>
          current === defaultEditorTemplate ? normalized : current,
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [defaultEditorTemplate]);

  useEffect(() => {
    if (!copiedToken) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedToken(null);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedToken]);

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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
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
        class: 'koma-blogger__editor-surface',
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(
          (file) => file.type.startsWith('image/'),
        );
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        void editorUploadHandlerRef.current(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter(
          (file) => file.type.startsWith('image/'),
        );
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        const position = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;
        void editorUploadHandlerRef.current(files, position);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (editor.isEmpty && editorHtml.trim()) {
      editor.commands.setContent(editorHtml, { emitUpdate: false });
    }
  }, [editor, editorHtml]);

  const handleViewChange = useCallback(
    (nextView: BloggerEditorView) => {
      if (editorView === 'html') {
        syncEditorFromHtml(editor, editorHtml);
      }
      setEditorView(nextView);
    },
    [editor, editorHtml, editorView],
  );

  const insertUploadedImagesIntoEditor = useCallback(
    (results: BloggerUploadResult[], position?: number) => {
      if (!editor || results.length === 0) {
        return;
      }

      const content = results.flatMap((item, index) => {
        const blocks: Array<Record<string, unknown>> = [
          {
            type: 'image',
            attrs: {
              src: item.canonicalUrl,
              alt: item.altText,
            },
          },
        ];

        if (index !== results.length - 1) {
          blocks.push({
            type: 'paragraph',
          });
        }

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
      if (files.length === 0) {
        return;
      }

      setInsertBusy(true);
      setWorkspaceError(null);
      setWorkspaceFeedback(null);

      try {
        const configPayload = await loadBloggerConfig();
        const config = configPayload.config ?? DEFAULT_BLOGGER_CONFIG;
        const preparedItems = await Promise.all(
          files.map(async (file) => {
            const prepared = await preprocessBloggerImageFile(
              file,
              config.preprocess,
            );
            return {
              ...prepared,
              altText: file.name.replace(/\.[^.]+$/u, ''),
            };
          }),
        );

        const result = await uploadBloggerImages({
          items: preparedItems,
        });

        setUploadedItems((current) =>
          mergeUploadedItems(current, result.items),
        );
        insertUploadedImagesIntoEditor(result.items, position);
        setWorkspaceFeedback(
          result.items.length === 1
            ? t('blogger.imageInsertedSingle')
            : t('blogger.imageInsertedMany', { count: result.items.length }),
        );
      } catch (error) {
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : t('blogger.uploadFailed'),
        );
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
    (acceptedFiles: File[]) => {
      appendUploadDrafts(acceptedFiles);
    },
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
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== draftId);
    });
  }, []);

  const handleDraftAltChange = useCallback((draftId: string, value: string) => {
    setUploadDrafts((current) =>
      current.map((item) =>
        item.id === draftId ? { ...item, altText: value } : item,
      ),
    );
  }, []);

  const queuedDrafts = useMemo(
    () => uploadDrafts.filter((item) => item.status !== 'uploaded'),
    [uploadDrafts],
  );

  const handleBatchUpload = useCallback(async () => {
    if (queuedDrafts.length === 0) {
      return;
    }

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
          const prepared = await preprocessBloggerImageFile(
            draft.file,
            config.preprocess,
          );
          return {
            ...prepared,
            id: draft.id,
            altText: draft.altText,
          };
        }),
      );

      const response = await uploadBloggerImages({
        items: preparedItems,
      });

      const effectiveItems = response.items.map((item) => ({
        ...item,
        optimizedUrl: batchOptimizerEnabled
          ? (item.optimizedUrl ??
            previewOptimizerUrl(config, item.canonicalUrl))
          : null,
      }));
      const resultById = new Map(effectiveItems.map((item) => [item.id, item]));
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
      setUploadedItems((current) =>
        mergeUploadedItems(current, effectiveItems),
      );
      setWorkspaceFeedback(
        effectiveItems.length === 1
          ? t('blogger.batchUploadSuccessSingle')
          : t('blogger.batchUploadSuccessMany', { count: effectiveItems.length }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('blogger.uploadFailedShort');
      setUploadDrafts((current) =>
        current.map((item) =>
          queuedDrafts.some((draft) => draft.id === item.id)
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
  }, [batchOptimizerEnabled, queuedDrafts, t]);


  const handleCopyResult = useCallback(async (token: string, value: string) => {
    await copyText(value);
    setCopiedToken(token);
  }, []);

  const handleCopyAll = useCallback(async () => {
    const results = uploadDrafts
      .map((item) => item.result)
      .filter((item): item is BloggerUploadResult => Boolean(item));

    if (results.length === 0) {
      return;
    }

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

    if (results.length === 0) {
      return;
    }

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
      if (editorView === 'html') {
        syncEditorFromHtml(editor, editorHtml);
      }

      const labels = [
        ...deserializeBloggerLabels(defaultLabels),
        ...deserializeBloggerLabels(postLabelsInput),
      ];

      const result = await publishBloggerPost({
        title: postTitle,
        html:
          editorView === 'html'
            ? editorHtml
            : (editor?.getHTML() ?? editorHtml),
        labels,
        publish: publishLive,
        uploadedImages: uploadedItems,
      });

      const verb = result.isDraft ? t('blogger.post.status.draft') : t('blogger.post.status.published');
      setWorkspaceFeedback(
        result.postUrl
          ? t('blogger.publishSuccessWithUrl', { verb, url: result.postUrl })
          : t('blogger.publishSuccessWithId', { verb, id: result.postId }),
      );
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : t('blogger.publishFailed'),
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

  const publishLabelPreview = useMemo(
    () => [
      ...deserializeBloggerLabels(defaultLabels),
      ...deserializeBloggerLabels(postLabelsInput),
    ],
    [defaultLabels, postLabelsInput],
  );

  return (
    <div className="koma-cdn">
      {/* Hero */}
      <div className="koma-cdn__hero">
        <div className="koma-cdn__hero-info">
          <span className="koma-cdn__eyebrow">{t('blogger.title')}</span>
          <h2 className="koma-cdn__title">
            {t('blogger.heroTitle')}
          </h2>
          <p className="koma-cdn__desc">
            {t('blogger.heroDescription')}
          </p>
        </div>
        <div
          className={`koma-cdn__status${configReady ? ' koma-cdn__status--ready' : ''}`}
        >
          <span className="koma-cdn__status-dot" />
          {configReady ? t('blogger.ready') : t('blogger.configureInSettings')}
        </div>
      </div>

      {/* Tabs */}
      <div className="koma-cdn__tabs" role="tablist" aria-label={t('blogger.title')}>
        <button
          type="button"
          role="tab"
          aria-selected={workspaceTab === 'publish'}
          className={`koma-cdn__tab${workspaceTab === 'publish' ? ' koma-cdn__tab--active' : ''}`}
          onClick={() => setWorkspaceTab('publish')}
        >
          <NotebookPen size={13} /> {t('blogger.publishTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workspaceTab === 'upload'}
          className={`koma-cdn__tab${workspaceTab === 'upload' ? ' koma-cdn__tab--active' : ''}`}
          onClick={() => setWorkspaceTab('upload')}
        >
          <UploadCloud size={13} /> {t('blogger.uploadTab')}
        </button>
        <button
          type="button"
          className="koma-cdn__tab koma-cdn__tab--ghost"
          onClick={() => onOpenSettings?.()}
        >
          <Settings2 size={13} /> {t('blogger.settings')}
        </button>
      </div>

      {/* Alerts */}
      {!configReady && (
        <div className="koma-cdn__alert koma-cdn__alert--warn" role="alert">
          <AlertTriangle size={13} className="koma-cdn__alert-icon" />
          <div>
            <strong>{t('blogger.missingConfigTitle')}</strong>
            <p>{t('blogger.missingConfigBody')}</p>
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
          <Check size={13} className="koma-cdn__alert-icon" />
          <span>{workspaceFeedback}</span>
        </div>
      )}

      {workspaceTab === 'publish' ? (
        <div className="koma-cdn__layout koma-cdn__layout--publish">
          {/* Post config */}
          <section className="koma-cdn__surface">
            <div className="koma-cdn__sec-head">
              <div>
                <h3>{t('blogger.post.title')}</h3>
                <p>{t('blogger.post.description')}</p>
              </div>
            </div>
            <div className="koma-cdn__field">
              <label className="koma-cdn__label" htmlFor="bl-title">
                {t('blogger.post.postTitle')}
              </label>
              <input
                id="bl-title"
                className="koma-cdn__input"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder={t('blogger.post.postTitlePlaceholder')}
              />
            </div>
            <div className="koma-cdn__field-grid">
              <div className="koma-cdn__field">
                <label className="koma-cdn__label">{t('blogger.post.defaultLabels')}</label>
                <input
                  className="koma-cdn__input"
                  value={defaultLabels}
                  onChange={(e) => setDefaultLabels(e.target.value)}
                  placeholder={t('blogger.post.defaultLabelsPlaceholder')}
                />
              </div>
              <div className="koma-cdn__field">
                <label className="koma-cdn__label">{t('blogger.post.postLabels')}</label>
                <input
                  className="koma-cdn__input"
                  value={postLabelsInput}
                  onChange={(e) => setPostLabelsInput(e.target.value)}
                  placeholder={t('blogger.post.postLabelsPlaceholder')}
                />
              </div>
            </div>
            <label className="koma-cdn__toggle">
              <input
                type="checkbox"
                checked={publishLive}
                onChange={(e) => setPublishLive(e.target.checked)}
              />
              <span>{publishLive ? t('blogger.post.publishNow') : t('blogger.post.draft')}</span>
            </label>
            {publishLabelPreview.length > 0 && (
              <div className="koma-cdn__chips">
                {publishLabelPreview.map((l) => (
                  <span key={l} className="koma-cdn__chip">
                    {l}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Editor */}
          <section className="koma-cdn__surface koma-cdn__surface--editor">
            <div className="koma-cdn__sec-head">
              <div>
                <h3>{t('blogger.editor.title')}</h3>
                <p>{t('blogger.editor.description')}</p>
              </div>
              <div className="koma-cdn__seg">
                <button
                  type="button"
                  className={`koma-cdn__seg-btn${editorView === 'visual' ? ' koma-cdn__seg-btn--active' : ''}`}
                  onClick={() => handleViewChange('visual')}
                >
                  <NotebookPen size={12} /> {t('blogger.editor.visual')}
                </button>
                <button
                  type="button"
                  className={`koma-cdn__seg-btn${editorView === 'html' ? ' koma-cdn__seg-btn--active' : ''}`}
                  onClick={() => handleViewChange('html')}
                >
                  <Code2 size={12} /> HTML
                </button>
                <button
                  type="button"
                  className={`koma-cdn__seg-btn${editorView === 'preview' ? ' koma-cdn__seg-btn--active' : ''}`}
                  onClick={() => handleViewChange('preview')}
                >
                  <Eye size={12} /> {t('blogger.editor.preview')}
                </button>
              </div>
            </div>

            {editorView === 'visual' && (
              <>
                <BloggerEditorToolbar
                  editor={editor}
                  configReady={configReady}
                  insertBusy={insertBusy}
                  onInsertImages={() => editorImageInputRef.current?.click()}
                  t={t}
                />

                <div className="koma-cdn__editor">
                  <EditorContent editor={editor} />
                </div>
              </>
            )}
            {editorView === 'html' && (
              <textarea
                className="koma-cdn__textarea"
                value={editorHtml}
                onChange={(e) => setEditorHtml(e.target.value)}
                spellCheck={false}
              />
            )}
            {editorView === 'preview' && (
              <iframe
                className="koma-cdn__preview-frame"
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
            <div className="koma-cdn__actions">
              <button
                type="button"
                className="koma-btn koma-btn--ghost koma-btn--sm"
                disabled={!editorHtml.trim()}
                onClick={() => void handleCopyResult('html', editorHtml)}
              >
                <Copy size={12} /> {copiedToken === 'html' ? t('blogger.copied') : 'HTML'}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--primary koma-btn--sm"
                disabled={!configReady || publishBusy}
                onClick={() => void handlePublishPost()}
              >
                {publishBusy ? (
                  <Loader2 size={12} className="koma-cdn-spin" />
                ) : publishLive ? (
                  <Send size={12} />
                ) : (
                  <Save size={12} />
                )}
                {publishBusy
                  ? t('common.sending')
                  : publishLive
                    ? t('blogger.post.publish')
                    : t('blogger.post.draft')}
              </button>
            </div>
          </section>
        </div>
      ) : (
        <BloggerUploadPanel
          t={t}
          uploadDropzone={uploadDropzone}
          batchOptimizerEnabled={batchOptimizerEnabled}
          setBatchOptimizerEnabled={setBatchOptimizerEnabled}
          bulkPreferOptimizedUrl={bulkPreferOptimizedUrl}
          setBulkPreferOptimizedUrl={setBulkPreferOptimizedUrl}
          bulkAsImageTag={bulkAsImageTag}
          setBulkAsImageTag={setBulkAsImageTag}
          uploadInputRef={uploadInputRef}
          appendUploadDrafts={appendUploadDrafts}
          configReady={configReady}
          queuedDrafts={queuedDrafts}
          uploadBusy={uploadBusy}
          handleBatchUpload={handleBatchUpload}
          uploadDrafts={uploadDrafts}
          copiedToken={copiedToken}
          handleCopyAll={handleCopyAll}
          handleExportAll={handleExportAll}
          handleDraftAltChange={handleDraftAltChange}
          handleCopyResult={handleCopyResult}
          handleRemoveDraft={handleRemoveDraft}
        />
      )}
    </div>
  );
};

export default BloggerWorkspace;
