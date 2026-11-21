import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Card,
  ConfirmDialog,
  LANGUAGES,
  Notice,
  ScreenHeader,
  SyncDevicesSection,
  TextField,
  useSubmitGuard,
  useTranslation,
} from '@skeleton/core';
import type { Language } from '@skeleton/core';
import { displayShopName } from '../components/shopName';
import { LIMITS, collapseSpaces } from '../khata.limits';
import { buildCsvBlob, collectExportRows, downloadCsvBlob } from '../utils/csv';
import { loadDemoData } from '../utils/demo';
import type { ScreenProps } from './types';

type Message = 'saved' | 'demoLoaded' | 'demoAlreadyLoaded' | 'cleared';
type DialogName = 'demo' | 'clear';

const MESSAGE_KEY: Record<Message, string> = {
  saved: 'khata.settings.saved',
  demoLoaded: 'khata.settings.demoLoaded',
  demoAlreadyLoaded: 'khata.settings.demoAlreadyLoaded',
  cleared: 'khata.settings.cleared',
};

/**
 * Shop name, language, data backup (CSV), demo data and "Clear all data".
 * Shop name and language changes are appended as settingsUpdated records.
 * Demo data can be loaded only once; clearing needs an explicit confirmation.
 */
export function SettingsScreen({
  data,
  derived,
  store,
  onChanged,
  onClearAll,
  language,
  changeLanguage,
  devices,
}: ScreenProps) {
  const { t } = useTranslation();
  const guard = useSubmitGuard();
  const [shopName, setShopName] = useState(displayShopName(derived.settings, t));
  const [nameError, setNameError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [failed, setFailed] = useState(false);

  /** Run an async action once at a time and report the outcome. */
  async function run(action: () => Promise<Message>) {
    setFailed(false);
    setMessage(null);
    await guard.run(async () => {
      try {
        setMessage(await action());
      } catch {
        setFailed(true);
      }
    });
    setDialog(null);
  }

  async function handleSaveName(event: FormEvent) {
    event.preventDefault();
    const clean = collapseSpaces(shopName);
    if (clean === '') return setNameError('khata.settings.shopNameRequired');
    if (clean.length > LIMITS.shopName) return setNameError('khata.settings.shopNameTooLong');
    setNameError(null);
    await run(async () => {
      await store.add('settingsUpdated', { shopName: clean });
      await onChanged();
      return 'saved';
    });
  }

  function handleExport() {
    setFailed(false);
    setMessage(null);
    try {
      const rows = collectExportRows(data, derived);
      downloadCsvBlob(buildCsvBlob(rows.customers, rows.transactions, displayShopName(derived.settings, t)));
    } catch {
      setFailed(true);
    }
  }

  function handleDemoClick() {
    if (derived.settings.demoDataLoaded) {
      setFailed(false);
      setMessage('demoAlreadyLoaded');
    } else {
      setDialog('demo');
    }
  }

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('khata.settings.title')} />

      {message && <Notice tone="success">{t(MESSAGE_KEY[message])}</Notice>}
      {failed && <Notice tone="error">{t('khata.common.errorGeneric')}</Notice>}

      <form onSubmit={handleSaveName} noValidate className="space-y-3">
        <TextField
          label={t('khata.settings.shopNameLabel')}
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          maxLength={LIMITS.shopName}
          autoComplete="off"
          error={nameError ? t(nameError, { max: LIMITS.shopName }) : undefined}
        />
        <Button type="submit" loading={guard.busy && dialog === null}>
          {t('khata.common.save')}
        </Button>
      </form>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-semibold text-gray-800">{t('khata.settings.languageLabel')}</legend>
        {LANGUAGES.map((lng: Language) => (
          <label
            key={lng}
            className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-base text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
          >
            <input
              type="radio"
              name="language"
              value={lng}
              checked={language === lng}
              onChange={() => void changeLanguage(lng)}
              className="h-5 w-5 accent-brand-600"
            />
            <span>{lng === 'en' ? t('language.english') : t('language.urdu')}</span>
          </label>
        ))}
      </fieldset>

      <SyncDevicesSection sync={devices} />

      <section className="space-y-3" aria-labelledby="data-heading">
        <h3 id="data-heading" className="text-base font-semibold text-gray-800">
          {t('khata.settings.dataSection')}
        </h3>
        <div>
          <Button variant="secondary" onClick={handleExport}>
            {t('khata.settings.exportButton')}
          </Button>
          <p className="mt-1 text-sm text-gray-600">{t('khata.settings.exportHint')}</p>
        </div>
        <div>
          <Button variant="neutral" onClick={handleDemoClick} disabled={guard.busy}>
            {t('khata.settings.demoButton')}
          </Button>
          <p className="mt-1 text-sm text-gray-600">{t('khata.settings.demoWarning')}</p>
        </div>
      </section>

      <section aria-labelledby="danger-heading">
        <Card className="space-y-3 border-red-200">
          <h3 id="danger-heading" className="text-base font-semibold text-red-700">
            {t('khata.settings.dangerZone')}
          </h3>
          <p className="text-sm text-gray-600">{t('khata.settings.clearHint')}</p>
          <Button variant="dangerOutline" onClick={() => setDialog('clear')} disabled={guard.busy}>
            {t('khata.settings.clearButton')}
          </Button>
        </Card>
      </section>

      <ConfirmDialog
        open={dialog === 'demo'}
        title={t('khata.settings.demoTitle')}
        message={t('khata.settings.demoConfirm')}
        confirmLabel={t('khata.settings.demoConfirmYes')}
        cancelLabel={t('khata.common.cancel')}
        busy={guard.busy}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          void run(async () => {
            const result = await loadDemoData(store);
            await onChanged();
            return result === 'loaded' ? 'demoLoaded' : 'demoAlreadyLoaded';
          })
        }
      />

      <ConfirmDialog
        open={dialog === 'clear'}
        tone="danger"
        title={t('khata.settings.clearTitle')}
        message={t('khata.settings.clearConfirm')}
        confirmLabel={t('khata.settings.clearConfirmYes')}
        cancelLabel={t('khata.common.cancel')}
        busy={guard.busy}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          void run(async () => {
            await onClearAll();
            setShopName(t('khata.settings.defaultShopName'));
            return 'cleared';
          })
        }
      />
    </div>
  );
}
