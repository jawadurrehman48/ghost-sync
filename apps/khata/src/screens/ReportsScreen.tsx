import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  GroupedBarChart,
  Notice,
  ScreenHeader,
  TextField,
  formatDateDMY,
  formatPaisa,
  isValidISODate,
  monthRange,
  useTranslation,
  weekRange,
} from '@skeleton/core';
import { Money } from '../components/Money';
import { ReportsIcon } from '../components/NavIcons';
import { deriveCustomerBreakdown, deriveDailyTotals, deriveReport } from '../khata.reducers';
import type { ScreenProps } from './types';

type RangeKey = 'today' | 'thisWeek' | 'thisMonth';

/**
 * Credit given and payments received for a date range (default: this calendar
 * month), with quick Today / This Week / This Month buttons, a bar chart per
 * day and a per-customer breakdown. Reversed entries are excluded. Net =
 * payments minus credit. Everything is computed from local records, with no network.
 */
export function ReportsScreen({ data, derived, navigate }: ScreenProps) {
  const { t } = useTranslation();

  const ranges = useMemo(() => {
    const anchor = new Date(`${derived.today}T12:00:00`);
    return {
      today: { from: derived.today, to: derived.today },
      thisWeek: weekRange(anchor),
      thisMonth: monthRange(anchor),
    } satisfies Record<RangeKey, { from: string; to: string }>;
  }, [derived.today]);

  const [from, setFrom] = useState(ranges.thisMonth.from);
  const [to, setTo] = useState(ranges.thisMonth.to);

  const rangeValid = isValidISODate(from) && isValidISODate(to) && from <= to;

  const report = useMemo(() => {
    if (!rangeValid) return null;
    const { creditGiven, paymentReceived, entryReversed } = data;
    return {
      totals: deriveReport(creditGiven, paymentReceived, entryReversed, from, to),
      buckets: deriveDailyTotals(creditGiven, paymentReceived, entryReversed, from, to),
      breakdown: deriveCustomerBreakdown(
        creditGiven,
        paymentReceived,
        entryReversed,
        derived.customers,
        from,
        to,
        t('khata.reports.unknownCustomer'),
      ),
    };
  }, [data, derived.customers, from, to, rangeValid, t]);

  const knownCustomerIds = useMemo(() => new Set(derived.customers.map((c) => c.id)), [derived.customers]);
  const hasActivity = report !== null && report.totals.creditPaisa + report.totals.paymentsPaisa > 0;

  const quickRanges: RangeKey[] = ['today', 'thisWeek', 'thisMonth'];

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('khata.reports.title')} />

      <div role="group" aria-label={t('khata.reports.rangeLabel')} className="grid grid-cols-3 gap-2">
        {quickRanges.map((key) => {
          const active = from === ranges[key].from && to === ranges[key].to;
          return (
            <Button
              key={key}
              size="sm"
              variant={active ? 'primary' : 'neutral'}
              aria-pressed={active}
              onClick={() => {
                setFrom(ranges[key].from);
                setTo(ranges[key].to);
              }}
            >
              {t(`khata.reports.${key}`)}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('khata.reports.fromLabel')}
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          label={t('khata.reports.toLabel')}
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {!rangeValid && <Notice tone="error">{t('khata.reports.rangeInvalid')}</Notice>}

      {report && (
        <>
          <Card aria-label={t('khata.reports.title')}>
            <dl className="space-y-1">
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <dt className="text-base text-gray-800">{t('khata.reports.creditGiven')}</dt>
                <dd>
                  <Money paisa={report.totals.creditPaisa} tone="owed" size="lg" />
                </dd>
              </div>
              <div className="flex min-h-[44px] items-center justify-between gap-3">
                <dt className="text-base text-gray-800">{t('khata.reports.paymentsReceived')}</dt>
                <dd>
                  <Money paisa={report.totals.paymentsPaisa} tone="received" size="lg" />
                </dd>
              </div>
              <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-gray-200 pt-2">
                <dt className="text-base font-semibold text-gray-900">{t('khata.reports.net')}</dt>
                <dd>
                  <Money paisa={report.totals.netPaisa} tone={report.totals.netPaisa >= 0 ? 'received' : 'owed'} size="xl" />
                </dd>
              </div>
            </dl>
          </Card>

          {hasActivity ? (
            <>
              <Card aria-labelledby="chart-heading">
                <h3 id="chart-heading" className="mb-2 text-base font-semibold text-gray-800">
                  {t('khata.reports.chartTitle')}
                </h3>
                <GroupedBarChart
                  ariaLabel={t('khata.reports.chartLabel')}
                  description={t('khata.reports.chartDescription', {
                    credit: formatPaisa(report.totals.creditPaisa),
                    payments: formatPaisa(report.totals.paymentsPaisa),
                  })}
                  series={[
                    {
                      key: 'credit',
                      label: t('khata.reports.creditGiven'),
                      barClassName: 'fill-red-600',
                      swatchClassName: 'bg-red-600',
                    },
                    {
                      key: 'payments',
                      label: t('khata.reports.paymentsReceived'),
                      barClassName: 'fill-green-700',
                      swatchClassName: 'bg-green-700',
                    },
                  ]}
                  groups={report.buckets.map((b) => ({
                    label: formatDateDMY(b.from).slice(0, 5),
                    values: [b.creditPaisa, b.paymentsPaisa],
                  }))}
                />
              </Card>

              <section aria-labelledby="breakdown-heading">
                <h3 id="breakdown-heading" className="mb-2 text-base font-semibold text-gray-800">
                  {t('khata.reports.byCustomer')}
                </h3>
                <ul className="space-y-2">
                  {report.breakdown.map((row) => {
                    const content = (
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1 break-words text-base font-medium text-gray-900">{row.name}</span>
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          {row.creditPaisa > 0 && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-600">
                              {t('khata.common.credit')} <Money paisa={row.creditPaisa} tone="owed" size="sm" />
                            </span>
                          )}
                          {row.paymentsPaisa > 0 && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-600">
                              {t('khata.common.payment')} <Money paisa={row.paymentsPaisa} tone="received" size="sm" />
                            </span>
                          )}
                        </span>
                      </span>
                    );
                    return (
                      <li key={row.customerId}>
                        {knownCustomerIds.has(row.customerId) ? (
                          <Card onClick={() => navigate({ name: 'customerDetail', customerId: row.customerId })}>
                            {content}
                          </Card>
                        ) : (
                          <Card tone="muted">{content}</Card>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          ) : (
            <EmptyState
              icon={<ReportsIcon />}
              title={t('khata.reports.noActivityTitle')}
              description={t('khata.reports.noActivityText')}
              actionLabel={t('khata.reports.recordEntry')}
              onAction={() => navigate({ name: 'quickEntry', from: 'reports' })}
            />
          )}
        </>
      )}
    </div>
  );
}
