import { useMemo, useState } from 'react';
import { ScreenHeader, isValidISODate, monthRange, useTranslation } from '@skeleton/core';
import { Money } from '../components/Money';
import { card, fieldError, input, label } from '../components/styles';
import { deriveReport } from '../khata.reducers';
import type { ScreenProps } from './types';

/**
 * Credit given and payments received for a date range (default: this
 * calendar month). Reversed entries are excluded. Net = payments − credit.
 * Everything is computed from local records, with no network.
 */
export function ReportsScreen({ data }: ScreenProps) {
  const { t } = useTranslation();
  const initial = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const datesValid = isValidISODate(from) && isValidISODate(to);
  const rangeValid = datesValid && from <= to;

  const totals = useMemo(
    () =>
      rangeValid
        ? deriveReport(data.creditGiven, data.paymentReceived, data.entryReversed, from, to)
        : null,
    [data.creditGiven, data.paymentReceived, data.entryReversed, from, to, rangeValid],
  );

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('khata.reports.title')} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="report-from" className={label}>
            {t('khata.reports.fromLabel')}
          </label>
          <input
            id="report-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="report-to" className={label}>
            {t('khata.reports.toLabel')}
          </label>
          <input
            id="report-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={input}
          />
        </div>
      </div>

      {!rangeValid && (
        <p role="alert" className={fieldError}>
          {t('khata.reports.rangeInvalid')}
        </p>
      )}

      {totals && (
        <section className={card} aria-label={t('khata.reports.title')}>
          <dl className="space-y-3">
            <div className="flex min-h-[44px] items-center justify-between gap-3">
              <dt className="text-base text-gray-800">{t('khata.reports.creditGiven')}</dt>
              <dd>
                <Money paisa={totals.creditPaisa} tone="owed" className="text-lg" />
              </dd>
            </div>
            <div className="flex min-h-[44px] items-center justify-between gap-3">
              <dt className="text-base text-gray-800">{t('khata.reports.paymentsReceived')}</dt>
              <dd>
                <Money paisa={totals.paymentsPaisa} tone="received" className="text-lg" />
              </dd>
            </div>
            <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-gray-200 pt-3">
              <dt className="text-base font-semibold text-gray-900">{t('khata.reports.net')}</dt>
              <dd>
                <Money paisa={totals.netPaisa} tone={totals.netPaisa >= 0 ? 'received' : 'owed'} className="text-xl" />
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
