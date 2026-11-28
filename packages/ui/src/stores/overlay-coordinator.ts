import React, { createContext, useContext, useEffect, useRef } from 'react';

type CloseCallback = () => void;

interface OverlayEntry {
  id: string;
  parentId?: string;
  close: () => void;
}

const entries = new Map<string, OverlayEntry>();

function isAncestorOf(candidateAncestorId: string, overlayId: string): boolean {
  let current = entries.get(overlayId);
  const visited = new Set<string>([overlayId]);

  while (current?.parentId) {
    if (current.parentId === candidateAncestorId) {
      return true;
    }
    if (visited.has(current.parentId)) {
      break;
    }
    visited.add(current.parentId);
    current = entries.get(current.parentId);
  }

  return false;
}

export function registerOverlay(
  id: string,
  close: CloseCallback,
  parentId?: string,
): () => void {
  entries.set(id, { id, parentId, close });
  return () => {
    const existing = entries.get(id);
    if (existing && existing.close === close) {
      entries.delete(id);
    }
  };
}

export function activateOverlay(id: string): void {
  const snapshot = Array.from(entries.values());
  for (const entry of snapshot) {
    if (entry.id === id) continue;
    if (isAncestorOf(entry.id, id)) continue;
    entry.close();
  }
}

export function dismissAllOverlays(): void {
  const snapshot = Array.from(entries.values());
  for (const entry of snapshot) {
    entry.close();
  }
}

const OverlayParentContext = createContext<string | undefined>(undefined);

export function OverlayParentProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return React.createElement(
    OverlayParentContext.Provider,
    { value: id },
    children,
  );
}

export function useOverlayParentId(): string | undefined {
  return useContext(OverlayParentContext);
}

export interface ExclusiveOverlayOptions {
  parentId?: string;
}

export function useExclusiveOverlay(
  id: string,
  isOpen: boolean,
  onClose: CloseCallback,
  options?: ExclusiveOverlayOptions,
): void {
  const contextParentId = useOverlayParentId();
  const parentId = options?.parentId ?? contextParentId;
  const closeRef = useRef<CloseCallback>(onClose);
  closeRef.current = onClose;

  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    return registerOverlay(
      id,
      () => {
        if (isOpenRef.current) {
          closeRef.current();
        }
      },
      parentId,
    );
  }, [id, parentId]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      activateOverlay(id);
    }
    wasOpenRef.current = isOpen;
  }, [id, isOpen]);
}
