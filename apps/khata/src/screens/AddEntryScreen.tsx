import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ScreenHeader,
  isValidISODate,
  paisaFromRupees,
  parseWholeRupees,
  todayISO,
  useTranslation,
} from '@skeleton/core';
import { Money } from '../components/Money';
import { amountInput, creditButton, fieldError, input, label, mutedText, paymentButton } from '../components/styles';
import type { ScreenProps } from './types';

type Errors = { amount?: string; date?: string };

/**
 * Shared form for "Credit Given" and "Payment Received": big numeric amount
 * (whole rupees, converted to paisa), optional note, date defaulting to today.
 */
export function AddEntryScreen({
  derived,
  store,
  navigate,
  onChanged,
  customerId,
  type,
}: ScreenProps & { customerId: string; type: 'credit' | 'payment' }) {
  const { t } = useTranslation();
  const customer = derived.customers.find((c) => c.id === customerId);
  const isCredit = type === 'credit';

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const goBack = () => navigate({ name: 'customerDetail', customerId });
  const rupees = parseWholeRupees(amountText);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (amountText.trim() === '') next.amount = 'khata.addEntry.amountRequired';
    else if (rupees === null) next.amount = 'khata.addEntry.amountInvalid';
    if (!isValidISODate(date)) next.date = 'khata.addEntry.dateRequired';
    setErrors(next);
    if (next.amount || next.date || rupees === null) return;

    setSaving(true);
    setFailed(false);
    try {
      const cleanNote = note.trim();
      const payload = {
        customerId,
        amountPaisa: paisaFromRupees(rupees),
        date,
        ...(cleanNote !== '' ? { note: cleanNote } : {}),
      };
      if (isCredit) await store.add('creditGiven', payload);
      else await store.add('paymentReceived', payload);

      await onChanged();
      goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        title={t(isCredit ? 'khata.addEntry.creditTitle' : 'khata.addEntry.paymentTitle')}
        onBack={goBack}
        backLabel={t('khata.common.back')}
      />

      {customer && (
        <p className={`mb-4 ${mutedText}`}>
          {t('khata.addEntry.customerLabel')}: <span className="font-semibold text-gray-900">{customer.name}</span>
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="entry-amount" className={label}>
            {t('khata.addEntry.amountLabel')}
          </label>
          <input
            id="entry-amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the amount is the one thing to type
            autoFocus
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? 'entry-amount-error' : undefined}
            className={amountInput}
          />
          {rupees !== null && (
            <p className="mt-1">
              <Money paisa={paisaFromRupees(rupees)} tone={isCredit ? 'owed' : 'received'} className="text-base" />
            </p>
          )}
          {errors.amount && (
            <p id="entry-amount-error" role="alert" className={fieldError}>
              {t(errors.amount)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="entry-note" className={label}>
            {t('khata.addEntry.noteLabel')}
          </label>
          <textarea
            id="entry-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label htmlFor="entry-date" className={label}>
            {t('khata.addEntry.dateLabel')}
          </label>
          <input
            id="entry-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={errors.date ? 'entry-date-error' : undefined}
            className={input}
          />
          {errors.date && (
            <p id="entry-date-error" role="alert" className={fieldError}>
              {t(errors.date)}
            </p>
          )}
        </div>

        {failed && (
          <p role="alert" className={fieldError}>
            {t('khata.common.errorGeneric')}
          </p>
        )}

        <button type="submit" disabled={saving} className={isCredit ? creditButton : paymentButton}>
          {t('khata.addEntry.saveButton')}
        </button>
      </form>
    </div>
  );
}
