// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import ScanlationFeedContent from './ScanlationFeedContent';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const probes = vi.hoisted(() => ({
  header: vi.fn(),
  posts: vi.fn(),
  sidebar: vi.fn(),
}));

vi.mock('./ScanlationFeedHeaderToolbar', () => ({
  default: () => {
    probes.header();
    return null;
  },
}));

vi.mock('./ScanlationFeedPostsPanel', () => ({
  default: () => {
    probes.posts();
    return null;
  },
}));

vi.mock('./ScanlationFeedSidebar', () => ({
  default: () => {
    probes.sidebar();
    return null;
  },
}));

type ContentProps = ComponentProps<typeof ScanlationFeedContent>;

const baseProps: ContentProps = {
  tab: 'recruitment',
  canModerate: false,
  heroTitle: 'Herd',
  composerTypeLabel: 'vaga',
  feedback: null,
  error: null,
  loading: false,
  profile: null,
  rulesAccepted: false,
  profileWebhookEnabled: false,
  profileWebhook: '',
  visiblePosts: [],
  formattedVisiblePostDates: new Map<string, string>(),
  sentApplications: [],
  receivedApplications: [],
  reports: [],
  bans: [],
  banTargetUserId: '',
  banReason: '',
  banScope: 'account_only',
  moderationBanScopes: [],
  onBackDashboard: () => undefined,
  onTabChange: () => undefined,
  onOpenComposer: () => undefined,
  onApplyPost: () => undefined,
  onReportPost: () => undefined,
  onModerationPost: () => undefined,
  onStartBanFromPost: () => undefined,
  onRulesAcceptedChange: () => undefined,
  onProfileWebhookEnabledChange: () => undefined,
  onProfileWebhookChange: () => undefined,
  onSaveProfile: () => undefined,
  setBanTargetUserId: () => undefined,
  setBanReason: () => undefined,
  setBanScope: () => undefined,
  onResolveReport: () => undefined,
  onCreateBan: () => undefined,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function renderContent(props: ContentProps) {
  return render(
    <I18nProvider>
      <ScanlationFeedContent {...props} />
    </I18nProvider>,
  );
}

describe('ScanlationFeedContent (classic) memo boundary', () => {
  it('renders the toolbar, posts panel and sidebar once', () => {
    renderContent(baseProps);

    expect(probes.header).toHaveBeenCalledTimes(1);
    expect(probes.posts).toHaveBeenCalledTimes(1);
    expect(probes.sidebar).toHaveBeenCalledTimes(1);
  });

  it('skips the subtree when the parent re-renders with stable props', () => {
    const { rerender } = renderContent(baseProps);

    rerender(
      <I18nProvider>
        <ScanlationFeedContent {...baseProps} />
      </I18nProvider>,
    );

    expect(probes.header).toHaveBeenCalledTimes(1);
    expect(probes.posts).toHaveBeenCalledTimes(1);
    expect(probes.sidebar).toHaveBeenCalledTimes(1);
  });

  it('re-renders when a content prop changes', () => {
    const { rerender } = renderContent(baseProps);

    rerender(
      <I18nProvider>
        <ScanlationFeedContent {...baseProps} visiblePosts={[]} />
      </I18nProvider>,
    );

    expect(probes.header).toHaveBeenCalledTimes(2);
    expect(probes.posts).toHaveBeenCalledTimes(2);
    expect(probes.sidebar).toHaveBeenCalledTimes(2);
  });
});
