// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DashboardSidebarSkeletonClassic from './DashboardSidebarSkeletonClassic';
import DashboardSidebarSkeletonNoir from './noir/DashboardSidebarSkeletonNoir';
import { SIDEBAR_SKELETON_SECTIONS } from './sidebar-skeleton-layout';

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string): string => key }),
}));

describe.each([
  ['classic', DashboardSidebarSkeletonClassic],
  ['noir', DashboardSidebarSkeletonNoir],
])('%s sidebar skeleton', (_family, Skeleton) => {
  it('announces a busy loading status with the translated label', () => {
    render(<Skeleton />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toBe('common.loading');
  });

  it('draws one hidden placeholder card per sidebar section', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(SIDEBAR_SKELETON_SECTIONS.length);
    expect(screen.queryByText('Loading workspace...')).toBeNull();
  });
});
