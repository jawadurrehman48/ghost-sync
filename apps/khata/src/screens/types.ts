import type { Language, Store } from '@skeleton/core';
import type { KhataCollections, KhataData, KhataDerived, Screen } from '../khata.types';

/** Props every screen receives from App. */
export type ScreenProps = {
  /** All records in the local store */
  data: KhataData;
  /** Everything derived from `data` (customers, balances, settings, dashboard) */
  derived: KhataDerived;
  /** Append-only store: screens only ever call store.add(...) */
  store: Store<KhataCollections>;
  navigate: (screen: Screen) => void;
  /** Call after writing to the store: reloads data and triggers a sync. */
  onChanged: () => Promise<void>;
  language: Language;
  /** Switches the app language and records it as a setting. */
  changeLanguage: (language: Language) => Promise<void>;
};
