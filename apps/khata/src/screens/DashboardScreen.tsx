import { Button, Card, EmptyState, ScreenHeader, useTranslation } from '@skeleton/core';
import { Money } from '../components/Money';
import { CustomersIcon } from '../components/NavIcons';
import { displayShopName } from '../components/shopName';
import type { ScreenProps } from './types';

/** Home screen: total owed, how many owe, today's credit and payments, and the top 5 debtors. */
export function DashboardScreen({ derived, navigate }: ScreenProps) {
  const { t } = useTranslation();
  const { dashboard, settings, customers } = derived;
  const header = <ScreenHeader title={displayShopName(settings, t)} />;

  if (customers.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <EmptyState
          icon={<CustomersIcon />}
          title={t('khata.dashboard.welcomeTitle')}
          description={t('khata.dashboard.welcomeText')}
          actionLabel={t('khata.dashboard.addFirst')}
          onAction={() => navigate({ name: 'addCustomer' })}
        />
        <Button variant="neutral" onClick={() => navigate({ name: 'settings' })}>
          {t('khata.dashboard.tryDemo')}
        </Button>
      </div>
    );
  }

  const owing = dashboard.totalOutstandingPaisa > 0;

  return (
    <div className="space-y-4">
      {header}

      <Card aria-labelledby="total-outstanding">
        <p id="total-outstanding" className="text-sm text-gray-600">
          {t('khata.dashboard.totalOutstanding')}
        </p>
        <Money paisa={dashboard.totalOutstandingPaisa} tone={owing ? 'owed' : 'received'} size="hero" />
        <p className="mt-1 text-sm font-medium text-gray-700">
          {dashboard.customersOwingCount > 0
            ? t('khata.dashboard.owingCount', { count: dashboard.customersOwingCount })
            : t('khata.dashboard.allSettled')}
        </p>
      </Card>

      <Card aria-labelledby="today-heading">
        <h3 id="today-heading" className="mb-2 text-base font-semibold text-gray-800">
          {t('khata.dashboard.today')}
        </h3>
        <dl className="space-y-1">
          <div className="flex min-h-[44px] items-center justify-between gap-3">
            <dt className="text-base text-gray-800">{t('khata.dashboard.creditToday')}</dt>
            <dd>
              <Money paisa={dashboard.creditTodayPaisa} tone="owed" size="lg" />
            </dd>
          </div>
          <div className="flex min-h-[44px] items-center justify-between gap-3">
            <dt className="text-base text-gray-800">{t('khata.dashboard.paymentsToday')}</dt>
            <dd>
              <Money paisa={dashboard.paymentsTodayPaisa} tone="received" size="lg" />
            </dd>
          </div>
        </dl>
      </Card>

      <section aria-labelledby="top-debtors-heading">
        <h3 id="top-debtors-heading" className="mb-2 text-base font-semibold text-gray-800">
          {t('khata.dashboard.topDebtors')}
        </h3>
        {dashboard.topDebtors.length === 0 ? (
          <Card tone="muted" className="text-sm text-gray-600">
            {t('khata.dashboard.noDebtors')}
          </Card>
        ) : (
          <ul className="space-y-2">
            {dashboard.topDebtors.map((debtor) => (
              <li key={debtor.customerId}>
                <Card onClick={() => navigate({ name: 'customerDetail', customerId: debtor.customerId })}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 break-words text-base font-medium text-gray-900">
                      {debtor.name}
                    </span>
                    <Money paisa={debtor.balancePaisa} tone="owed" size="lg" />
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
