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
  collapseSpaces,
  useSubmitGuard,
  useTranslation,
} from '@skeleton/core';
import type { Language } from '@skeleton/core';
import { setDeviceLetter } from '../clinic.actions';
import { LIMITS } from '../clinic.limits';
import { isValidLetter, nextTokenNumber, tokenLabel } from '../clinic.reducers';
import { displayClinicName } from '../components/format';
import { downloadClinicCsv } from '../utils/csv';
import { loadDemoData } from '../utils/demo';
import type { ScreenProps } from './types';

type Message = 'saved' | 'demoLoaded' | 'demoAlreadyLoaded' | 'cleared';
const MESSAGE_KEY: Record<Message, string> = {
  saved: 'clinic.settings.saved',
  demoLoaded: 'clinic.settings.demoLoaded',
  demoAlreadyLoaded: 'clinic.settings.demoAlreadyLoaded',
  cleared: 'clinic.settings.cleared',
};

/** Clinic name, this device's token letter, language, CSV backup, demo data and "Clear all data". */
export function SettingsScreen({ data, derived, store, onChanged, onClearAll, language, changeLanguage, devices }: ScreenProps) {
  const { t } = useTranslation();
  const guard = useSubmitGuard();
  const [clinicName, setClinicName] = useState(displayClinicName(derived.settings, t));
  const [nameError, setNameError] = useState<string | null>(null);
  const [letter, setLetter] = useState(derived.letter.letter);
  const [letterError, setLetterError] = useState(false);
  const [dialog, setDialog] = useState<'demo' | 'clear' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [failed, setFailed] = useState(false);

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

  function saveName(event: FormEvent) {
    event.preventDefault();
    const clean = collapseSpaces(clinicName);
    if (clean === '') return setNameError('clinic.settings.clinicNameRequired');
    if (clean.length > LIMITS.clinicName) return setNameError('clinic.settings.clinicNameTooLong');
    setNameError(null);
    void run(async () => {
      await store.add('settingsUpdated', { clinicName: clean });
      await onChanged();
      return 'saved';
    });
  }

  function saveLetter(event: FormEvent) {
    event.preventDefault();
    const clean = letter.trim().toUpperCase();
    if (!isValidLetter(clean)) return setLetterError(true);
    setLetterError(false);
    setLetter(clean);
    void run(async () => {
      await setDeviceLetter(store, derived.deviceId, clean);
      await onChanged();
      return 'saved';
    });
  }

  const shownLetter = isValidLetter(letter.trim().toUpperCase()) ? letter.trim().toUpperCase() : derived.letter.letter;
  const example = tokenLabel(shownLetter, nextTokenNumber(data.tokenIssued, derived.today, shownLetter, derived.deviceId));
  const conflictLetter = derived.letter.usedByOthers.includes(shownLetter) ? shownLetter : null;

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('clinic.settings.title')} />

      {message && <Notice tone="success">{t(MESSAGE_KEY[message])}</Notice>}
      {failed && <Notice tone="error">{t('clinic.common.errorGeneric')}</Notice>}

      <form onSubmit={saveName} noValidate className="space-y-3">
        <TextField
          label={t('clinic.settings.clinicNameLabel')}
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
          maxLength={LIMITS.clinicName}
          autoComplete="off"
          error={nameError ? t(nameError, { max: LIMITS.clinicName }) : undefined}
        />
        <Button type="submit" loading={guard.busy && dialog === null}>
          {t('clinic.common.save')}
        </Button>
      </form>

      <section aria-labelledby="letter-heading">
        <Card className="space-y-3">
          <h3 id="letter-heading" className="text-base font-semibold text-gray-800">
            {t('clinic.settings.letterTitle')}
          </h3>
          <form onSubmit={saveLetter} noValidate className="space-y-3">
            <TextField
              label={t('clinic.settings.letterLabel')}
              value={letter}
              onChange={(e) => setLetter(e.target.value.toUpperCase())}
              maxLength={1}
              autoComplete="off"
              autoCapitalize="characters"
              dir="ltr"
              className="w-24 text-center text-2xl font-bold"
              hint={t('clinic.settings.letterHint', { example })}
              error={letterError ? t('clinic.settings.letterInvalid') : undefined}
            />
            {derived.letter.usedByOthers.length > 0 && (
              <p className="text-sm text-gray-600">
                {t('clinic.settings.letterUsedBy', { letters: derived.letter.usedByOthers.join(', ') })}
              </p>
            )}
            {conflictLetter && <Notice tone="error">{t('clinic.settings.letterConflict', { letter: conflictLetter })}</Notice>}
            <Button type="submit" variant="secondary" disabled={guard.busy}>
              {t('clinic.settings.saveLetter')}
            </Button>
          </form>
        </Card>
      </section>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-semibold text-gray-800">{t('clinic.settings.languageLabel')}</legend>
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
          {t('clinic.settings.dataSection')}
        </h3>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setFailed(false);
              try {
                downloadClinicCsv(derived, displayClinicName(derived.settings, t));
              } catch {
                setFailed(true);
              }
            }}
          >
            {t('clinic.settings.exportButton')}
          </Button>
          <p className="mt-1 text-sm text-gray-600">{t('clinic.settings.exportHint')}</p>
        </div>
        <div>
          <Button
            variant="neutral"
            disabled={guard.busy}
            onClick={() => {
              if (derived.settings.demoDataLoaded) {
                setFailed(false);
                setMessage('demoAlreadyLoaded');
              } else setDialog('demo');
            }}
          >
            {t('clinic.settings.demoButton')}
          </Button>
          <p className="mt-1 text-sm text-gray-600">{t('clinic.settings.demoHint')}</p>
        </div>
      </section>

      <section aria-labelledby="danger-heading">
        <Card className="space-y-3 border-red-200">
          <h3 id="danger-heading" className="text-base font-semibold text-red-700">
            {t('clinic.settings.dangerZone')}
          </h3>
          <p className="text-sm text-gray-600">{t('clinic.settings.clearHint')}</p>
          <Button variant="dangerOutline" disabled={guard.busy} onClick={() => setDialog('clear')}>
            {t('clinic.settings.clearButton')}
          </Button>
        </Card>
      </section>

      <ConfirmDialog
        open={dialog === 'demo'}
        title={t('clinic.settings.demoTitle')}
        message={t('clinic.settings.demoConfirm')}
        confirmLabel={t('clinic.settings.demoConfirmYes')}
        cancelLabel={t('clinic.common.cancel')}
        busy={guard.busy}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          void run(async () => {
            const result = await loadDemoData(store, derived.deviceId);
            await onChanged();
            return result === 'loaded' ? 'demoLoaded' : 'demoAlreadyLoaded';
          })
        }
      />

      <ConfirmDialog
        open={dialog === 'clear'}
        tone="danger"
        title={t('clinic.settings.clearTitle')}
        message={t('clinic.settings.clearConfirm')}
        confirmLabel={t('clinic.settings.clearConfirmYes')}
        cancelLabel={t('clinic.common.cancel')}
        busy={guard.busy}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          void run(async () => {
            await onClearAll();
            setClinicName(t('clinic.settings.defaultClinicName'));
            setLetter('A');
            return 'cleared';
          })
        }
      />
    </div>
  );
}
