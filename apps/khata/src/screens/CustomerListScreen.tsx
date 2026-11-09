import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, ScreenHeader, TextField, formatPhone, useTranslation } from '@skeleton/core';
import { Money, balanceStatusKey } from '../components/Money';
import { CustomersIcon } from '../components/NavIcons';
import { filterCustomers } from '../khata.reducers';
import type { ScreenProps } from './types';

/**
 * All customers, highest balance first, with live search by name or phone.
 * Red = owes money; green = settled or paid in advance. A word beside each
 * amount (Owes / Settled / Advance) means colour is never the only signal.
 */
export function CustomerListScreen({ derived, navigate }: ScreenProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () => filterCustomers(derived.customers, derived.balances, query),
    [derived.customers, derived.balances, query],
  );

  const addCustomer = () => navigate({ name: 'addCustomer' });

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('khata.customers.title')} />

      {derived.customers.length === 0 ? (
        <EmptyState
          icon={<CustomersIcon />}
          title={t('khata.customers.emptyTitle')}
          description={t('khata.customers.emptyState')}
          actionLabel={t('khata.customers.addButton')}
          onAction={addCustomer}
        />
      ) : (
        <>
          <Button onClick={addCustomer}>{t('khata.customers.addButton')}</Button>

          <TextField
            label={t('khata.customers.search')}
            hideLabel
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('khata.customers.search')}
            autoComplete="off"
          />

          {rows.length === 0 ? (
            <EmptyState
              title={t('khata.customers.noResults')}
              description={t('khata.customers.noResultsHint')}
              actionLabel={t('khata.customers.addButton')}
              onAction={addCustomer}
            />
          ) : (
            <ul className="space-y-2">
              {rows.map(({ customer, balancePaisa }) => (
                <li key={customer.id}>
                  <Card onClick={() => navigate({ name: 'customerDetail', customerId: customer.id })}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-base font-medium text-gray-900">{customer.name}</span>
                        {customer.phone ? (
                          <span dir="ltr" className="block text-start text-sm text-gray-600">
                            {formatPhone(customer.phone)}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <Money paisa={balancePaisa} tone="balance" size="lg" />
                        <span className="text-xs text-gray-600">{t(balanceStatusKey(balancePaisa))}</span>
                      </span>
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
