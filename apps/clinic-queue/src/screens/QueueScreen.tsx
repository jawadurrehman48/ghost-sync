import {
  Button,
  Card,
  EmptyState,
  Notice,
  ScreenHeader,
  StatCard,
  minutesBetween,
  useNow,
  useSubmitGuard,
  useTranslation,
} from '@skeleton/core';
import { useState } from 'react';
import { callNext, requeueToken, skipToken } from '../clinic.actions';
import { NotifyButtons } from '../components/NotifyButtons';
import { ScreenIcon, TicketIcon } from '../components/NavIcons';
import { TokenLabel } from '../components/TokenLabel';
import { displayClinicName, formatWait } from '../components/format';
import type { ScreenProps } from './types';

/**
 * Today's queue: counts, who is being seen, who is next, the big Call Next
 * button, the waiting list (live waiting times) and skipped patients.
 */
export function QueueScreen({ derived, store, navigate, onChanged, language, openDisplay }: ScreenProps) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const guard = useSubmitGuard();
  const [failed, setFailed] = useState(false);

  const { queue, patientsById, settings } = derived;
  const clinicName = displayClinicName(settings, t);
  const nameOf = (patientId: string) => patientsById.get(patientId)?.name ?? t('clinic.common.unknownPatient');
  const current = queue.serving[0];
  const next = queue.waiting[0];
  const nothingToday = queue.waiting.length + queue.serving.length + queue.completed.length + queue.skipped.length === 0;

  async function act(action: () => Promise<unknown>) {
    setFailed(false);
    await guard.run(async () => {
      try {
        await action();
        await onChanged();
      } catch {
        setFailed(true);
      }
    });
  }

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <ScreenHeader title={clinicName} />
      </div>
      <Button size="sm" variant="neutral" icon={<ScreenIcon />} onClick={openDisplay}>
        {t('clinic.queue.openDisplay')}
      </Button>
    </div>
  );

  if (nothingToday) {
    return (
      <div className="space-y-4">
        {header}
        <EmptyState
          icon={<TicketIcon />}
          title={t('clinic.queue.emptyTitle')}
          description={t('clinic.queue.emptyText')}
          actionLabel={t('clinic.queue.issueToken')}
          onAction={() => navigate({ name: 'issueToken', from: 'queue' })}
        />
        {derived.patients.length === 0 && (
          <Button variant="neutral" onClick={() => navigate({ name: 'settings' })}>
            {t('clinic.queue.tryDemo')}
          </Button>
        )}
      </div>
    );
  }

  const bigLabel = current
    ? next
      ? t('clinic.queue.completeAndCallNext')
      : t('clinic.queue.completeCurrent')
    : next
      ? t('clinic.queue.callNext')
      : t('clinic.queue.noOneWaiting');

  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-3 gap-2">
        <StatCard label={t('clinic.queue.waiting')} value={queue.waiting.length} tone="warning" />
        <StatCard label={t('clinic.queue.serving')} value={queue.serving.length} tone="brand" />
        <StatCard label={t('clinic.queue.completed')} value={queue.completed.length} tone="success" />
      </div>

      <Card aria-labelledby="now-serving-heading" className={current ? 'border-brand-200 bg-brand-50' : ''}>
        <h3 id="now-serving-heading" className="text-sm font-medium text-gray-700">
          {t('clinic.queue.nowServing')}
        </h3>
        {current ? (
          <>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <TokenLabel label={current.label} size="xl" className="text-brand-700" />
              <span className="min-w-0 break-words text-lg font-semibold text-gray-900">{nameOf(current.patientId)}</span>
            </div>
            {current.reason ? <p className="mt-1 break-words text-sm text-gray-700">{current.reason}</p> : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="neutral" fullWidth onClick={() => navigate({ name: 'token', tokenId: current.id })}>
                {t('clinic.queue.notesAndComplete')}
              </Button>
              <Button
                size="sm"
                variant="dangerOutline"
                fullWidth
                disabled={guard.busy}
                onClick={() => void act(() => skipToken(store, current.id))}
              >
                {t('clinic.queue.skip')}
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-base text-gray-600">{t('clinic.queue.nobodyServing')}</p>
        )}
      </Card>

      <Button
        className="min-h-[64px] text-lg"
        disabled={!current && !next}
        loading={guard.busy}
        onClick={() => void act(() => callNext(store))}
      >
        {bigLabel}
      </Button>

      {failed && <Notice tone="error">{t('clinic.common.errorGeneric')}</Notice>}

      {next && (
        <Card aria-labelledby="up-next-heading">
          <h3 id="up-next-heading" className="text-sm font-medium text-gray-700">
            {t('clinic.queue.upNext')}
          </h3>
          <div className="mt-1 mb-3 flex flex-wrap items-baseline gap-x-3">
            <TokenLabel label={next.label} size="lg" className="text-gray-900" />
            <span className="min-w-0 break-words text-base font-semibold text-gray-900">{nameOf(next.patientId)}</span>
          </div>
          <NotifyButtons
            size="sm"
            phone={patientsById.get(next.patientId)?.phone}
            patientName={nameOf(next.patientId)}
            token={next.label}
            clinicName={clinicName}
            language={language}
          />
        </Card>
      )}

      {queue.waiting.length > 0 && (
        <section aria-labelledby="waiting-heading">
          <h3 id="waiting-heading" className="mb-2 text-base font-semibold text-gray-800">
            {t('clinic.queue.waitingList')}
          </h3>
          <ol className="space-y-2">
            {queue.waiting.map((token, index) => (
              <li key={token.id}>
                <Card onClick={() => navigate({ name: 'token', tokenId: token.id })}>
                  <span className="flex items-center gap-3">
                    <span dir="ltr" className="w-8 shrink-0 text-center font-sans text-sm font-semibold text-gray-500">
                      {t('clinic.queue.position', { position: index + 1 })}
                    </span>
                    <TokenLabel label={token.label} size="md" className="shrink-0 text-gray-900" />
                    <span className="min-w-0 flex-1 break-words text-base text-gray-900">{nameOf(token.patientId)}</span>
                    <span className="shrink-0 text-sm text-amber-800">
                      {formatWait(minutesBetween(token.queuedAt, now.toISOString()), t)}
                    </span>
                  </span>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      {queue.skipped.length > 0 && (
        <section aria-labelledby="skipped-heading">
          <h3 id="skipped-heading" className="mb-2 text-base font-semibold text-gray-800">
            {t('clinic.queue.skippedList')}
          </h3>
          <ul className="space-y-2">
            {queue.skipped.map((token) => (
              <li key={token.id}>
                <Card tone="muted">
                  <div className="flex items-center gap-3">
                    <TokenLabel label={token.label} size="md" className="shrink-0 text-gray-700" />
                    <span className="min-w-0 flex-1 break-words text-base text-gray-800">{nameOf(token.patientId)}</span>
                    <Button
                      size="sm"
                      variant="neutral"
                      disabled={guard.busy}
                      onClick={() => void act(() => requeueToken(store, token.id))}
                    >
                      {t('clinic.queue.requeue')}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
