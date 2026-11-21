import { DEFAULT_CLINIC_NAME } from '../clinic.reducers';
import type { Settings } from '../clinic.types';

type T = (key: string, options?: Record<string, unknown>) => string;

/** Until the owner sets a name, show the translated default ("میرا کلینک" in Urdu). */
export function displayClinicName(settings: Settings, t: T): string {
  return settings.clinicName === DEFAULT_CLINIC_NAME ? t('clinic.settings.defaultClinicName') : settings.clinicName;
}

/** "just now", "12 min", "1 h 5 min". */
export function formatWait(minutes: number, t: T): string {
  if (minutes < 1) return t('clinic.wait.justNow');
  if (minutes < 60) return t('clinic.wait.minutes', { count: minutes });
  return t('clinic.wait.hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}
