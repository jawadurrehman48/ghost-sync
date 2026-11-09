import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Notice,
  TextAreaField,
  TextField,
  isValidISODate,
  paisaFromRupees,
  parseWholeRupees,
  todayISO,
  useSubmitGuard,
  useTranslation,
} from '@skeleton/core';
import type { Store } from '@skeleton/core';
import { LIMITS } from '../khata.limits';
import type { KhataCollections } from '../khata.types';
import { Money } from './Money';

type Errors = { amount?: string; date?: string; note?: string };

export interface EntryFormProps {
  type: 'credit' | 'payment';
  customerId: string;
  store: Store<KhataCollections>;
  /** Called after the entry was saved (refresh data, then navigate). */
  onSaved: () => Promise<void>;
}

/**
 * The form shared by "Credit Given", "Payment Received" and quick entry:
 * a big numeric amount (whole rupees, converted to paisa), an optional note
 * and a date that defaults to today. A double tap on Save records only one entry.
 */
export function EntryForm({ type, customerId, store, onSaved }: EntryFormProps) {
  const { t } = useTranslation();
  const isCredit = type === 'credit';
  const guard = useSubmitGuard();

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);

  const rupees = parseWholeRupees(amountText, LIMITS.amountDigits);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanNote = note.trim();

    const next: Errors = {};
    if (amountText.trim() === '') next.amount = 'khata.addEntry.amountRequired';
    else if (rupees === null) next.amount = 'khata.addEntry.amountInvalid';
    if (!isValidISODate(date)) next.date = 'khata.addEntry.dateRequired';
    if (cleanNote.length > LIMITS.note) next.note = 'khata.addEntry.noteTooLong';
    setErrors(next);
    if (next.amount || next.date || next.note || rupees === null) return;

    setFailed(false);
    await guard.run(async () => {
      try {
        const payload = {
          customerId,
          amountPaisa: paisaFromRupees(rupees),
          date,
          ...(cleanNote !== '' ? { note: cleanNote } : {}),
        };
        if (isCredit) await store.add('creditGiven', payload);
        else await store.add('paymentReceived', payload);
        await onSaved();
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <TextField
          label={t('khata.addEntry.amountLabel')}
          size="lg"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          // The amount is the one thing to type, so the keyboard opens straight away.
          autoFocus
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={errors.amount ? t(errors.amount) : undefined}
        />
        {rupees !== null && (
          <p className="mt-1">
            <Money paisa={paisaFromRupees(rupees)} tone={isCredit ? 'owed' : 'received'} size="md" />
          </p>
        )}
      </div>

      <TextAreaField
        label={t('khata.addEntry.noteLabel')}
        rows={2}
        maxLength={LIMITS.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        error={errors.note ? t(errors.note, { max: LIMITS.note }) : undefined}
      />

      <TextField
        label={t('khata.addEntry.dateLabel')}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        error={errors.date ? t(errors.date) : undefined}
      />

      {failed && <Notice tone="error">{t('khata.common.errorGeneric')}</Notice>}

      <Button type="submit" variant={isCredit ? 'danger' : 'success'} loading={guard.busy}>
        {t('khata.addEntry.saveButton')}
      </Button>
    </form>
  );
}
