import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export interface TopbarDropdownPortalProps {
  isOpen: boolean;
  anchorRef: RefObject<HTMLDivElement | null>;
  align: 'left' | 'right';
  offsetY?: number;
  margin?: number;
  children: ReactNode;
}

export function TopbarDropdownPortal({
  isOpen,
  anchorRef,
  align,
  offsetY = 10,
  margin = 8,
  children,
}: TopbarDropdownPortalProps) {
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const vw = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 800;
      const top = Math.max(margin, Math.min(rect.bottom + offsetY, vh - margin));

      if (align === 'right') {
        const right = Math.max(margin, vw - rect.right);
        setCoords({ top, right });
      } else {
        const left = Math.max(margin, Math.min(rect.left, vw - margin));
        setCoords({ top, left });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorRef, isOpen, margin, offsetY]);

  if (!isOpen || !coords || typeof document === 'undefined') {
    return null;
  }

  const style: CSSProperties = {
    position: 'fixed',
    top: `${coords.top}px`,
    ...(coords.left !== undefined ? { left: `${coords.left}px` } : {}),
    ...(coords.right !== undefined ? { right: `${coords.right}px` } : {}),
    zIndex: 'var(--z-dropdown, 120)',
  };

  return createPortal(
    <div data-koma-topbar-dropdown="true" style={style}>
      {children}
    </div>,
    document.body,
  );
}
