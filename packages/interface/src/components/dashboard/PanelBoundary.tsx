import type { ReactNode } from 'react';

import { ErrorBoundary } from '../ErrorBoundary';

interface PanelBoundaryProps {
  children: ReactNode;
  label: string;
  resetKey?: string;
}

export const PanelBoundary = ({ children, label, resetKey }: PanelBoundaryProps) => (
  <ErrorBoundary key={resetKey ?? label} compact label={label}>
    {children}
  </ErrorBoundary>
);
