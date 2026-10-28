import { AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Settings2,
} from 'lucide-react';

import { useI18n } from '@/i18n';

import { WorkspaceNotice } from './CdnV2Primitives';

interface BloggerWorkspaceNoticesV2Props {
  configReady: boolean;
  onOpenSettings?: () => void;
  workspaceError: string | null;
  workspaceFeedback: string | null;
}

export function BloggerWorkspaceNoticesV2({
  configReady,
  onOpenSettings,
  workspaceError,
  workspaceFeedback,
}: BloggerWorkspaceNoticesV2Props) {
  const { t } = useI18n();

  return (
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
  );
}
