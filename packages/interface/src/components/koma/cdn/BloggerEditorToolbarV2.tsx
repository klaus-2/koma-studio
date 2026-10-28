import type { RefObject } from 'react';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Underline as UnderlineIcon,
} from 'lucide-react';

import { useI18n } from '@/i18n';

import { BloggerEditorToolbarButton as ToolbarButton } from './BloggerEditorToolbarButtonV2';

interface BloggerEditorToolbarV2Props {
  editor: Editor | null;
  configReady: boolean;
  insertBusy: boolean;
  editorImageInputRef: RefObject<HTMLInputElement | null>;
}

export function BloggerEditorToolbarV2({
  editor,
  configReady,
  insertBusy,
  editorImageInputRef,
}: BloggerEditorToolbarV2Props) {
  const { t } = useI18n();

  return (
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
  );
}
