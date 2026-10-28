import {
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { Editor } from '@tiptap/react';
import {
  Check,
  Code2,
  Copy,
  Eye,
  FileCode2,
  Loader2,
  NotebookPen,
  Save,
  Send,
} from 'lucide-react';

import type { BloggerUploadResult } from '@/types';
import { useI18n } from '@/i18n';

import type { BloggerEditorView } from './BloggerWorkspaceV2.types';
import { BloggerEditorCanvasV2 } from './BloggerEditorCanvasV2';
import { EditorialCdnPanel } from './CdnV2Primitives';

interface BloggerEditorPanelV2Props {
  editor: Editor | null;
  editorView: BloggerEditorView;
  handleViewChange: (nextView: BloggerEditorView) => void;
  editorHtml: string;
  setEditorHtml: Dispatch<SetStateAction<string>>;
  previewSrcDoc: string;
  configReady: boolean;
  insertBusy: boolean;
  handleEditorImageUpload: (files: File[]) => Promise<void>;
  copiedToken: string | null;
  handleCopyResult: (token: string, value: string) => Promise<void>;
  publishBusy: boolean;
  publishLive: boolean;
  handlePublishPost: () => Promise<void>;
  uploadedItems: BloggerUploadResult[];
}

export function BloggerEditorPanelV2({
  editor,
  editorView,
  handleViewChange,
  editorHtml,
  setEditorHtml,
  previewSrcDoc,
  configReady,
  insertBusy,
  handleEditorImageUpload,
  copiedToken,
  handleCopyResult,
  publishBusy,
  publishLive,
  handlePublishPost,
  uploadedItems,
}: BloggerEditorPanelV2Props) {
  const { t } = useI18n();

  const editorImageInputRef =
    useRef<HTMLInputElement | null>(null);

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
      <BloggerEditorCanvasV2
        editor={editor}
        editorView={editorView}
        editorHtml={editorHtml}
        setEditorHtml={setEditorHtml}
        previewSrcDoc={previewSrcDoc}
        configReady={configReady}
        insertBusy={insertBusy}
        editorImageInputRef={editorImageInputRef}
      />

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
  );
}
