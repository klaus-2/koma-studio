import { useCallback, useEffect, useRef, useState } from 'react';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import FirstRunSlowNoticeClassic from './FirstRunSlowNoticeClassic';
import FirstRunSlowNoticeNoir from './noir/FirstRunSlowNoticeNoir';
import { useToolTips } from '../hooks/useToolTips';
import { useAioPipelineStore } from '../pages/dashboard/stores/aio-pipeline-store';

export const FIRST_RUN_NOTICE_TIP_ID = 'first-run-slow-notice';

export interface FirstRunNoticeController {
  dismiss: () => void;
  dontShowAgain: boolean;
  setDontShowAgain: (checked: boolean) => void;
}

const useFirstRunNoticeController = (): FirstRunNoticeController & { open: boolean } => {
  const aioRunning = useAioPipelineStore((s) => s.aioExecutionStatus !== null);
  const { shouldShow, dismiss: markSeen, isDismissedForever, setDismissedForever } =
    useToolTips();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const setVisible = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
  }, []);

  useEffect(() => {
    if (aioRunning) {
      if (!openRef.current && shouldShow(FIRST_RUN_NOTICE_TIP_ID)) {
        markSeen(FIRST_RUN_NOTICE_TIP_ID);
        setVisible(true);
      }
      return;
    }
    if (openRef.current) setVisible(false);
  }, [aioRunning, markSeen, setVisible, shouldShow]);

  const dismiss = useCallback(() => setVisible(false), [setVisible]);
  const setDontShowAgain = useCallback(
    (checked: boolean) => setDismissedForever(FIRST_RUN_NOTICE_TIP_ID, checked),
    [setDismissedForever],
  );

  return {
    open,
    dismiss,
    dontShowAgain: isDismissedForever(FIRST_RUN_NOTICE_TIP_ID),
    setDontShowAgain,
  };
};

const FirstRunSlowNoticeFamily = createFamilyComponent(
  FirstRunSlowNoticeClassic,
  FirstRunSlowNoticeNoir,
);

export function FirstRunSlowNotice() {
  const { open, ...controller } = useFirstRunNoticeController();
  if (!open) return null;
  return <FirstRunSlowNoticeFamily controller={controller} />;
}

export default FirstRunSlowNotice;
