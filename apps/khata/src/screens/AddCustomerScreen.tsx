import { useState } from 'react';
import type { FormEvent } from 'react';
import { ScreenHeader, normalizePhone, useTranslation, validatePakistaniPhone } from '@skeleton/core';
import { fieldError, input, label, primaryButton } from '../components/styles';
import type { KhataCollections } from '../khata.types';
import type { ScreenProps } from './types';

type Errors = { name?: string; phone?: string };

/**
 * New-customer form (name required, phone optional and validated, note optional).
 * With `customerId` it edits instead: the changed fields are saved as an
 * append-only customerUpdated record. Nothing is ever overwritten.
 */
export function AddCustomerScreen({
  derived,
  store,
  navigate,
  onChanged,
  customerId,
}: ScreenProps & { customerId?: string }) {
  const { t } = useTranslation();
  const existing = customerId ? derived.customers.find((c) => c.id === customerId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const goBack = () =>
    existing ? navigate({ name: 'customerDetail', customerId: existing.id }) : navigate({ name: 'customerList' });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanNote = note.trim();

    const next: Errors = {};
    if (cleanName === '') next.name = 'khata.addCustomer.nameRequired';
    if (cleanPhone !== '' && !validatePakistaniPhone(cleanPhone)) next.phone = 'khata.addCustomer.phoneInvalid';
    setErrors(next);
    if (next.name || next.phone) return;

    setSaving(true);
    setFailed(false);
    try {
      const normalizedPhone = cleanPhone === '' ? '' : normalizePhone(cleanPhone);

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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        title={t(existing ? 'khata.addCustomer.editTitle' : 'khata.addCustomer.title')}
        onBack={goBack}
        backLabel={t('khata.common.back')}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="customer-name" className={label}>
            {t('khata.addCustomer.nameLabel')}
          </label>
          <input
            id="customer-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'customer-name-error' : undefined}
            className={input}
          />
          {errors.name && (
            <p id="customer-name-error" role="alert" className={fieldError}>
              {t(errors.name)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="customer-phone" className={label}>
            {t('khata.addCustomer.phoneLabel')}
          </label>
          <input
            id="customer-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('khata.addCustomer.phonePlaceholder')}
            autoComplete="off"
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? 'customer-phone-error' : undefined}
            className={input}
          />
          {errors.phone && (
            <p id="customer-phone-error" role="alert" className={fieldError}>
              {t(errors.phone)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="customer-note" className={label}>
            {t('khata.addCustomer.noteLabel')}
          </label>
          <textarea
            id="customer-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={input}
          />
        </div>

        {failed && (
          <p role="alert" className={fieldError}>
            {t('khata.common.errorGeneric')}
          </p>
        )}

        <button type="submit" disabled={saving} className={primaryButton}>
          {t('khata.addCustomer.saveButton')}
        </button>
      </form>
    </div>
  );
}
