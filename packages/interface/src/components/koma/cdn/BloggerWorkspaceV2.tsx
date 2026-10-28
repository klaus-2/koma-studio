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
import { useEditor } from '@tiptap/react';
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
  copyText,
  downloadTextFile,
  KOMA_EASE,
} from './CdnV2Primitives';
import {
  type BloggerEditorView,
  type BloggerWorkspaceProps,
  type BloggerWorkspaceTab,
  type UploadDraftItem,
} from './BloggerWorkspaceV2.types';
import { BloggerEditorPanelV2 } from './BloggerEditorPanelV2';
import { BloggerPostMetadataPanelV2 } from './BloggerPostMetadataPanelV2';
import { BloggerUploadIntakePanelV2 } from './BloggerUploadIntakePanelV2';
import { BloggerUploadQueuePanelV2 } from './BloggerUploadQueuePanelV2';
import { BloggerWorkspaceHeroV2 } from './BloggerWorkspaceHeroV2';
import { BloggerWorkspaceNavV2 } from './BloggerWorkspaceNavV2';
import { BloggerWorkspaceNoticesV2 } from './BloggerWorkspaceNoticesV2';
import {
  buildSafePreviewDocument,
  syncEditorFromHtml,
} from './bloggerEditorHtml';
import { mergeUploadedItems } from './bloggerUploadMerge';

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

  return (
    <div
      className="relative isolate space-y-4"
    >
      <BloggerWorkspaceHeroV2
        configReady={configReady}
        uploadedItems={uploadedItems}
        publishLabelPreview={publishLabelPreview}
        publishLive={publishLive}
      />

      {/* Navigation */}
      <BloggerWorkspaceNavV2
        workspaceTab={workspaceTab}
        setWorkspaceTab={setWorkspaceTab}
        uploadDrafts={uploadDrafts}
        onOpenSettings={onOpenSettings}
      />

      {/* Notices */}
      <BloggerWorkspaceNoticesV2
        configReady={configReady}
        onOpenSettings={onOpenSettings}
        workspaceError={workspaceError}
        workspaceFeedback={workspaceFeedback}
      />

      <AnimatePresence mode="wait">
        {workspaceTab === 'publish' ? (
          <m.div
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
            <BloggerPostMetadataPanelV2
              postTitle={postTitle}
              setPostTitle={setPostTitle}
              defaultLabels={defaultLabels}
              setDefaultLabels={setDefaultLabels}
              postLabelsInput={postLabelsInput}
              setPostLabelsInput={setPostLabelsInput}
              publishLive={publishLive}
              setPublishLive={setPublishLive}
              publishLabelPreview={publishLabelPreview}
            />

            {/* Editor */}
            <BloggerEditorPanelV2
              editor={editor}
              editorView={editorView}
              handleViewChange={handleViewChange}
              editorHtml={editorHtml}
              setEditorHtml={setEditorHtml}
              previewSrcDoc={previewSrcDoc}
              configReady={configReady}
              insertBusy={insertBusy}
              handleEditorImageUpload={handleEditorImageUpload}
              copiedToken={copiedToken}
              handleCopyResult={handleCopyResult}
              publishBusy={publishBusy}
              publishLive={publishLive}
              handlePublishPost={handlePublishPost}
              uploadedItems={uploadedItems}
            />
          </m.div>
        ) : (
          <m.div
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
            <BloggerUploadIntakePanelV2
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
              completedDrafts={completedDrafts}
              copiedToken={copiedToken}
              handleCopyAll={handleCopyAll}
              handleExportAll={handleExportAll}
            />

            {/* Queue */}
            <BloggerUploadQueuePanelV2
              uploadDrafts={uploadDrafts}
              queuedDrafts={queuedDrafts}
              completedDrafts={completedDrafts}
              reduceMotion={reduceMotion}
              copiedToken={copiedToken}
              handleDraftAltChange={handleDraftAltChange}
              handleCopyResult={handleCopyResult}
              handleRemoveDraft={handleRemoveDraft}
            />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BloggerWorkspaceV2;
