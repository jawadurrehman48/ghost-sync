import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  ChoiceGroup,
  Notice,
  TextField,
  collapseSpaces,
  nameKey,
  normalizePhone,
  toAsciiDigits,
  useSubmitGuard,
  useTranslation,
  validatePakistaniPhone,
} from '@skeleton/core';
import { LIMITS } from '../clinic.limits';
import { GENDERS } from '../clinic.types';
import type { ClinicCollections, Gender, Patient } from '../clinic.types';

type Errors = { name?: string; phone?: string; age?: string };

export interface PatientFormProps {
  patients: Patient[];
  submitLabel: string;
  /** Save the patient (and maybe issue a token). Throwing shows an error. */
  onSubmit: (payload: ClinicCollections['patientRegistered']) => Promise<void>;
  /** Name typed in a search box, to save retyping it. */
  initialName?: string;
}

/**
 * Register a patient: name required; phone, age and gender optional.
 * The same name AND phone twice is refused; a double tap saves once.
 */
export function PatientForm({ patients, submitLabel, onSubmit, initialName = '' }: PatientFormProps) {
  const { t } = useTranslation();
  const guard = useSubmitGuard();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanName = collapseSpaces(name);
    const cleanPhone = phone.trim();
    const normalizedPhone = cleanPhone === '' ? '' : normalizePhone(cleanPhone);
    const ageText = toAsciiDigits(age.trim());
    const ageNumber = ageText === '' ? undefined : /^\d{1,3}$/.test(ageText) ? Number(ageText) : NaN;

    const next: Errors = {};
    if (cleanName === '') next.name = 'clinic.patientForm.nameRequired';
    else if (cleanName.length > LIMITS.name) next.name = 'clinic.patientForm.nameTooLong';
    else if (
      normalizedPhone !== '' &&
      patients.some((p) => nameKey(p.name) === nameKey(cleanName) && normalizePhone(p.phone ?? '') === normalizedPhone)
    ) {
      next.name = 'clinic.patientForm.duplicate';
    }
    if (cleanPhone !== '' && !validatePakistaniPhone(cleanPhone)) next.phone = 'clinic.patientForm.phoneInvalid';
    if (ageNumber !== undefined && !(Number.isInteger(ageNumber) && ageNumber >= 0 && ageNumber <= LIMITS.maxAge)) {
      next.age = 'clinic.patientForm.ageInvalid';
    }
    setErrors(next);
    if (next.name || next.phone || next.age) return;

    setFailed(false);
    await guard.run(async () => {
      try {
        await onSubmit({
          name: cleanName,
          ...(normalizedPhone ? { phone: normalizedPhone } : {}),
          ...(ageNumber !== undefined ? { age: ageNumber } : {}),
          ...(gender ? { gender } : {}),
        });
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label={t('clinic.patientForm.nameLabel')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={LIMITS.name}
        autoComplete="off"
        error={errors.name ? t(errors.name, { max: LIMITS.name }) : undefined}
      />
      <TextField
        label={t('clinic.patientForm.phoneLabel')}
        type="tel"
        inputMode="tel"
        dir="ltr"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={LIMITS.phone}
        placeholder={t('clinic.patientForm.phonePlaceholder')}
        autoComplete="off"
        error={errors.phone ? t(errors.phone) : undefined}
      />
      <TextField
        label={t('clinic.patientForm.ageLabel')}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={age}
        onChange={(e) => setAge(e.target.value)}
        maxLength={3}
        autoComplete="off"
        error={errors.age ? t(errors.age, { max: LIMITS.maxAge }) : undefined}
      />
      <ChoiceGroup
        label={t('clinic.patientForm.genderLabel')}
        options={GENDERS.map((g) => ({ value: g, label: t(`clinic.gender.${g}`) }))}
        value={gender}
        onChange={(value) => setGender(value === ('' as Gender) ? null : value)}
        allowDeselect
      />
      {failed && <Notice tone="error">{t('clinic.common.errorGeneric')}</Notice>}
      <Button type="submit" loading={guard.busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
