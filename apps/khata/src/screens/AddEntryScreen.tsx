import { EmptyState, ScreenHeader, useTranslation } from '@skeleton/core';
import { EntryForm } from '../components/EntryForm';
import type { ScreenProps } from './types';

/** "Credit Given" / "Payment Received" for one customer. */
export function AddEntryScreen({
  derived,
  store,
  navigate,
  onChanged,
  customerId,
  type,
}: ScreenProps & { customerId: string; type: 'credit' | 'payment' }) {
  const { t } = useTranslation();
  const customer = derived.customers.find((c) => c.id === customerId);
  const goBack = () => navigate({ name: 'customerDetail', customerId });

  return (
    <div>
      <ScreenHeader
        title={t(type === 'credit' ? 'khata.addEntry.creditTitle' : 'khata.addEntry.paymentTitle')}
        onBack={goBack}
        backLabel={t('khata.common.back')}
      />

      {customer ? (
        <>
          <p className="mb-4 break-words text-sm text-gray-600">
            {t('khata.addEntry.customerLabel')}: <span className="font-semibold text-gray-900">{customer.name}</span>
          </p>
          <EntryForm
            type={type}
            customerId={customerId}
            store={store}
            onSaved={async () => {
              await onChanged();
              goBack();
            }}
          />
        </>
      ) : (
        <EmptyState
          title={t('khata.customerDetail.notFound')}
          actionLabel={t('khata.common.back')}
          onAction={() => navigate({ name: 'customerList' })}
        />
      )}
    </div>
  );
}
