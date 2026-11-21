import type { Language } from '@skeleton/core';
import type { ClinicStore } from '../clinic.actions';
import type { ClinicData, ClinicDerived, Screen } from '../clinic.types';

/** Props every screen receives from App. */
export type ScreenProps = {
  data: ClinicData;
  derived: ClinicDerived;
  /** Append-only store: screens write only through clinic.actions or store.add */
  store: ClinicStore;
  navigate: (screen: Screen) => void;
  /** Call after writing: reloads data and syncs in the background. */
  onChanged: () => Promise<void>;
  language: Language;
  changeLanguage: (language: Language) => Promise<void>;
  /** Erase all data on this device (Settings danger action). */
  onClearAll: () => Promise<void>;
  /** Open the waiting-room display in a new window. */
  openDisplay: () => void;
};
