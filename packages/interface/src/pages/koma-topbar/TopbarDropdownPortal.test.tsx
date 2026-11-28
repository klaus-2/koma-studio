import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopbarDropdownPortal } from './TopbarDropdownPortal';

function Harness({ isOpen, align = 'right' }: { isOpen: boolean; align?: 'left' | 'right' }) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  return (
    <div style={{ position: 'relative', zIndex: 3 }} data-testid="low-stacking-context">
      <div ref={anchorRef} data-testid="anchor" />
      <TopbarDropdownPortal isOpen={isOpen} anchorRef={anchorRef} align={align}>
        <div role="menu" data-testid="menu-body">
          Menu Content
        </div>
      </TopbarDropdownPortal>
    </div>
  );
}

describe('TopbarDropdownPortal', () => {
  it('portals content to document.body outside parent z-index: 3 stacking context', () => {
    render(<Harness isOpen />);

    const menu = screen.getByTestId('menu-body');
    const portalRoot = menu.closest('[data-koma-topbar-dropdown="true"]');
    expect(portalRoot).not.toBeNull();
    expect(portalRoot?.parentElement).toBe(document.body);
    expect(screen.getByTestId('low-stacking-context').contains(menu)).toBe(false);
    expect((portalRoot as HTMLElement).style.zIndex).toBe('var(--z-dropdown, 120)');
    expect((portalRoot as HTMLElement).style.position).toBe('fixed');
  });

  it('does not render when closed', () => {
    render(<Harness isOpen={false} />);
    expect(screen.queryByTestId('menu-body')).toBeNull();
  });
});
