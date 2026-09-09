import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '../i18n';
import type { DashboardUser } from '../types/dashboard.types';

interface AuthLikeUser {
  id?: string | null;
  name?: string | null;
  email: string;
}

interface UseDashboardAccountSyncArgs {
  authUser: AuthLikeUser | null;
  sendVerificationEmail: () => Promise<void>;
  setStatusMessage: (message: string) => void;
  setUser: React.Dispatch<React.SetStateAction<DashboardUser>>;
}

export function useDashboardAccountSync({
  authUser,
  sendVerificationEmail,
  setStatusMessage,
  setUser,
}: UseDashboardAccountSyncArgs) {
  const { t } = useI18n();
  const [verifyEmailSending, setVerifyEmailSending] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    setUser((prev) => ({
      ...prev,
      name: authUser.name ?? prev.name,
      email: authUser.email,
    }));
  }, [authUser, setUser]);

  const handleSendVerificationEmail = useCallback(async () => {
    setVerifyEmailSending(true);
    try {
      await sendVerificationEmail();
      setStatusMessage(t('accountSync.confirmEmailSent'));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('accountSync.confirmEmailFailed'));
    } finally {
      setVerifyEmailSending(false);
    }
  }, [sendVerificationEmail, setStatusMessage, t]);

  return {
    verifyEmailSending,
    handleSendVerificationEmail,
  };
}
