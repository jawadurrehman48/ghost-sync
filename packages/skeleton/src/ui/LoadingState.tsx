import { useTranslation } from 'react-i18next';
import { Spinner } from './Spinner';

export interface LoadingStateProps {
  /** Defaults to the translated "Loading…". */
  label?: string;
}

/** A centred spinner with a message, announced to screen readers. */
export function LoadingState({ label }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-gray-600">
      <Spinner className="h-8 w-8 text-brand-600" />
      <span className="text-base">{label ?? t('loading')}</span>
    </div>
  );
}
