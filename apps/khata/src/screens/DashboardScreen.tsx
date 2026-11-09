import { ScreenHeader, useTranslation } from '@skeleton/core';
import { Money } from '../components/Money';
import { displayShopName } from '../components/shopName';
import { card, mutedText, sectionTitle } from '../components/styles';
import type { ScreenProps } from './types';

/** Home screen: total owed, today's credit and payments, and the top 5 debtors. */
export function DashboardScreen({ derived, navigate }: ScreenProps) {
  const { t } = useTranslation();
  const { dashboard, settings } = derived;

  return (
    <div className="space-y-4">
      <ScreenHeader title={displayShopName(settings, t)} />

      <section className={card} aria-labelledby="total-outstanding">
        <p id="total-outstanding" className={mutedText}>
          {t('khata.dashboard.totalOutstanding')}
        </p>
        <Money
          paisa={dashboard.totalOutstandingPaisa}
          tone={dashboard.totalOutstandingPaisa > 0 ? 'owed' : 'received'}
          className="text-4xl"
        />
      </section>

      <section className={card} aria-labelledby="today-heading">
        <h3 id="today-heading" className={sectionTitle}>
          {t('khata.dashboard.today')}
        </h3>
        <dl className="space-y-3">
          <div className="flex min-h-[44px] items-center justify-between gap-3">
            <dt className="text-base text-gray-800">{t('khata.dashboard.creditToday')}</dt>
            <dd>
              <Money paisa={dashboard.creditTodayPaisa} tone="owed" className="text-lg" />
            </dd>
          </div>
          <div className="flex min-h-[44px] items-center justify-between gap-3">
            <dt className="text-base text-gray-800">{t('khata.dashboard.paymentsToday')}</dt>
            <dd>
              <Money paisa={dashboard.paymentsTodayPaisa} tone="received" className="text-lg" />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="top-debtors-heading">
        <h3 id="top-debtors-heading" className={sectionTitle}>
          {t('khata.dashboard.topDebtors')}
        </h3>
        {dashboard.topDebtors.length === 0 ? (
          <p className={`${card} ${mutedText}`}>{t('khata.dashboard.noDebtors')}</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.topDebtors.map((debtor) => (
              <li key={debtor.customerId}>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'customerDetail', customerId: debtor.customerId })}
                  className={`${card} flex min-h-[56px] w-full items-center justify-between gap-3 text-start hover:bg-gray-50`}
                >
                  <span className="min-w-0 flex-1 truncate text-base font-medium text-gray-900">
                    {debtor.name}
                  </span>
                  <Money paisa={debtor.balancePaisa} tone="owed" className="text-lg" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
