import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, ScreenHeader, TextField, formatDateDMY, formatPhone, useTranslation } from '@skeleton/core';
import { activeTokenFor, filterPatients, lastVisitDates } from '../clinic.reducers';
import type { Patient } from '../clinic.types';
import { PatientsIcon } from '../components/NavIcons';
import { TokenLabel } from '../components/TokenLabel';
import type { ScreenProps } from './types';

/** Age and gender in one short line, e.g. "45 yrs · Male". */
export function patientFacts(patient: Patient, t: (key: string, options?: Record<string, unknown>) => string): string {
  return [
    patient.age !== undefined ? t('clinic.patients.age', { age: patient.age }) : null,
    patient.gender ? t(`clinic.gender.${patient.gender}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Searchable patient list, most recent visitor first. */
export function PatientsScreen({ derived, navigate }: ScreenProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => filterPatients(derived.patients, derived.tokens, query), [derived.patients, derived.tokens, query]);
  const lastVisit = useMemo(() => lastVisitDates(derived.tokens), [derived.tokens]);
  const add = () => navigate({ name: 'addPatient' });

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('clinic.patients.title')} />

      {derived.patients.length === 0 ? (
        <EmptyState
          icon={<PatientsIcon />}
          title={t('clinic.patients.emptyTitle')}
          description={t('clinic.patients.emptyText')}
          actionLabel={t('clinic.patients.addButton')}
          onAction={add}
        />
      ) : (
        <>
          <Button onClick={add}>{t('clinic.patients.addButton')}</Button>
          <TextField
            label={t('clinic.patients.search')}
            hideLabel
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('clinic.patients.search')}
            autoComplete="off"
          />
          {rows.length === 0 ? (
            <EmptyState
              title={t('clinic.patients.noResults')}
              description={t('clinic.patients.noResultsHint')}
              actionLabel={t('clinic.patients.addButton')}
              onAction={add}
            />
          ) : (
            <ul className="space-y-2">
              {rows.map((p) => {
                const active = activeTokenFor(derived.tokens, p.id, derived.today);
                const visit = lastVisit.get(p.id);
                const facts = patientFacts(p, t);
                return (
                  <li key={p.id}>
                    <Card onClick={() => navigate({ name: 'patientDetail', patientId: p.id })}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-base font-medium text-gray-900">{p.name}</span>
                          {p.phone ? (
                            <span dir="ltr" className="block text-start text-sm text-gray-600">
                              {formatPhone(p.phone)}
                            </span>
                          ) : null}
                          {facts ? <span className="block text-sm text-gray-600">{facts}</span> : null}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 text-sm text-gray-600">
                          {active ? <TokenLabel label={active.label} size="sm" className="text-brand-700" /> : null}
                          <span>
                            {visit
                              ? t('clinic.patients.lastVisit', { date: formatDateDMY(visit) })
                              : t('clinic.patients.neverVisited')}
                          </span>
                        </span>
                      </span>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
