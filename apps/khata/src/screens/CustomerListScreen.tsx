import { useMemo, useState } from 'react';
import { ScreenHeader, useTranslation } from '@skeleton/core';
import { Money, balanceStatusKey } from '../components/Money';
import { card, input, mutedText, primaryButton } from '../components/styles';
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

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('khata.customers.title')} />

      <button type="button" onClick={() => navigate({ name: 'addCustomer' })} className={primaryButton}>
        {t('khata.customers.addButton')}
      </button>

      <div>
        <label htmlFor="customer-search" className="sr-only">
          {t('khata.customers.search')}
        </label>
        <input
          id="customer-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('khata.customers.search')}
          autoComplete="off"
          className={input}
        />
      </div>

      {derived.customers.length === 0 ? (
        <p className={`${card} ${mutedText}`}>{t('khata.customers.emptyState')}</p>
      ) : rows.length === 0 ? (
        <p className={`${card} ${mutedText}`}>{t('khata.customers.noResults')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ customer, balancePaisa }) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => navigate({ name: 'customerDetail', customerId: customer.id })}
                className={`${card} flex min-h-[64px] w-full items-center justify-between gap-3 text-start hover:bg-gray-50`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-gray-900">{customer.name}</span>
                  {customer.phone ? (
                    <span dir="ltr" className="block truncate text-start text-sm text-gray-600">
                      {customer.phone}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <Money paisa={balancePaisa} tone="balance" className="text-lg" />
                  <span className="text-xs text-gray-600">{t(balanceStatusKey(balancePaisa))}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
