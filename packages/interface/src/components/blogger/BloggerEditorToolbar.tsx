import type { ReactNode } from 'react';

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

import type { useI18n } from '../../i18n';

type I18nTranslate = ReturnType<typeof useI18n>['t'];

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}

interface BloggerEditorToolbarProps {
  editor: Editor | null;
  configReady: boolean;
  insertBusy: boolean;
  onInsertImages: () => void;
  t: I18nTranslate;
}

const ToolbarButton = ({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: ToolbarButtonProps) => (
  <button
    type="button"
    className={`koma-blogger__toolbtn ${active ? 'koma-blogger__toolbtn--active' : ''}`}
    disabled={disabled}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);

export const BloggerEditorToolbar = ({
  editor,
  configReady,
  insertBusy,
  onInsertImages,
  t,
}: BloggerEditorToolbarProps) => (
  <div className="koma-cdn__toolbar">
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
        const url = window.prompt(t('blogger.editor.promptUrl'));
        if (!url) return;
        editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }}
    >
      <Link2 size={14} />
    </ToolbarButton>
    <button
      type="button"
      className="koma-cdn__insert-btn"
      disabled={!configReady || insertBusy}
      onClick={onInsertImages}
    >
      {insertBusy ? (
        <Loader2 size={13} className="koma-cdn-spin" />
      ) : (
        <ImagePlus size={13} />
      )}{' '}
      {t('blogger.editor.insertImages')}
    </button>
  </div>
);
