import { useCallback, useState } from 'react';

import type { useI18n } from '../../../i18n';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsProfileVerificationArgs {
  sendVerificationEmail: () => Promise<void>;
  t: TranslationFn;
}

export const useSettingsProfileVerification = ({
  sendVerificationEmail,
  t,
}: UseSettingsProfileVerificationArgs) => {
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleVerify = useCallback(async () => {
    setProfileFeedback(null);
    setProfileError(null);
    setVerificationBusy(true);
    try {
      await sendVerificationEmail();
      setProfileFeedback(t("settings.general.profile.verifySuccess"));
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : t("settings.general.profile.verifyError"));
    } finally {
      setVerificationBusy(false);
    }
  }, [sendVerificationEmail, t]);

  return {
    verificationBusy,
    handleVerify,
    profileFeedback,
    profileError,
  };
};
