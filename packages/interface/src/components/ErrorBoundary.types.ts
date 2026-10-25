export interface ErrorFallbackProps {
  errorName: string;
  errorText: string;
  detailsOpen: boolean;
  copied: boolean;
  onToggleDetails: () => void;
  onCopy: () => void;
  onRetry: () => void;
  onReload: () => void;
}
