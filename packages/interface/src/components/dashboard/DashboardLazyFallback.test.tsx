import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '../../i18n';
import { DashboardLazyFallback } from './DashboardLazyFallback';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

describe('DashboardLazyFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({ theme: 'dark', family: 'noir' });
  });

  it('renders Noir editorial skeleton when theme family is noir', () => {
    const { container } = render(
      <I18nProvider>
        <DashboardLazyFallback />
      </I18nProvider>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-label', 'Preparing Workspace');
    expect(container.querySelector('.panel-cut')).not.toBeNull();
  });

  it('renders Classic Manhwa Glass skeleton when theme family is classic', () => {
    useThemeStore.setState({ theme: 'dark', family: 'classic' });

    const { container } = render(
      <I18nProvider>
        <DashboardLazyFallback label="Loading Studio" />
      </I18nProvider>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Loading Studio');
    expect(
      container.querySelector('.koma-ws-loading__classic-card'),
    ).not.toBeNull();
  });
});
