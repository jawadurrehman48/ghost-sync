import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppShell,
  BottomNav,
  setLanguage,
  todayISO,
  useLanguage,
  useStoreSnapshot,
  useTranslation,
} from '@skeleton/core';
import type { Language, SyncStatus } from '@skeleton/core';
import { CustomersIcon, HomeIcon, ReportsIcon, SettingsIcon } from './components/NavIcons';
import { card, fieldError, secondaryButton } from './components/styles';
import { engine, store } from './khata.store';
import { deriveAll } from './khata.reducers';
import type { KhataData, Screen } from './khata.types';
import { AddCustomerScreen } from './screens/AddCustomerScreen';
import { AddEntryScreen } from './screens/AddEntryScreen';
import { CustomerDetailScreen } from './screens/CustomerDetailScreen';
import { CustomerListScreen } from './screens/CustomerListScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { ReverseEntryScreen } from './screens/ReverseEntryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { ScreenProps } from './screens/types';

type Tab = 'dashboard' | 'customers' | 'reports' | 'settings';

const HOME: Screen = { name: 'dashboard' };

/** Which bottom tab a screen belongs to. */
function tabFor(screen: Screen): Tab {
  switch (screen.name) {
    case 'dashboard':
      return 'dashboard';
    case 'reports':
      return 'reports';
    case 'settings':
      return 'settings';
    default:
      return 'customers';
  }
}

const TAB_SCREEN: Record<Tab, Screen> = {
  dashboard: HOME,
  customers: { name: 'customerList' },
  reports: { name: 'reports' },
  settings: { name: 'settings' },
};

/** Read every record from the local store (offline, no network). */
async function loadAll(): Promise<KhataData> {
  const [customerCreated, customerUpdated, creditGiven, paymentReceived, entryReversed, settingsUpdated] =
    await Promise.all([
      store.query('customerCreated'),
      store.query('customerUpdated'),
      store.query('creditGiven'),
      store.query('paymentReceived'),
      store.query('entryReversed'),
      store.query('settingsUpdated'),
    ]);
  return { customerCreated, customerUpdated, creditGiven, paymentReceived, entryReversed, settingsUpdated };
}

function renderScreen(screen: Screen, props: ScreenProps) {
  switch (screen.name) {
    case 'dashboard':
      return <DashboardScreen {...props} />;
    case 'customerList':
      return <CustomerListScreen {...props} />;
    case 'addCustomer':
      return <AddCustomerScreen key="new-customer" {...props} />;
    case 'editCustomer':
      return <AddCustomerScreen key={`edit-${screen.customerId}`} {...props} customerId={screen.customerId} />;
    case 'customerDetail':
      return <CustomerDetailScreen key={screen.customerId} {...props} customerId={screen.customerId} />;
    case 'addEntry':
      return (
        <AddEntryScreen
          key={`${screen.customerId}-${screen.type}`}
          {...props}
          customerId={screen.customerId}
          type={screen.type}
        />
      );
    case 'reverseEntry':
      return (
        <ReverseEntryScreen
          key={screen.entryId}
          {...props}
          entryId={screen.entryId}
          customerId={screen.customerId}
        />
      );
    case 'reports':
      return <ReportsScreen {...props} />;
    case 'settings':
      return <SettingsScreen {...props} />;
  }
}

function App() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [screen, setScreen] = useState<Screen>(HOME);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(engine.getStatus());
  const [today, setToday] = useState(todayISO());

  // All local data; reloads after writes and after sync activity.
  const { data, error, reload } = useStoreSnapshot(loadAll, { engine });
  const derived = useMemo(() => (data ? deriveAll(data, today) : undefined), [data, today]);

  // Start background sync; show its status in the header.
  useEffect(() => {
    const unsubscribe = engine.subscribe(setSyncStatus);
    engine.start();
    return () => {
      unsubscribe();
      engine.stop();
    };
  }, []);

  // Keep "today" correct if the app stays open past midnight.
  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.title = t('khata.appName');
  }, [t, language]);

  // Navigation uses the browser history so the Android back button steps
  // back through screens instead of closing the app.
  useEffect(() => {
    window.history.replaceState({ screen: HOME }, '');
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { screen?: Screen } | null;
      setScreen(state?.screen ?? HOME);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Screen) => {
    window.history.pushState({ screen: next }, '');
    setScreen(next);
    window.scrollTo(0, 0);
  }, []);

  /** After writing to the store: refresh the screens, then sync in the background. */
  const onChanged = useCallback(async () => {
    await reload();
    void engine.syncNow();
  }, [reload]);

  /** Switch language now and record it as a (synced) setting. */
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

  const navItems = [
    { key: 'dashboard' as const, label: t('khata.nav.dashboard'), icon: <HomeIcon /> },
    { key: 'customers' as const, label: t('khata.nav.customers'), icon: <CustomersIcon /> },
    { key: 'reports' as const, label: t('khata.nav.reports'), icon: <ReportsIcon /> },
    { key: 'settings' as const, label: t('khata.nav.settings'), icon: <SettingsIcon /> },
  ];

  return (
    <AppShell
      appName={t('khata.appName')}
      syncStatus={syncStatus}
      onSyncNow={() => void engine.syncNow()}
      language={language}
      onToggleLanguage={() => void changeLanguage(language === 'en' ? 'ur' : 'en')}
    >
      <div className="pb-24">
        {derived && data ? (
          renderScreen(screen, {
            data,
            derived,
            store,
            navigate,
            onChanged,
            language,
            changeLanguage,
          })
        ) : error ? (
          <div className={`${card} space-y-3`}>
            <p role="alert" className={fieldError}>
              {t('khata.common.errorGeneric')}
            </p>
            <button type="button" onClick={() => void reload()} className={secondaryButton}>
              {t('khata.common.retry')}
            </button>
          </div>
        ) : (
          <p role="status" className="py-8 text-center text-gray-600">
            {t('khata.common.loading')}
          </p>
        )}
      </div>

      <BottomNav
        items={navItems}
        active={tabFor(screen)}
        onSelect={(tab) => navigate(TAB_SCREEN[tab])}
        ariaLabel={t('khata.nav.ariaLabel')}
      />
    </AppShell>
  );
}

export default App;
