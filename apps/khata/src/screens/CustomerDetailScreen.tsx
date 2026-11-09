import { useMemo } from 'react';
import {
  ScreenHeader,
  formatDateDMY,
  normalizePhone,
  useTranslation,
  validatePakistaniPhone,
} from '@skeleton/core';
import { Money, balanceStatusKey } from '../components/Money';
import { displayShopName } from '../components/shopName';
import {
  card,
  creditButton,
  mutedText,
  neutralButton,
  paymentButton,
  secondaryButton,
  sectionTitle,
  smallButton,
} from '../components/styles';
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
        <p className={`${card} ${mutedText}`}>{t('khata.customerDetail.notFound')}</p>
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

      <section className={card} aria-labelledby="balance-heading">
        <p id="balance-heading" className={mutedText}>
          {t('khata.customerDetail.balance')}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <Money paisa={balance} tone="balance" className="text-4xl" />
          <span className="text-sm font-medium text-gray-700">{t(balanceStatusKey(balance))}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {customer.phone ? (
            <span dir="ltr" className="text-sm text-gray-700">
              {customer.phone}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => navigate({ name: 'editCustomer', customerId })}
            className={smallButton}
          >
            {t('khata.customerDetail.editButton')}
          </button>
        </div>
        {customer.note ? <p className="mt-2 text-sm text-gray-700">{customer.note}</p> : null}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate({ name: 'addEntry', customerId, type: 'credit' })}
          className={creditButton}
        >
          {t('khata.customerDetail.creditButton')}
        </button>
        <button
          type="button"
          onClick={() => navigate({ name: 'addEntry', customerId, type: 'payment' })}
          className={paymentButton}
        >
          {t('khata.customerDetail.paymentButton')}
        </button>
      </div>

      {balance > 0 &&
        (canRemind ? (
          <div className="space-y-2">
            <a
              href={buildWhatsAppUrl(reminder)}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryButton}
            >
              {t('khata.customerDetail.reminderButton')}
            </a>
            <a href={buildSmsUrl({ phone, message: buildSmsMessage(reminder) })} className={neutralButton}>
              {t('khata.customerDetail.reminderSms')}
            </a>
          </div>
        ) : (
          <p className={`${card} ${mutedText}`}>{t('khata.customerDetail.noPhone')}</p>
        ))}

      <section aria-labelledby="history-heading">
        <h3 id="history-heading" className={sectionTitle}>
          {t('khata.customerDetail.history')}
        </h3>
        {history.length === 0 ? (
          <p className={`${card} ${mutedText}`}>{t('khata.customerDetail.noTransactions')}</p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => {
              const isCredit = entry.type === 'credit';
              return (
                <li key={entry.id} className={`${card} ${entry.reversed ? 'bg-gray-50' : ''}`}>
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
                      className="text-lg"
                    />
                  </div>

                  {entry.note ? <p className="mt-1 text-sm text-gray-700">{entry.note}</p> : null}

                  {entry.reversed ? (
                    <p className="mt-2 text-sm text-gray-700">
                      <span className="font-semibold">{t('khata.customerDetail.reversed')}</span>
                      {entry.reverseReason ? (
                        <span> · {t('khata.customerDetail.reversedReason', { reason: entry.reverseReason })}</span>
                      ) : null}
                    </p>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-600">
                        {t('khata.common.balance')}:{' '}
                        <Money paisa={entry.runningBalancePaisa} tone="balance" className="text-sm" />
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate({ name: 'reverseEntry', entryId: entry.id, customerId })}
                        className={smallButton}
                      >
                        {t('khata.customerDetail.correctButton')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
