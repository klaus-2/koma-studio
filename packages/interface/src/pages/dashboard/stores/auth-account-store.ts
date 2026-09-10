import type { SetStateAction } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { DashboardUser } from '../../../types/dashboard.types';

/**
 * Auth-account domain: the signed-out display fallback for the user's
 * name/email (synced from the auth session by the account-sync hook).
 */
interface AuthAccountStore {
  user: DashboardUser;
  /** Value-or-updater: useDashboardAccountSync receives a
   *  Dispatch<SetStateAction<DashboardUser>> same-name arg and its
   *  session-sync effect updates the profile functionally. */
  setUser: (value: SetStateAction<DashboardUser>) => void;
}

export const useAuthAccountStore = create<AuthAccountStore>()(
  devtools(
    (set) => ({
      // Same initial value the page's useState had.
      user: {
        name: '',
        email: '',
      },
      setUser: (value) =>
        set((state) => ({
          user: typeof value === 'function' ? value(state.user) : value,
        })),
    }),
    { name: 'auth-account-store' },
  ),
);
