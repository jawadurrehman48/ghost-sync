import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Notice,
  ScreenHeader,
  TextAreaField,
  TextField,
  formatPhone,
  normalizePhone,
  useSubmitGuard,
  useTranslation,
  validatePakistaniPhone,
} from '@skeleton/core';
import { LIMITS, collapseSpaces, nameKey } from '../khata.limits';
import type { KhataCollections } from '../khata.types';
import type { ScreenProps } from './types';

type Errors = { name?: string; phone?: string; note?: string };

/**
 * New-customer form (name required, phone optional and validated, note optional).
 * With `customerId` it edits instead: the changed fields are saved as an
 * append-only customerUpdated record. Nothing is ever overwritten.
 *
 * Protection: limits on name/note length, no second customer with the same
 * name AND phone number, and a double tap on Save adds only one record.
 */
export function AddCustomerScreen({
  derived,
  store,
  navigate,
  onChanged,
  customerId,
}: ScreenProps & { customerId?: string }) {
  const { t } = useTranslation();
  const guard = useSubmitGuard();
  const existing = customerId ? derived.customers.find((c) => c.id === customerId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ? formatPhone(existing.phone) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);

  const goBack = () =>
    existing ? navigate({ name: 'customerDetail', customerId: existing.id }) : navigate({ name: 'customerList' });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanName = collapseSpaces(name);
    const cleanPhone = phone.trim();
    const cleanNote = note.trim();
    const normalizedPhone = cleanPhone === '' ? '' : normalizePhone(cleanPhone);

    const next: Errors = {};
    if (cleanName === '') next.name = 'khata.addCustomer.nameRequired';
    else if (cleanName.length > LIMITS.name) next.name = 'khata.addCustomer.nameTooLong';
    else if (
      normalizedPhone !== '' &&
      validatePakistaniPhone(normalizedPhone) &&
      derived.customers.some(
        (c) =>
          c.id !== existing?.id &&
          nameKey(c.name) === nameKey(cleanName) &&
          normalizePhone(c.phone ?? '') === normalizedPhone,
      )
    ) {
      next.name = 'khata.addCustomer.duplicate';
    }
    if (cleanPhone !== '' && !validatePakistaniPhone(cleanPhone)) next.phone = 'khata.addCustomer.phoneInvalid';
    if (cleanNote.length > LIMITS.note) next.note = 'khata.addCustomer.noteTooLong';
    setErrors(next);
    if (next.name || next.phone || next.note) return;

    setFailed(false);
    await guard.run(async () => {
      try {
        if (existing) {
          const changes: KhataCollections['customerUpdated'] = { customerId: existing.id };
          if (cleanName !== existing.name) changes.name = cleanName;
          if (normalizedPhone !== (existing.phone ?? '')) changes.phone = normalizedPhone;
          if (cleanNote !== (existing.note ?? '')) changes.note = cleanNote;
          if (Object.keys(changes).length > 1) await store.add('customerUpdated', changes);
        } else {
          const payload: KhataCollections['customerCreated'] = { name: cleanName };
          if (normalizedPhone !== '') payload.phone = normalizedPhone;
          if (cleanNote !== '') payload.note = cleanNote;
          await store.add('customerCreated', payload);
        }
        await onChanged();
        goBack();
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div>
      <ScreenHeader
        title={t(existing ? 'khata.addCustomer.editTitle' : 'khata.addCustomer.title')}
        onBack={goBack}
        backLabel={t('khata.common.back')}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label={t('khata.addCustomer.nameLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.name}
          autoComplete="off"
          error={errors.name ? t(errors.name, { max: LIMITS.name }) : undefined}
        />

        <TextField
          label={t('khata.addCustomer.phoneLabel')}
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={LIMITS.phone}
          placeholder={t('khata.addCustomer.phonePlaceholder')}
          autoComplete="off"
          error={errors.phone ? t(errors.phone) : undefined}
        />

        <TextAreaField
          label={t('khata.addCustomer.noteLabel')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={LIMITS.note}
          error={errors.note ? t(errors.note, { max: LIMITS.note }) : undefined}
        />

        {failed && <Notice tone="error">{t('khata.common.errorGeneric')}</Notice>}

        <Button type="submit" loading={guard.busy}>
          {t('khata.addCustomer.saveButton')}
        </Button>
      </form>
    </div>
  );
}
