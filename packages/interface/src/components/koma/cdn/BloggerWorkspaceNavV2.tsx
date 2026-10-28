import type {
  Dispatch,
  SetStateAction,
} from 'react';

import {
  NotebookPen,
  Settings2,
  UploadCloud,
} from 'lucide-react';

import { useI18n } from '@/i18n';

import type {
  BloggerWorkspaceTab,
  UploadDraftItem,
} from './BloggerWorkspaceV2.types';

interface BloggerWorkspaceNavV2Props {
  workspaceTab: BloggerWorkspaceTab;
  setWorkspaceTab: Dispatch<SetStateAction<BloggerWorkspaceTab>>;
  uploadDrafts: UploadDraftItem[];
  onOpenSettings?: () => void;
}

export function BloggerWorkspaceNavV2({
  workspaceTab,
  setWorkspaceTab,
  uploadDrafts,
  onOpenSettings,
}: BloggerWorkspaceNavV2Props) {
  const { t } = useI18n();

  return (
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
  );
}
