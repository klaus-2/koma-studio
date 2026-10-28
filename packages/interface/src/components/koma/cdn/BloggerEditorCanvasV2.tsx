import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react';

import { m, AnimatePresence } from 'framer-motion';
import {
  EditorContent,
  type Editor,
} from '@tiptap/react';

import { useI18n } from '@/i18n';

import { BloggerEditorToolbarV2 } from './BloggerEditorToolbarV2';
import type { BloggerEditorView } from './BloggerWorkspaceV2.types';

interface BloggerEditorCanvasV2Props {
  editor: Editor | null;
  editorView: BloggerEditorView;
  editorHtml: string;
  setEditorHtml: Dispatch<SetStateAction<string>>;
  previewSrcDoc: string;
  configReady: boolean;
  insertBusy: boolean;
  editorImageInputRef: RefObject<HTMLInputElement | null>;
}

export function BloggerEditorCanvasV2({
  editor,
  editorView,
  editorHtml,
  setEditorHtml,
  previewSrcDoc,
  configReady,
  insertBusy,
  editorImageInputRef,
}: BloggerEditorCanvasV2Props) {
  const { t } = useI18n();

  return (
    <AnimatePresence mode="wait">
      {editorView === 'visual' ? (
        <m.div
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
          <BloggerEditorToolbarV2
            editor={editor}
            configReady={configReady}
            insertBusy={insertBusy}
            editorImageInputRef={editorImageInputRef}
          />

          <div className="koma-editor-shell min-h-[560px] bg-paper">
            <EditorContent
              editor={editor}
            />
          </div>
        </m.div>
      ) : null}

      {editorView === 'html' ? (
        <m.div
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
        </m.div>
      ) : null}

      {editorView === 'preview' ? (
        <m.div
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
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
