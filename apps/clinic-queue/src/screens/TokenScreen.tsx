import { useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  ScreenHeader,
  TextAreaField,
  formatDateDMY,
  formatPhone,
  formatTime,
  minutesBetween,
  useNow,
  useSubmitGuard,
  useTranslation,
} from '@skeleton/core';
import { callToken, completeToken, requeueToken, skipToken } from '../clinic.actions';
import { LIMITS } from '../clinic.limits';
import { NotifyButtons } from '../components/NotifyButtons';
import { StatusPill } from '../components/StatusPill';
import { TokenLabel } from '../components/TokenLabel';
import { displayClinicName, formatWait } from '../components/format';
import type { ScreenProps } from './types';

/**
 * One token: patient, times, notes, and the doctor's actions for its state.
 *   waiting   → Call this patient, Skip, Notify
 *   serving   → Complete (with notes), Skip, Notify
 *   skipped   → Put back in queue, Notify
 *   completed → read-only
 */
export function TokenScreen({ derived, store, navigate, onChanged, language, tokenId }: ScreenProps & { tokenId: string }) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const guard = useSubmitGuard();
  const [notes, setNotes] = useState('');
  const [failed, setFailed] = useState(false);

  const token = derived.tokensById.get(tokenId);
  const goBack = () => navigate({ name: 'queue' });

  if (!token) {
    return (
      <div>
        <ScreenHeader title={t('clinic.queue.title')} onBack={goBack} backLabel={t('clinic.common.back')} />
        <EmptyState title={t('clinic.token.notFound')} actionLabel={t('clinic.common.back')} onAction={goBack} />
      </div>
    );
  }

  const patient = derived.patientsById.get(token.patientId);
  const patientName = patient?.name ?? t('clinic.common.unknownPatient');

  async function act(action: () => Promise<unknown>, thenBack = false) {
    setFailed(false);
    await guard.run(async () => {
      try {
        await action();
        await onChanged();
        if (thenBack) goBack();
      } catch {
        setFailed(true);
      }
    });
  }

  const times: Array<[string, string | undefined]> = [
    ['clinic.token.issuedAt', token.issuedAt],
    ['clinic.token.calledAt', token.firstCalledAt],
    ['clinic.token.completedAt', token.completedAt],
    ['clinic.token.skippedAt', token.status === 'skipped' ? token.skippedAt : undefined],
  ];

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('clinic.token.title', { token: token.label })} onBack={goBack} backLabel={t('clinic.common.back')} />

      <Card className="flex flex-col items-center gap-2 py-6 text-center">
        <TokenLabel label={token.label} size="hero" className="text-brand-700" />
        <StatusPill status={token.status} />
        {token.status === 'waiting' && (
          <p className="text-sm text-amber-800">
            {t('clinic.token.waitingFor', { time: formatWait(minutesBetween(token.queuedAt, now.toISOString()), t) })}
          </p>
        )}
      </Card>

      <Card>
        <dl className="space-y-2 text-base">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-gray-600">{t('clinic.token.patient')}</dt>
            <dd className="min-w-0 text-end">
              {patient ? (
                <button
                  type="button"
                  className="min-h-[44px] break-words font-semibold text-brand-700 underline-offset-2 hover:underline"
                  onClick={() => navigate({ name: 'patientDetail', patientId: patient.id })}
                >
                  {patient.name}
                </button>
              ) : (
                <span className="font-semibold text-gray-900">{patientName}</span>
              )}
              {patient?.phone ? (
                <span dir="ltr" className="block text-sm text-gray-600">
                  {formatPhone(patient.phone)}
                </span>
              ) : null}
            </dd>
          </div>
          {token.reason ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-gray-600">{t('clinic.token.reason')}</dt>
              <dd className="min-w-0 break-words text-end text-gray-900">{token.reason}</dd>
            </div>
          ) : null}
          {times.map(([key, value]) =>
            value ? (
              <div key={key} className="flex items-center justify-between gap-3">
                <dt className="text-gray-600">{t(key)}</dt>
                <dd dir="ltr" className="font-medium text-gray-900">
                  {formatTime(value)} · {formatDateDMY(token.date)}
                </dd>
              </div>
            ) : null,
          )}
          {token.notes ? (
            <div className="border-t border-gray-100 pt-2">
              <dt className="text-gray-600">{t('clinic.token.notes')}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">{token.notes}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {failed && <Notice tone="error">{t('clinic.common.errorGeneric')}</Notice>}

      {token.status === 'waiting' && (
        <div className="space-y-2">
          <Button loading={guard.busy} onClick={() => void act(() => callToken(store, token.id))}>
            {t('clinic.token.callNow')}
          </Button>
          <Button variant="dangerOutline" disabled={guard.busy} onClick={() => void act(() => skipToken(store, token.id), true)}>
            {t('clinic.token.skip')}
          </Button>
        </div>
      )}

      {token.status === 'serving' && (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act(() => completeToken(store, token.id, notes), true);
          }}
        >
          <TextAreaField
            label={t('clinic.token.notesLabel')}
            placeholder={t('clinic.token.notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={LIMITS.notes}
            rows={3}
          />
          <Button type="submit" variant="success" loading={guard.busy}>
            {t('clinic.token.complete')}
          </Button>
          <Button variant="dangerOutline" disabled={guard.busy} onClick={() => void act(() => skipToken(store, token.id), true)}>
            {t('clinic.token.skip')}
          </Button>
        </form>
      )}

      {token.status === 'skipped' && (
        <Button loading={guard.busy} onClick={() => void act(() => requeueToken(store, token.id))}>
          {t('clinic.token.requeue')}
        </Button>
      )}

      {token.status === 'completed' && <p className="text-center text-sm text-gray-600">{t('clinic.token.noActions')}</p>}

      {token.status !== 'completed' && (
        <NotifyButtons
          phone={patient?.phone}
          patientName={patientName}
          token={token.label}
          clinicName={displayClinicName(derived.settings, t)}
          language={language}
        />
      )}
    </div>
  );
}
