import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md space-y-4 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
      <h2 className="text-lg font-bold">{t('error.title')}</h2>
      <p className="text-base">{t('error.message')}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="neutral" onClick={() => window.location.reload()}>
          {t('error.reload')}
        </Button>
        <Button onClick={onRetry}>{t('error.retry')}</Button>
      </div>
    </div>
  );
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called once per crash, e.g. to log it. */
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches rendering crashes so a bug never leaves a blank white screen.
 * Shows a friendly message (the data is safe on the phone) with Try again / Reload.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unexpected UI error:', error, info.componentStack);
    this.props.onError?.(error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <ErrorFallback onRetry={() => this.setState({ failed: false })} />;
    }
    return this.props.children;
  }
}
