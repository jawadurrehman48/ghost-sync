import { useState } from 'react';
import type { FormEvent } from 'react';
import { LANGUAGES, ScreenHeader, useTranslation } from '@skeleton/core';
import type { Language } from '@skeleton/core';
import { displayShopName } from '../components/shopName';
import {
  card,
  fieldError,
  input,
  label,
  mutedText,
  neutralButton,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from '../components/styles';
import { buildCsvBlob, collectExportRows, downloadCsvBlob } from '../utils/csv';
import { loadDemoData } from '../utils/demo';
import type { ScreenProps } from './types';

type Notice = 'saved' | 'demoLoaded' | null;

/**
 * Shop name, language, CSV backup and demo data.
 * Shop name and language changes are appended as settingsUpdated records.
 */
export function SettingsScreen({ data, derived, store, onChanged, language, changeLanguage }: ScreenProps) {
  const { t } = useTranslation();
  const [shopName, setShopName] = useState(displayShopName(derived.settings, t));
  const [nameError, setNameError] = useState(false);
  const [confirmingDemo, setConfirmingDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function run(action: () => Promise<void>, success: Notice) {
    setBusy(true);
    setFailed(false);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveName(event: FormEvent) {
    event.preventDefault();
    const clean = shopName.trim();
    if (clean === '') {
      setNameError(true);
      return;
    }
    setNameError(false);
    await run(async () => {
      await store.add('settingsUpdated', { shopName: clean });
      await onChanged();
    }, 'saved');
  }

  function handleExport() {
    const rows = collectExportRows(data, derived);
    const blob = buildCsvBlob(rows.customers, rows.transactions, displayShopName(derived.settings, t));
    downloadCsvBlob(blob);
  }

  async function handleLoadDemo() {
    setConfirmingDemo(false);
    await run(async () => {
      await loadDemoData(store);
      await onChanged();
    }, 'demoLoaded');
  }

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('khata.settings.title')} />

      <form onSubmit={handleSaveName} noValidate className="space-y-3">
        <div>
          <label htmlFor="shop-name" className={label}>
            {t('khata.settings.shopNameLabel')}
          </label>
          <input
            id="shop-name"
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            autoComplete="off"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'shop-name-error' : undefined}
            className={input}
          />
          {nameError && (
            <p id="shop-name-error" role="alert" className={fieldError}>
              {t('khata.settings.shopNameRequired')}
            </p>
          )}
        </div>
        <button type="submit" disabled={busy} className={primaryButton}>
          {t('khata.common.save')}
        </button>
      </form>

      <fieldset className="space-y-2">
        <legend className={sectionTitle}>{t('khata.settings.languageLabel')}</legend>
        {LANGUAGES.map((lng: Language) => (
          <label
            key={lng}
            className={`${card} flex min-h-[56px] cursor-pointer items-center gap-3 text-base text-gray-900`}
          >
            <input
              type="radio"
              name="language"
              value={lng}
              checked={language === lng}
              onChange={() => void changeLanguage(lng)}
              className="h-5 w-5 accent-indigo-600"
            />
            <span>{lng === 'en' ? t('language.english') : t('language.urdu')}</span>
          </label>
        ))}
      </fieldset>

      <section className="space-y-3">
        <button type="button" onClick={handleExport} className={secondaryButton}>
          {t('khata.settings.exportButton')}
        </button>

        {confirmingDemo ? (
          <div className={`${card} space-y-3`} role="alertdialog" aria-labelledby="demo-confirm-text">
            <p id="demo-confirm-text" className="text-base text-gray-900">
              {t('khata.settings.demoConfirm')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmingDemo(false)} className={neutralButton}>
                {t('khata.common.cancel')}
              </button>
              <button type="button" onClick={handleLoadDemo} disabled={busy} className={primaryButton}>
                {t('khata.settings.demoConfirmYes')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button type="button" onClick={() => setConfirmingDemo(true)} disabled={busy} className={neutralButton}>
              {t('khata.settings.demoButton')}
            </button>
            <p className={`mt-1 ${mutedText}`}>{t('khata.settings.demoWarning')}</p>
          </div>
        )}
      </section>

      {notice && (
        <p role="status" className="text-base font-medium text-green-700">
          {notice === 'saved' ? t('khata.settings.saved') : t('khata.settings.demoLoaded')}
        </p>
      )}
      {failed && (
        <p role="alert" className={fieldError}>
          {t('khata.common.errorGeneric')}
        </p>
      )}
    </div>
  );
}
