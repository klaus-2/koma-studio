import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Class error boundary — function components cannot catch render errors. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[koma] ErrorBoundary caught:', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div role="alert" className="koma-error-boundary">
            <p>Something went wrong in this panel.</p>
            <button type="button" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
