import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { copyTextToClipboardSafe } from '../utils/clipboard';
import type { ErrorFallbackProps } from './ErrorBoundary.types';
import { ErrorBoundaryClassic } from './ErrorBoundaryClassic';
import { ErrorBoundaryNoir } from './noir/ErrorBoundaryNoir';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

export const ErrorBoundaryFallback = createFamilyComponent<ErrorFallbackProps>(
  ErrorBoundaryClassic,
  ErrorBoundaryNoir,
);

const COPY_FEEDBACK_MS = 1600;

interface PanelErrorFallbackProps {
  error: Error;
  componentStack: string;
  onReset: () => void;
}

/** Owns the recovery state (details, clipboard echo) both skins present. */
const PanelErrorFallback = ({
  error,
  componentStack,
  onReset,
}: PanelErrorFallbackProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const head = `${error.name}: ${error.message}`;
  const errorText = componentStack ? `${head}\n${componentStack.trim()}` : head;

  const handleCopy = useCallback(() => {
    void copyTextToClipboardSafe(errorText);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }, [errorText]);

  const handleToggleDetails = useCallback(
    () => setDetailsOpen((open) => !open),
    [],
  );

  const handleReload = useCallback(() => window.location.reload(), []);

  return (
    <ErrorBoundaryFallback
      errorName={error.name}
      errorText={errorText}
      detailsOpen={detailsOpen}
      copied={copied}
      onToggleDetails={handleToggleDetails}
      onCopy={handleCopy}
      onRetry={onReset}
      onReload={handleReload}
    />
  );
};

/** Class error boundary — function components cannot catch render errors. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, componentStack: '' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[koma] ErrorBoundary caught:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? '' });
    this.props.onError?.(error, info);
  }

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <PanelErrorFallback
        error={error}
        componentStack={componentStack}
        onReset={() => this.setState({ error: null, componentStack: '' })}
      />
    );
  }
}
