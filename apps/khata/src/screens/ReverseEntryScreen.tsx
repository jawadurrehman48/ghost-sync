import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  ScreenHeader,
  TextAreaField,
  formatDateDMY,
  useSubmitGuard,
  useTranslation,
} from '@skeleton/core';
import { Money } from '../components/Money';
import { LIMITS } from '../khata.limits';
import { deriveBalance } from '../khata.reducers';
import type { ScreenProps } from './types';

/**
 * Fix a mistake without editing or deleting anything: appends an
 * entryReversed record. The original entry stays in the history, marked
 * reversed, and stops counting towards the balance. A reversed entry cannot
 * be reversed again, and a double tap on Confirm records only one reversal.
 */
export function ReverseEntryScreen({
  data,
  store,
  navigate,
  onChanged,
  entryId,
  customerId,
}: ScreenProps & { entryId: string; customerId: string }) {
  const { t } = useTranslation();
  const guard = useSubmitGuard();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const entry = useMemo(
    () =>
      deriveBalance(data.creditGiven, data.paymentReceived, data.entryReversed, customerId).entries.find(
        (e) => e.id === entryId,
      ),
    [data.creditGiven, data.paymentReceived, data.entryReversed, customerId, entryId],
  );

  const goBack = () => navigate({ name: 'customerDetail', customerId });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanReason = reason.trim();
    if (cleanReason === '') {
      setReasonError('khata.reverseEntry.reasonRequired');
      return;
    }
    if (cleanReason.length > LIMITS.reason) {
      setReasonError('khata.reverseEntry.reasonTooLong');
      return;
    }
    setReasonError(null);
    setFailed(false);
    await guard.run(async () => {
      try {
        await store.add('entryReversed', { entryId, reason: cleanReason });
        await onChanged();
        goBack();
      } catch {
        setFailed(true);
      }
    });
  }

  const header = (
    <ScreenHeader title={t('khata.reverseEntry.title')} onBack={goBack} backLabel={t('khata.common.back')} />
  );

  if (!entry || entry.reversed) {
    return (
      <div>
        {header}
        <EmptyState
          title={t(entry ? 'khata.reverseEntry.alreadyReversed' : 'khata.reverseEntry.notFound')}
          actionLabel={t('khata.common.back')}
          onAction={goBack}
        />
      </div>
    );
  }

  const isCredit = entry.type === 'credit';

  return (
    <div>
      {header}

      <Card className="mb-4" aria-labelledby="reversing-heading">
        <p id="reversing-heading" className="mb-3 text-sm font-medium text-gray-700">
          {t('khata.reverseEntry.originalEntry')}
        </p>
        <dl className="space-y-2 text-base">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-600">{t('khata.reverseEntry.typeLabel')}</dt>
            <dd className={`font-semibold ${isCredit ? 'text-red-700' : 'text-green-700'}`}>
              {t(isCredit ? 'khata.common.credit' : 'khata.common.payment')}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-600">{t('khata.common.amount')}</dt>
            <dd>
              <Money paisa={entry.amountPaisa} tone={isCredit ? 'owed' : 'received'} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-600">{t('khata.common.date')}</dt>
            <dd dir="ltr" className="font-medium text-gray-900">
              {formatDateDMY(entry.date)}
            </dd>
          </div>
          {entry.note ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-gray-600">{t('khata.common.note')}</dt>
              <dd className="min-w-0 break-words text-end text-gray-900">{entry.note}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextAreaField
          label={t('khata.reverseEntry.reasonLabel')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={LIMITS.reason}
          error={reasonError ? t(reasonError, { max: LIMITS.reason }) : undefined}
        />

        {failed && <Notice tone="error">{t('khata.common.errorGeneric')}</Notice>}

        <Button type="submit" variant="danger" loading={guard.busy}>
          {t('khata.reverseEntry.confirmButton')}
        </Button>
      </form>
    </div>
  );
}
