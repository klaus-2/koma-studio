// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import CustomLlmProfilesManagerSection from '@/components/dashboard/CustomLlmProfilesManagerSection';
import type { CustomLlmProfileDraft } from '@/utils/customLlm';
import { createEmptyCustomLlmDraft } from '@/utils/customLlm';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

afterEach(cleanup);

const draft: CustomLlmProfileDraft = {
  ...createEmptyCustomLlmDraft(),
  id: 'profile-1',
  label: 'API',
  model: 'auto',
  apiBase: 'http://127.0.0.1:31415/v1',
};

interface SectionPropsOverrides {
  onUseExisting?: () => boolean | void;
  onSaveDraft?: () => Promise<boolean> | boolean | void;
}

const renderSection = (overrides: SectionPropsOverrides = {}) =>
  render(
    <I18nProvider>
      <CustomLlmProfilesManagerSection
        stage="translation"
        profiles={[]}
        draft={draft}
        loading={false}
        error={null}
        persistenceHint="Custom profiles saved on desktop with secure storage."
        providerNotice={null}
        onLoadProfile={() => undefined}
        onUpdateDraft={() => undefined}
        onUseExisting={() => true}
        onResetDraft={() => undefined}
        onRemoveDraft={() => Promise.resolve()}
        onSaveDraft={() => Promise.resolve(true)}
        {...overrides}
      />
    </I18nProvider>,
  );

const setupUser = () => userEvent.setup();

describe('CustomLlmProfilesManagerSection save feedback', () => {
  it('flashes Saved on the button after a successful save, then resets', async () => {
    const user = setupUser();
    renderSection();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Saved' })).toBeTruthy());

    await waitFor(
      () => expect(screen.queryByRole('button', { name: 'Save' })).toBeTruthy(),
      { timeout: 3000 },
    );
  });

  it('shows a disabled Saving state while the save is in flight', async () => {
    let resolveSave: ((ok: boolean) => void) | undefined;
    const user = setupUser();
    renderSection({
      onSaveDraft: () =>
        new Promise<boolean>((resolve) => {
          resolveSave = resolve;
        }),
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    const saving = await screen.findByRole('button', { name: 'Saving...' });
    expect(saving).toHaveProperty('disabled', true);

    resolveSave?.(true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Saved' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Saved' })).toHaveProperty('disabled', false);
  });

  it('does not flash Saved when the save reports failure', async () => {
    const user = setupUser();
    renderSection({ onSaveDraft: () => Promise.resolve(false) });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull();
  });
});

describe('CustomLlmProfilesManagerSection use feedback', () => {
  it('flashes In use on the button after the profile becomes active, then resets', async () => {
    const user = setupUser();
    renderSection();
    await user.click(screen.getByRole('button', { name: 'Use Translation' }));

    expect(screen.queryByRole('button', { name: 'In use' })).toBeTruthy();

    await waitFor(
      () => expect(screen.queryByRole('button', { name: 'Use Translation' })).toBeTruthy(),
      { timeout: 3000 },
    );
  });

  it('does not flash In use when no profile was selected', async () => {
    const user = setupUser();
    renderSection({ onUseExisting: () => false });

    await user.click(screen.getByRole('button', { name: 'Use Translation' }));

    expect(screen.queryByRole('button', { name: 'In use' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use Translation' })).toBeTruthy();
  });
});
