import { useMemo } from 'react';
import { Button, Card, EmptyState, Notice, ScreenHeader, formatDateDMY, formatPhone, useTranslation } from '@skeleton/core';
import { activeTokenFor, patientVisits } from '../clinic.reducers';
import { TicketIcon } from '../components/NavIcons';
import { StatusPill } from '../components/StatusPill';
import { TokenLabel } from '../components/TokenLabel';
import { patientFacts } from './PatientsScreen';
import type { ScreenProps } from './types';

/** A patient's details, an "Issue token" action and every past visit with the doctor's notes. */
export function PatientDetailScreen({ derived, navigate, patientId }: ScreenProps & { patientId: string }) {
  const { t } = useTranslation();
  const patient = derived.patientsById.get(patientId);
  const visits = useMemo(() => patientVisits(derived.tokens, patientId), [derived.tokens, patientId]);
  const goBack = () => navigate({ name: 'patients' });

  if (!patient) {
    return (
      <div>
        <ScreenHeader title={t('clinic.patients.title')} onBack={goBack} backLabel={t('clinic.common.back')} />
        <EmptyState title={t('clinic.patientDetail.notFound')} actionLabel={t('clinic.common.back')} onAction={goBack} />
      </div>
    );
  }

  const active = activeTokenFor(derived.tokens, patient.id, derived.today);
  const facts = patientFacts(patient, t);
  const issue = () => navigate({ name: 'issueToken', from: 'patientDetail', patientId: patient.id });

  return (
    <div className="space-y-4">
      <ScreenHeader title={patient.name} onBack={goBack} backLabel={t('clinic.common.back')} />

      <Card>
        {patient.phone ? (
          <p dir="ltr" className="text-start text-base text-gray-800">
            {formatPhone(patient.phone)}
          </p>
        ) : null}
        {facts ? <p className="text-base text-gray-700">{facts}</p> : null}
      </Card>

      {active ? (
        <div className="space-y-2">
          <Notice tone="info">{t('clinic.patientDetail.inQueue', { token: active.label })}</Notice>
          <Button variant="secondary" onClick={() => navigate({ name: 'token', tokenId: active.id })}>
            {t('clinic.patientDetail.openToken')}
          </Button>
        </div>
      ) : (
        <Button onClick={issue}>{t('clinic.patientDetail.issueToken')}</Button>
      )}

      <section aria-labelledby="visits-heading">
        <h3 id="visits-heading" className="mb-2 text-base font-semibold text-gray-800">
          {t('clinic.patientDetail.visits')}
        </h3>
        {visits.length === 0 ? (
          <EmptyState
            icon={<TicketIcon />}
            title={t('clinic.patientDetail.noVisits')}
            description={t('clinic.patientDetail.noVisitsHint')}
            actionLabel={t('clinic.patientDetail.issueToken')}
            onAction={issue}
          />
        ) : (
          <ul className="space-y-2">
            {visits.map((visit) => (
              <li key={visit.id}>
                <Card onClick={() => navigate({ name: 'token', tokenId: visit.id })}>
                  <span className="flex items-center justify-between gap-3">
                    <span dir="ltr" className="text-sm font-medium text-gray-700">
                      {formatDateDMY(visit.date)}
                    </span>
                    <span className="flex items-center gap-2">
                      <TokenLabel label={visit.label} size="sm" className="text-gray-900" />
                      <StatusPill status={visit.status} />
                    </span>
                  </span>
                  {visit.reason ? (
                    <span className="mt-1 block break-words text-sm font-medium text-gray-800">{visit.reason}</span>
                  ) : null}
                  {visit.notes ? (
                    <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-gray-700">{visit.notes}</span>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
