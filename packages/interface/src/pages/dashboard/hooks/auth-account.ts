import { useMemo } from 'react';

import type { AuthUser } from '../../../contexts/AuthContext';
import { useDashboardProcessingStats } from '../../../hooks/useDashboardProcessingStats';
import { useDiscordRPC } from '../../../hooks/useDiscordRPC';
import { useAuthAccountStore } from '../stores/auth-account-store';

/**
 * Processing stats for the dashboard (day/week/month counters) keyed by
 * the auth session identity with the signed-out display email fallback.
 */
export function useAuthAccountProcessingStats({
  authUser,
}: {
  authUser: AuthUser | null;
}) {
  const user = useAuthAccountStore((s) => s.user);
  return useDashboardProcessingStats(
    authUser?.id ?? authUser?.email ?? user.email ?? null,
  );
}

/**
 * Discord RPC presence controller wired to the auth session.
 */
export function useDiscordPresence({
  authUser,
}: {
  authUser: AuthUser | null;
}) {
  const discordUser = useMemo(
    () =>
      authUser
        ? {
            name: authUser.name,
            email: authUser.email,
          }
        : null,
    [authUser?.email, authUser?.name],
  );
  const discord = useDiscordRPC(discordUser);
  const {
    setPreset: setDiscordPreset,
    setTranslating: setDiscordTranslating,
  } = discord;

  return { discord, setDiscordPreset, setDiscordTranslating };
}
