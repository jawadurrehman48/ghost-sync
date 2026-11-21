import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  ScreenHeader,
  TextField,
  formatPhone,
  useSubmitGuard,
  useTranslation,
} from '@skeleton/core';
import { issueToken } from '../clinic.actions';
import type { IssueResult } from '../clinic.actions';
import { LIMITS } from '../clinic.limits';
import { activeTokenFor, filterPatients } from '../clinic.reducers';
import type { IssueOrigin } from '../clinic.types';
import { NotifyButtons } from '../components/NotifyButtons';
import { PatientsIcon } from '../components/NavIcons';
import { PatientForm } from '../components/PatientForm';
import { TokenLabel } from '../components/TokenLabel';
import { displayClinicName } from '../components/format';
import type { ScreenProps } from './types';

const MAX_ROWS = 50;

/**
 * The receptionist's flow behind the "+" button:
 * find (or quickly register) the patient, add an optional reason, issue the
 * token, and show the number very large.
 */
export function IssueTokenScreen({
  derived,
  store,
  navigate,
  onChanged,
  language,
  from,
  patientId: initialPatientId,
}: ScreenProps & { from: IssueOrigin; patientId?: string }) {
  const { t } = useTranslation();
  const guard = useSubmitGuard();
  const [query, setQuery] = useState('');
  const [registering, setRegistering] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(initialPatientId ?? null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<IssueResult | null>(null);
  const [failed, setFailed] = useState(false);

  const goBack = () =>
    from === 'patientDetail' && initialPatientId
      ? navigate({ name: 'patientDetail', patientId: initialPatientId })
      : navigate({ name: from === 'patients' ? 'patients' : 'queue' });

  const rows = useMemo(
    () => filterPatients(derived.patients, derived.tokens, query).slice(0, MAX_ROWS),
    [derived.patients, derived.tokens, query],
  );
  const patient = patientId ? derived.patientsById.get(patientId) : undefined;
  const existing = patient ? activeTokenFor(derived.tokens, patient.id, derived.today) : undefined;
  const clinicName = displayClinicName(derived.settings, t);

  async function issueFor(id: string, why: string) {
    setFailed(false);
    await guard.run(async () => {
      try {
        const outcome = await issueToken(store, derived.deviceId, id, why);
        await onChanged();
        setResult(outcome);
      } catch {
        setFailed(true);
      }
    });
  }

  function reset() {
    setResult(null);
    setPatientId(null);
    setReason('');
    setQuery('');
    setRegistering(false);
  }

  const header = <ScreenHeader title={t('clinic.issue.title')} onBack={goBack} backLabel={t('clinic.common.back')} />;
  const conflict = derived.letter.conflict ? (
    <Notice tone="error">{t('clinic.issue.letterConflict', { letter: derived.letter.letter })}</Notice>
  ) : null;

  // Step 3: the token that was just issued.
  if (result?.status === 'issued' && patient) {
    return (
      <div className="space-y-4">
        {header}
        <Card className="flex animate-pop-in flex-col items-center gap-2 py-8 text-center">
          <p className="text-base font-medium text-gray-700">{t('clinic.issue.issuedTitle')}</p>
          <TokenLabel label={result.label} size="hero" className="text-brand-700" />
          <p className="break-words text-lg font-semibold text-gray-900">{t('clinic.issue.tokenFor', { name: patient.name })}</p>
          <p className="text-base text-gray-700">
            {result.ahead === 0 ? t('clinic.issue.ahead_zero') : t('clinic.issue.ahead', { count: result.ahead })}
          </p>
        </Card>
        <NotifyButtons
          phone={patient.phone}
          patientName={patient.name}
          token={result.label}
          clinicName={clinicName}
          language={language}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" onClick={goBack}>
            {t('clinic.issue.done')}
          </Button>
          <Button onClick={reset}>{t('clinic.issue.another')}</Button>
        </div>
      </div>
    );
  }

  // Step 2: confirm the patient and add a reason.
  if (patient) {
    const handleIssue = (event: FormEvent) => {
      event.preventDefault();
      void issueFor(patient.id, reason);
    };
    const active = existing ?? (result?.status === 'alreadyActive' ? derived.tokensById.get(result.tokenId) : undefined);
    return (
      <div className="space-y-4">
        {header}
        {conflict}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-lg font-semibold text-gray-900">{patient.name}</p>
              {patient.phone ? (
                <p dir="ltr" className="text-start text-sm text-gray-600">
                  {formatPhone(patient.phone)}
                </p>
              ) : null}
            </div>
            {!initialPatientId && (
              <Button size="sm" variant="neutral" onClick={() => setPatientId(null)}>
                {t('clinic.issue.change')}
              </Button>
            )}
          </div>
        </Card>

        {active ? (
          <>
            <Notice tone="info">{t('clinic.issue.alreadyActive', { name: patient.name, token: active.label })}</Notice>
            <Button onClick={() => navigate({ name: 'token', tokenId: active.id })}>{t('clinic.issue.openToken')}</Button>
          </>
        ) : (
          <form onSubmit={handleIssue} noValidate className="space-y-4">
            <TextField
              label={t('clinic.issue.reasonLabel')}
              placeholder={t('clinic.issue.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={LIMITS.reason}
              autoComplete="off"
            />
            {failed && <Notice tone="error">{t('clinic.common.errorGeneric')}</Notice>}
            <Button type="submit" loading={guard.busy} className="min-h-[56px] text-lg">
              {t('clinic.issue.issueButton')}
            </Button>
          </form>
        )}
      </div>
    );
  }

  // Step 1b: quick registration.
  if (registering) {
    return (
      <div className="space-y-4">
        {header}
        <h3 className="text-base font-semibold text-gray-800">{t('clinic.issue.newPatient')}</h3>
        <PatientForm
          patients={derived.patients}
          initialName={/\d/.test(query) ? '' : query.trim()}
          submitLabel={t('clinic.patientForm.saveAndIssue')}
          onSubmit={async (payload) => {
            const created = await store.add('patientRegistered', payload);
            const outcome = await issueToken(store, derived.deviceId, created.id);
            await onChanged();
            setPatientId(created.id);
            setResult(outcome);
          }}
        />
        <Button variant="neutral" onClick={() => setRegistering(false)}>
          {t('clinic.common.cancel')}
        </Button>
      </div>
    );
  }

  // Step 1: find the patient.
  return (
    <div className="space-y-4">
      {header}
      {conflict}
      <Button variant="secondary" onClick={() => setRegistering(true)}>
        {t('clinic.issue.newPatient')}
      </Button>

      {derived.patients.length === 0 ? (
        <EmptyState
          icon={<PatientsIcon />}
          title={t('clinic.issue.noPatientsTitle')}
          description={t('clinic.issue.noPatientsText')}
          actionLabel={t('clinic.issue.newPatient')}
          onAction={() => setRegistering(true)}
        />
      ) : (
        <>
          <TextField
            label={t('clinic.issue.searchLabel')}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('clinic.issue.searchPlaceholder')}
            autoComplete="off"
            // Opening this screen means "find a patient", so typing can start at once.
            autoFocus
          />
          <h3 className="text-base font-semibold text-gray-800">{t('clinic.issue.choosePatient')}</h3>
          {rows.length === 0 ? (
            <EmptyState
              title={t('clinic.issue.noResults')}
              description={t('clinic.issue.noResultsHint')}
              actionLabel={t('clinic.issue.newPatient')}
              onAction={() => setRegistering(true)}
            />
          ) : (
            <ul className="space-y-2">
              {rows.map((p) => {
                const active = activeTokenFor(derived.tokens, p.id, derived.today);
                return (
                  <li key={p.id}>
                    <Card onClick={() => setPatientId(p.id)}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-base font-medium text-gray-900">{p.name}</span>
                          {p.phone ? (
                            <span dir="ltr" className="block text-start text-sm text-gray-600">
                              {formatPhone(p.phone)}
                            </span>
                          ) : null}
                        </span>
                        {active ? <TokenLabel label={active.label} size="sm" className="text-brand-700" /> : null}
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
