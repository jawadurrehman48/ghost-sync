import { useEffect, useState, useCallback } from 'react';
import {
  AppShell,
  createDatabase,
  createStore,
  getOrCreateDeviceId,
  createSyncEngine,
  InMemorySyncAdapter,
  useOnlineStatus,
  useLanguage,
  setLanguage,
  type SyncStatus,
  type SkeletonRecord,
} from '@skeleton/core';

// --- Define our test collection ---
type DemoCollections = {
  entries: { text: string; value: number };
};

// --- Singleton setup (runs once per page load) ---
const deviceId = getOrCreateDeviceId();
const db = createDatabase<DemoCollections>({
  dbName: 'khata-demo',
  collections: { entries: undefined },
});
const store = createStore(db, deviceId);
const adapter = new InMemorySyncAdapter();
const engine = createSyncEngine({ adapter, store });

function App() {
  const online = useOnlineStatus();
  const { language } = useLanguage();
  const [records, setRecords] = useState<SkeletonRecord<{ text: string; value: number }>[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'pending', count: 0 });
  const [syncLog, setSyncLog] = useState<string[]>([]);

  // Subscribe to sync engine status
  useEffect(() => {
    const unsub = engine.subscribe((status) => {
      setSyncStatus(status);
    });
    engine.start();
    return () => {
      unsub();
      engine.stop();
    };
  }, []);

  // Refresh the record list from local storage
  const refreshRecords = useCallback(async () => {
    const all = await store.query('entries');
    setRecords(all);
  }, []);

  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);

  // Add a test record
  const handleAdd = async () => {
    const value = Math.floor(Math.random() * 1000);
    await store.add('entries', { text: `Entry ${Date.now()}`, value });
    await refreshRecords();
    // Trigger sync check
    await engine.syncNow();
    await refreshRecords();
  };

  // Manual sync
  const handleSync = async () => {
    setSyncLog((prev) => [...prev, `Sync triggered at ${new Date().toLocaleTimeString()}`]);
    await engine.syncNow();
    await refreshRecords();
    const pending = await store.getPending();
    setSyncLog((prev) => [
      ...prev,
      `Sync complete. Pending: ${pending.length}, Cloud: ${adapter.size()}`,
    ]);
  };

  // Language toggle
  const handleToggleLanguage = () => {
    const next = language === 'en' ? 'ur' : 'en';
    setLanguage(next);
  };

  return (
    <AppShell
      appName="Khata Demo"
      syncStatus={syncStatus}
      onSyncNow={handleSync}
      language={language}
      onToggleLanguage={handleToggleLanguage}
    >
      <div className="space-y-4">
        {/* Online status */}
        <div className={`rounded-lg p-3 text-sm font-medium ${online ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {online ? 'Online' : 'Offline'} — Device: {deviceId.slice(0, 8)}
        </div>

        {/* Add record button */}
        <button
          onClick={handleAdd}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white font-semibold shadow-sm hover:bg-indigo-700 active:bg-indigo-800 min-h-[44px] transition-colors"
        >
          Add Test Record
        </button>

        {/* Manual sync button */}
        <button
          onClick={handleSync}
          className="w-full rounded-lg bg-blue-100 px-4 py-3 text-blue-800 font-semibold hover:bg-blue-200 active:bg-blue-300 min-h-[44px] transition-colors"
        >
          Sync Now
        </button>

        {/* Record count + cloud count */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Local records: {records.length}</span>
          <span>Cloud records: {adapter.size()}</span>
        </div>

        {/* Record list */}
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-800">Stored Records</h2>
          {records.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No records yet. Click "Add Test Record" to create one.</p>
          ) : (
            <ul className="space-y-1">
              {records.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-gray-200 bg-white p-3 text-sm"
                >
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">{r.payload.text}</span>
                    <span className="font-mono text-indigo-600">{r.payload.value}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {r.id.slice(0, 8)}… • {new Date(r.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sync log */}
        {syncLog.length > 0 && (
          <div className="space-y-1">
            <h2 className="font-semibold text-gray-800">Sync Log</h2>
            <ul className="space-y-1 text-xs text-gray-500">
              {syncLog.slice(-5).map((log, i) => (
                <li key={i} className="font-mono">{log}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default App;
