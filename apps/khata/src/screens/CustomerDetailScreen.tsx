import { useMemo } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ScreenHeader,
  formatDateDMY,
  formatPhone,
  normalizePhone,
  useTranslation,
  validatePakistaniPhone,
} from '@skeleton/core';
import { Money, balanceStatusKey } from '../components/Money';
import { ReportsIcon } from '../components/NavIcons';
import { displayShopName } from '../components/shopName';
import { deriveBalance } from '../khata.reducers';
import { buildSmsMessage, buildSmsUrl, buildWhatsAppUrl } from '../utils/reminder';
import type { ScreenProps } from './types';

/**
 * One customer: balance, quick actions, reminder links and the full ledger
 * (newest first, with running balance). Reversed entries stay visible,
 * struck through, with the reason.
 */
export function CustomerDetailScreen({
  derived,
  data,
  navigate,
  language,
  customerId,
}: ScreenProps & { customerId: string }) {
  const { t } = useTranslation();
  const customer = derived.customers.find((c) => c.id === customerId);

  const ledger = useMemo(
    () => deriveBalance(data.creditGiven, data.paymentReceived, data.entryReversed, customerId),
    [data.creditGiven, data.paymentReceived, data.entryReversed, customerId],
  );

  const backToList = () => navigate({ name: 'customerList' });

  if (!customer) {
    return (
      <div>
        <ScreenHeader title={t('khata.customers.title')} onBack={backToList} backLabel={t('khata.common.back')} />
        <EmptyState title={t('khata.customerDetail.notFound')} actionLabel={t('khata.common.back')} onAction={backToList} />
      </div>
    );
  }

  const balance = ledger.balancePaisa;
  const phone = customer.phone ? normalizePhone(customer.phone) : '';
  const canRemind = phone !== '' && validatePakistaniPhone(phone);

  const reminder = {
    phone,
    shopName: displayShopName(derived.settings, t),
    customerName: customer.name,
    balancePaisa: balance,
    language,
  };

  const history = [...ledger.entries].reverse(); // newest first

  return (
    <div className="space-y-4">
      <ScreenHeader title={customer.name} onBack={backToList} backLabel={t('khata.common.back')} />

      <Card aria-labelledby="balance-heading">
        <p id="balance-heading" className="text-sm text-gray-600">
          {t('khata.customerDetail.balance')}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <Money paisa={balance} tone="balance" size="hero" />
          <span className="text-sm font-medium text-gray-700">{t(balanceStatusKey(balance))}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {customer.phone ? (
            <span dir="ltr" className="text-sm text-gray-700">
              {formatPhone(customer.phone)}
            </span>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            variant="neutral"
            onClick={() => navigate({ name: 'editCustomer', customerId })}
          >
            {t('khata.customerDetail.editButton')}
          </Button>
        </div>
        {customer.note ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{customer.note}</p>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="danger" onClick={() => navigate({ name: 'addEntry', customerId, type: 'credit' })}>
          {t('khata.customerDetail.creditButton')}
        </Button>
        <Button variant="success" onClick={() => navigate({ name: 'addEntry', customerId, type: 'payment' })}>
          {t('khata.customerDetail.paymentButton')}
        </Button>
      </div>

      {balance > 0 &&
        (canRemind ? (
          <div className="space-y-2">
            <Button variant="secondary" href={buildWhatsAppUrl(reminder)} target="_blank">
              {t('khata.customerDetail.reminderButton')}
            </Button>
            <Button variant="neutral" href={buildSmsUrl({ phone, message: buildSmsMessage(reminder) })}>
              {t('khata.customerDetail.reminderSms')}
            </Button>
          </div>
        ) : (
          <Card tone="muted" className="text-sm text-gray-600">
            {t('khata.customerDetail.noPhone')}
          </Card>
        ))}

      <section aria-labelledby="history-heading">
        <h3 id="history-heading" className="mb-2 text-base font-semibold text-gray-800">
          {t('khata.customerDetail.history')}
        </h3>
        {history.length === 0 ? (
          <EmptyState
            icon={<ReportsIcon />}
            title={t('khata.customerDetail.noTransactions')}
            description={t('khata.customerDetail.firstEntryHint')}
            actionLabel={t('khata.customerDetail.creditButton')}
            onAction={() => navigate({ name: 'addEntry', customerId, type: 'credit' })}
          />
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => {
              const isCredit = entry.type === 'credit';
              return (
                <li key={entry.id}>
                  <Card tone={entry.reversed ? 'muted' : 'default'}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span
                          className={`text-sm font-semibold ${
                            entry.reversed ? 'text-gray-600' : isCredit ? 'text-red-700' : 'text-green-700'
                          }`}
                        >
                          {t(isCredit ? 'khata.common.credit' : 'khata.common.payment')}
                        </span>
                        <span dir="ltr" className="block text-start text-sm text-gray-600">
                          {formatDateDMY(entry.date)}
                        </span>
                      </div>
                      <Money
                        paisa={entry.amountPaisa}
                        tone={entry.reversed ? 'muted' : isCredit ? 'owed' : 'received'}
                        strikethrough={entry.reversed}
                        size="lg"
                      />
                    </div>

                    {entry.note ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">{entry.note}</p>
                    ) : null}

                    {entry.reversed ? (
                      <p className="mt-2 break-words text-sm text-gray-700">
                        <span className="font-semibold">{t('khata.customerDetail.reversed')}</span>
                        {entry.reverseReason ? (
                          <span> · {t('khata.customerDetail.reversedReason', { reason: entry.reverseReason })}</span>
                        ) : null}
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-600">
                          {t('khata.common.balance')}:{' '}
                          <Money paisa={entry.runningBalancePaisa} tone="balance" size="sm" />
                        </span>
                        <Button
                          size="sm"
                          variant="neutral"
                          onClick={() => navigate({ name: 'reverseEntry', entryId: entry.id, customerId })}
                        >
                          {t('khata.customerDetail.correctButton')}
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
