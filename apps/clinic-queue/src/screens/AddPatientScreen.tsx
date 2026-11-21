import { ScreenHeader, useTranslation } from '@skeleton/core';
import { PatientForm } from '../components/PatientForm';
import type { ScreenProps } from './types';

/** Register a patient without issuing a token, then open their page. */
export function AddPatientScreen({ derived, store, navigate, onChanged }: ScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <ScreenHeader
        title={t('clinic.patientForm.title')}
        onBack={() => navigate({ name: 'patients' })}
        backLabel={t('clinic.common.back')}
      />
      <PatientForm
        patients={derived.patients}
        submitLabel={t('clinic.patientForm.save')}
        onSubmit={async (payload) => {
          const created = await store.add('patientRegistered', payload);
          await onChanged();
          navigate({ name: 'patientDetail', patientId: created.id });
        }}
      />
    </div>
  );
}
