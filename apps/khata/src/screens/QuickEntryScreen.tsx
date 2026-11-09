import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, ScreenHeader, TextField, formatPhone, useTranslation } from '@skeleton/core';
import { EntryForm } from '../components/EntryForm';
import { Money, balanceStatusKey } from '../components/Money';
import { CustomersIcon } from '../components/NavIcons';
import { filterCustomers } from '../khata.reducers';
import type { QuickEntryOrigin } from '../khata.types';
import type { ScreenProps } from './types';

/** Customers shown at once while choosing; searching narrows the list. */
const MAX_ROWS = 50;

/**
 * The fast path behind the "+" button: search and pick a customer, choose
 * Credit Given or Payment Received, type the amount, save. Afterwards the
 * customer's page opens so the new entry and balance are visible at once.
 */
export function QuickEntryScreen({
  derived,
  store,
  navigate,
  onChanged,
  from,
}: ScreenProps & { from: QuickEntryOrigin }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [type, setType] = useState<'credit' | 'payment'>('credit');

  const goBack = () => navigate({ name: from });
  const selected = selectedId ? derived.customers.find((c) => c.id === selectedId) : undefined;

  const rows = useMemo(
    () => filterCustomers(derived.customers, derived.balances, query).slice(0, MAX_ROWS),
    [derived.customers, derived.balances, query],
  );

  const header = <ScreenHeader title={t('khata.quickEntry.title')} onBack={goBack} backLabel={t('khata.common.back')} />;

  if (derived.customers.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          icon={<CustomersIcon />}
          title={t('khata.quickEntry.noCustomersTitle')}
          description={t('khata.quickEntry.noCustomersText')}
          actionLabel={t('khata.customers.addButton')}
          onAction={() => navigate({ name: 'addCustomer' })}
        />
      </div>
    );
  }

  if (selected) {
    const balance = derived.balances.get(selected.id) ?? 0;
    return (
      <div className="space-y-4">
        {header}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-base font-semibold text-gray-900">{selected.name}</p>
              <p className="text-sm text-gray-600">
                {t('khata.common.balance')}: <Money paisa={balance} tone="balance" size="sm" />{' '}
                <span>{t(balanceStatusKey(balance))}</span>
              </p>
            </div>
            <Button size="sm" variant="neutral" onClick={() => setSelectedId(null)}>
              {t('khata.quickEntry.change')}
            </Button>
          </div>
        </Card>

        <div role="group" aria-label={t('khata.quickEntry.typeLabel')} className="grid grid-cols-2 gap-3">
          <Button
            variant={type === 'credit' ? 'danger' : 'neutral'}
            aria-pressed={type === 'credit'}
            onClick={() => setType('credit')}
          >
            {t('khata.customerDetail.creditButton')}
          </Button>
          <Button
            variant={type === 'payment' ? 'success' : 'neutral'}
            aria-pressed={type === 'payment'}
            onClick={() => setType('payment')}
          >
            {t('khata.customerDetail.paymentButton')}
          </Button>
        </div>

        <EntryForm
          key={selected.id}
          type={type}
          customerId={selected.id}
          store={store}
          onSaved={async () => {
            await onChanged();
            navigate({ name: 'customerDetail', customerId: selected.id });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <TextField
        label={t('khata.quickEntry.searchLabel')}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('khata.customers.search')}
        autoComplete="off"
        // Opening the flow means "find a customer", so the search is ready to type in.
        autoFocus
      />

      <h3 className="text-base font-semibold text-gray-800">{t('khata.quickEntry.chooseCustomer')}</h3>

      {rows.length === 0 ? (
        <EmptyState
          title={t('khata.customers.noResults')}
          description={t('khata.customers.noResultsHint')}
          actionLabel={t('khata.customers.addButton')}
          onAction={() => navigate({ name: 'addCustomer' })}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ customer, balancePaisa }) => (
            <li key={customer.id}>
              <Card onClick={() => setSelectedId(customer.id)}>
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-base font-medium text-gray-900">{customer.name}</span>
                    {customer.phone ? (
                      <span dir="ltr" className="block text-start text-sm text-gray-600">
                        {formatPhone(customer.phone)}
                      </span>
                    ) : null}
                  </span>
                  <Money paisa={balancePaisa} tone="balance" size="md" />
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
