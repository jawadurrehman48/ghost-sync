import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppShell,
  BottomNav,
  Button,
  ErrorBoundary,
  FloatingActionButton,
  LoadingState,
  Notice,
  clearAllData,
  setLanguage,
  todayISO,
  useLanguage,
  useStoreSnapshot,
  useTranslation,
} from '@skeleton/core';
import type { Language, SyncStatus } from '@skeleton/core';
import { loadClinicData } from './clinic.actions';
import { deriveAll } from './clinic.reducers';
import { adapter, db, deviceId, engine, store } from './clinic.store';
import type { Screen } from './clinic.types';
import { Logo } from './components/Logo';
import { PatientsIcon, QueueIcon, SettingsIcon, SummaryIcon } from './components/NavIcons';
import { AddPatientScreen } from './screens/AddPatientScreen';
import { DisplayScreen } from './screens/DisplayScreen';
import { IssueTokenScreen } from './screens/IssueTokenScreen';
import { PatientDetailScreen } from './screens/PatientDetailScreen';
import { PatientsScreen } from './screens/PatientsScreen';
import { QueueScreen } from './screens/QueueScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { TokenScreen } from './screens/TokenScreen';
import type { ScreenProps } from './screens/types';

type Tab = 'queue' | 'patients' | 'summary' | 'settings';

const HOME: Screen = { name: 'queue' };
const DISPLAY_HASH = '#display';

const TAB_SCREEN: Record<Tab, Screen> = {
  queue: HOME,
  patients: { name: 'patients' },
  summary: { name: 'summary' },
  settings: { name: 'settings' },
};

function tabFor(screen: Screen): Tab {
  switch (screen.name) {
    case 'patients':
    case 'addPatient':
    case 'patientDetail':
      return 'patients';
    case 'summary':
      return 'summary';
    case 'settings':
      return 'settings';
    default:
      return 'queue';
  }
}

const loadAll = () => loadClinicData(store);

function renderScreen(screen: Screen, props: ScreenProps) {
  switch (screen.name) {
    case 'queue':
      return <QueueScreen {...props} />;
    case 'issueToken':
      return (
        <IssueTokenScreen key={`issue-${screen.patientId ?? 'any'}`} {...props} from={screen.from} patientId={screen.patientId} />
      );
    case 'token':
      return <TokenScreen key={screen.tokenId} {...props} tokenId={screen.tokenId} />;
    case 'patients':
      return <PatientsScreen {...props} />;
    case 'addPatient':
      return <AddPatientScreen {...props} />;
    case 'patientDetail':
      return <PatientDetailScreen key={screen.patientId} {...props} patientId={screen.patientId} />;
    case 'summary':
      return <SummaryScreen {...props} />;
    case 'settings':
      return <SettingsScreen {...props} />;
  }
}

function App() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [isDisplay, setIsDisplay] = useState(() => window.location.hash === DISPLAY_HASH);
  const [screen, setScreen] = useState<Screen>(HOME);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(engine.getStatus());
  const [today, setToday] = useState(todayISO());

  // Local data. Polling picks up writes from another tab on this device
  // (e.g. the reception phone app and the waiting-room display window).
  const { data, error, reload } = useStoreSnapshot(loadAll, { engine, pollMs: isDisplay ? 2000 : 5000 });
  const derived = useMemo(() => (data ? deriveAll(data, deviceId, today) : undefined), [data, today]);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setSyncStatus);
    engine.start();
    return () => {
      unsubscribe();
      engine.stop();
    };
  }, []);

  // A new day starts a new queue, even if the app stays open past midnight.
  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.title = t('clinic.appName');
  }, [t, language]);

  useEffect(() => {
    const onHash = () => setIsDisplay(window.location.hash === DISPLAY_HASH);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Android back button steps back through screens.
  useEffect(() => {
    window.history.replaceState({ screen: HOME }, '');
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { screen?: Screen } | null;
      if (state?.screen) setScreen(state.screen);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Screen) => {
    window.history.pushState({ screen: next }, '');
    setScreen(next);
    window.scrollTo(0, 0);
  }, []);

  const onChanged = useCallback(async () => {
    await reload();
    void engine.syncNow();
  }, [reload]);

  const changeLanguage = useCallback(
    async (next: Language) => {
      setLanguage(next);
      try {
        await store.add('settingsUpdated', { language: next });
        await onChanged();
      } catch {
        // The language already switched on this device; only the synced setting failed.
      }
    },
    [onChanged],
  );

  const onClearAll = useCallback(async () => {
    await clearAllData(db);
    adapter.reset();
    await reload();
  }, [reload]);

  const openDisplay = useCallback(() => {
    const opened = window.open(`${window.location.pathname}${DISPLAY_HASH}`, 'clinic-queue-display');
    if (!opened) window.location.hash = DISPLAY_HASH; // pop-ups blocked: switch this tab instead
  }, []);

  const exitDisplay = useCallback(() => {
    if (window.opener) window.close();
    window.location.hash = '';
    setIsDisplay(false);
  }, []);

  if (isDisplay) {
    return derived ? (
      <DisplayScreen derived={derived} onExit={exitDisplay} />
    ) : (
      <div className="min-h-screen bg-gray-950">
        <LoadingState />
      </div>
    );
  }

  const navItems = [
    { key: 'queue' as const, label: t('clinic.nav.queue'), icon: <QueueIcon /> },
    { key: 'patients' as const, label: t('clinic.nav.patients'), icon: <PatientsIcon /> },
    { key: 'summary' as const, label: t('clinic.nav.summary'), icon: <SummaryIcon /> },
    { key: 'settings' as const, label: t('clinic.nav.settings'), icon: <SettingsIcon /> },
  ];

  const screenKey = JSON.stringify(screen);
  const showFab = screen.name === 'queue' || screen.name === 'patients';

  return (
    <AppShell
      appName={t('clinic.appName')}
      logo={<Logo />}
      syncStatus={syncStatus}
      onSyncNow={() => void engine.syncNow()}
      language={language}
      onToggleLanguage={() => void changeLanguage(language === 'en' ? 'ur' : 'en')}
    >
      <div className="pb-32">
        <ErrorBoundary key={screenKey}>
          {derived && data ? (
            <div key={screenKey} className="animate-fade-in">
              {renderScreen(screen, {
                data,
                derived,
                store,
                navigate,
                onChanged,
                language,
                changeLanguage,
                onClearAll,
                openDisplay,
              })}
            </div>
          ) : error ? (
            <div className="space-y-3">
              <Notice tone="error">{t('clinic.common.errorGeneric')}</Notice>
              <Button variant="secondary" onClick={() => void reload()}>
                {t('clinic.common.retry')}
              </Button>
            </div>
          ) : (
            <LoadingState label={t('clinic.common.loading')} />
          )}
        </ErrorBoundary>
      </div>

      {showFab && derived && (
        <FloatingActionButton
          label={t('clinic.issue.fab')}
          onClick={() => navigate({ name: 'issueToken', from: screen.name === 'patients' ? 'patients' : 'queue' })}
        />
      )}

      <BottomNav
        items={navItems}
        active={tabFor(screen)}
        onSelect={(tab) => navigate(TAB_SCREEN[tab])}
        ariaLabel={t('clinic.nav.ariaLabel')}
      />
    </AppShell>
  );
}

export default App;
