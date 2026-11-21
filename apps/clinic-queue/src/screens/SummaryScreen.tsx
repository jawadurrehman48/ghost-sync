import { useMemo, useState } from 'react';
import {
  Card,
  EmptyState,
  GroupedBarChart,
  Notice,
  ScreenHeader,
  StatCard,
  TextField,
  isValidISODate,
  useTranslation,
} from '@skeleton/core';
import { deriveSummary } from '../clinic.reducers';
import { SummaryIcon } from '../components/NavIcons';
import type { ScreenProps } from './types';

/** A day's figures: patients seen, average wait, tokens issued, skipped, and patients per hour. */
export function SummaryScreen({ derived, navigate }: ScreenProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(derived.today);
  const valid = isValidISODate(date);
  const summary = useMemo(() => (valid ? deriveSummary(derived.tokens, date) : null), [derived.tokens, date, valid]);

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('clinic.summary.title')} />

      <TextField
        label={t('clinic.summary.dateLabel')}
        type="date"
        value={date}
        max={derived.today}
        onChange={(e) => setDate(e.target.value)}
      />

      {!valid && <Notice tone="error">{t('clinic.summary.dateInvalid')}</Notice>}

      {summary && summary.issued === 0 && (
        <EmptyState
          icon={<SummaryIcon />}
          title={t('clinic.summary.emptyTitle')}
          description={t('clinic.summary.emptyText')}
          actionLabel={t('clinic.queue.issueToken')}
          onAction={() => navigate({ name: 'issueToken', from: 'queue' })}
        />
      )}

      {summary && summary.issued > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label={t('clinic.summary.seen')} value={summary.completed} tone="success" />
            <StatCard
              label={t('clinic.summary.avgWait')}
              value={
                summary.avgWaitMinutes === null
                  ? t('clinic.summary.noWait')
                  : t('clinic.summary.avgWaitValue', { count: summary.avgWaitMinutes })
              }
              tone="brand"
            />
            <StatCard label={t('clinic.summary.issued')} value={summary.issued} />
            <StatCard label={t('clinic.summary.skipped')} value={summary.skipped} />
            {summary.waiting + summary.serving > 0 && (
              <StatCard label={t('clinic.summary.waitingNow')} value={summary.waiting + summary.serving} tone="warning" />
            )}
          </div>

          <Card aria-labelledby="hours-heading">
            <h3 id="hours-heading" className="mb-2 text-base font-semibold text-gray-800">
              {t('clinic.summary.chartTitle')}
            </h3>
            <GroupedBarChart
              ariaLabel={t('clinic.summary.chartLabel')}
              description={t('clinic.summary.chartDescription', { arrived: summary.issued, seen: summary.completed })}
              series={[
                { key: 'arrived', label: t('clinic.summary.arrived'), barClassName: 'fill-brand-600', swatchClassName: 'bg-brand-600' },
                { key: 'seen', label: t('clinic.summary.seenSeries'), barClassName: 'fill-green-700', swatchClassName: 'bg-green-700' },
              ]}
              groups={summary.hours.map((h) => ({
                label: `${String(h.hour).padStart(2, '0')}:00`,
                values: [h.arrived, h.seen],
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}
