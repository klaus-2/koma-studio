import { useCallback, useEffect, useState } from 'react';

import { desktopBridge } from '@/lib/desktop-bridge';
import type { AuthUser } from '../../../contexts/AuthContext';
import type { useI18n } from '../../../i18n';
import { useAuthConfigQuery } from '../../../query/authConfig';
import { maskEmail } from '../settings.constants';
import type { TravelTokenMetadata } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsTravelTokenArgs {
  user: AuthUser | null;
  isDesktop: boolean;
  t: TranslationFn;
  fmtDate: (value: number | string | null) => string;
  travelDaysLabel: (value: number | null) => string;
}

export const useSettingsTravelToken = ({
  user,
  isDesktop,
  t,
  fmtDate,
  travelDaysLabel,
}: UseSettingsTravelTokenArgs) => {
  const { data: authConfig } = useAuthConfigQuery();

  const [emailDeliveryEnabled, setEmailDeliveryEnabled] = useState<boolean | null>(null);
  const [travelBusy, setTravelBusy] = useState(false);
  const [travelFeedback, setTravelFeedback] = useState<string | null>(null);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [travelMeta, setTravelMeta] = useState<TravelTokenMetadata | null>(null);

  useEffect(() => {
    if (!authConfig) {
      setEmailDeliveryEnabled(false);
      return;
    }
    setEmailDeliveryEnabled(authConfig.emailDeliveryEnabled === true);
  }, [authConfig]);

  const handleTravel = useCallback(async () => {
    setTravelFeedback(null);
    setTravelError(null);
    setTravelMeta(null);
    const api = desktopBridge.desktop?.api?.auth;
    if (!api) {
      setTravelError(t("settings.app.updater.desktopOnly"));
      return;
    }
    setTravelBusy(true);
    try {
      const env = await api.createTravelToken({ deliveryMode: "email" });
      if (!env.ok) {
        const msg =
          env.payload?.code === "AUTH_EMAIL_DELIVERY_UNAVAILABLE"
            ? t("login.travel.emailDisabled")
            : (env.payload?.error ?? `Error ${env.status}`);
        setTravelError(msg);
        return;
      }
      const p = env.payload;
      if (!p?.emailSent || !p.expiresAt || typeof p.travelDays !== "number") {
        setTravelError(t("login.error.missingTravelToken"));
        return;
      }
      setTravelMeta({
        destinationMasked: p.destinationMasked ?? maskEmail(user?.email),
        expiresAt: p.expiresAt,
        travelDays: p.travelDays,
      });
      setTravelFeedback(t("settings.general.travel.success"));
    } catch (e) {
      setTravelError(e instanceof Error ? e.message : t("settings.general.travel.error"));
    } finally {
      setTravelBusy(false);
    }
  }, [t, user?.email]);

  const maskedDest = travelMeta?.destinationMasked ?? maskEmail(user?.email);
  const travelExpires = travelMeta ? fmtDate(travelMeta.expiresAt) : t("settings.travel.definedOnSend");
  const travelDuration = travelDaysLabel(travelMeta?.travelDays ?? null);
  const travelBlocked = !isDesktop
    ? t("settings.travel.blocked.notDesktop")
    : emailDeliveryEnabled === false
      ? t("settings.travel.blocked.noEmail")
      : emailDeliveryEnabled === null
        ? t("settings.travel.blocked.validating")
        : null;

  return {
    maskedDest,
    travelExpires,
    travelDuration,
    travelBusy,
    emailDeliveryEnabled,
    handleTravel,
    travelBlocked,
    travelFeedback,
    travelMeta,
    travelError,
  };
};
