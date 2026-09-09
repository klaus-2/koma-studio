import { useEffect, useRef, useState } from 'react';

export function useDashboardMenus() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [utilsMenuOpen, setUtilsMenuOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const utilsMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: globalThis.MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
      if (utilsMenuRef.current && !utilsMenuRef.current.contains(event.target as Node)) setUtilsMenuOpen(false);
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) setDownloadMenuOpen(false);
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, []);

  return {
    userMenuOpen,
    setUserMenuOpen,
    utilsMenuOpen,
    setUtilsMenuOpen,
    downloadMenuOpen,
    setDownloadMenuOpen,
    userMenuRef,
    utilsMenuRef,
    downloadMenuRef,
  };
}
