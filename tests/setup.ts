/**
 * Test setup: make IndexedDB available in the jsdom environment
 * so Dexie can operate without a real browser.
 */
import 'fake-indexeddb/auto';
