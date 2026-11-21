import { useTranslation } from '@skeleton/core';
import type { TokenStatus } from '../clinic.types';

const TONE: Record<TokenStatus, string> = {
  waiting: 'bg-amber-100 text-amber-900',
  serving: 'bg-brand-100 text-brand-800',
  completed: 'bg-green-100 text-green-800',
  skipped: 'bg-gray-200 text-gray-800',
};

/** A small coloured label with the translated token status (text, so colour is not the only signal). */
export function StatusPill({ status }: { status: TokenStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>
      {t(`clinic.token.status.${status}`)}
    </span>
  );
}
