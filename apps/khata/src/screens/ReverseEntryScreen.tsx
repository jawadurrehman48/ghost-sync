import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ScreenHeader, formatDateDMY, useTranslation } from '@skeleton/core';
import { Money } from '../components/Money';
import { card, creditButton, fieldError, input, label, mutedText } from '../components/styles';
import { deriveBalance } from '../khata.reducers';
import type { ScreenProps } from './types';

/**
 * Fix a mistake without editing or deleting anything: appends an
 * entryReversed record. The original entry stays in the history, marked
 * reversed, and stops counting towards the balance. A reversed entry cannot
 * be reversed again.
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
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [saving, setSaving] = useState(false);
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
      setReasonError(true);
      return;
    }
    setReasonError(false);
    setSaving(true);
    setFailed(false);
    try {
      await store.add('entryReversed', { entryId, reason: cleanReason });
      await onChanged();
      goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const header = <ScreenHeader title={t('khata.reverseEntry.title')} onBack={goBack} backLabel={t('khata.common.back')} />;

  if (!entry) {
    return (
      <div>
        {header}
        <p className={`${card} ${mutedText}`}>{t('khata.reverseEntry.notFound')}</p>
      </div>
    );
  }

  if (entry.reversed) {
    return (
      <div>
        {header}
        <p className={`${card} ${mutedText}`}>{t('khata.reverseEntry.alreadyReversed')}</p>
      </div>
    );
  }

  const isCredit = entry.type === 'credit';

  return (
    <div>
      {header}

      <section className={`${card} mb-4`} aria-labelledby="reversing-heading">
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
              <dd className="text-end text-gray-900">{entry.note}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="reverse-reason" className={label}>
            {t('khata.reverseEntry.reasonLabel')}
          </label>
          <textarea
            id="reverse-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? 'reverse-reason-error' : undefined}
            className={input}
          />
          {reasonError && (
            <p id="reverse-reason-error" role="alert" className={fieldError}>
              {t('khata.reverseEntry.reasonRequired')}
            </p>
          )}
        </div>

        {failed && (
          <p role="alert" className={fieldError}>
            {t('khata.common.errorGeneric')}
          </p>
        )}

        <button type="submit" disabled={saving} className={creditButton}>
          {t('khata.reverseEntry.confirmButton')}
        </button>
      </form>
    </div>
  );
}
