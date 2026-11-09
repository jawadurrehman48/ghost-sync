import type { Settings } from '../khata.types';
import { DEFAULT_SHOP_NAME } from '../khata.reducers';

/**
 * The shop name to show. Until the owner sets one, the stored default
 * ("My Shop") is replaced by the translated default so Urdu users see
 * "میری دکان" instead of English text.
 */
export function displayShopName(settings: Settings, t: (key: string) => string): string {
  return settings.shopName === DEFAULT_SHOP_NAME ? t('khata.settings.defaultShopName') : settings.shopName;
}
