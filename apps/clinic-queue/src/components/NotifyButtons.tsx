import { Button, normalizePhone, useTranslation, validatePakistaniPhone } from '@skeleton/core';
import type { Language } from '@skeleton/core';
import { notifyLinks } from '../utils/notify';

export interface NotifyButtonsProps {
  phone?: string;
  patientName: string;
  token: string;
  clinicName: string;
  language: Language;
  /** "sm" shows the buttons side by side (for cards). */
  size?: 'md' | 'sm';
}

/** WhatsApp link with an SMS fallback, or a hint when there is no valid phone. */
export function NotifyButtons({ phone, patientName, token, clinicName, language, size = 'md' }: NotifyButtonsProps) {
  const { t } = useTranslation();
  const number = phone ? normalizePhone(phone) : '';
  if (!number || !validatePakistaniPhone(number)) {
    return <p className="text-sm text-gray-600">{t('clinic.notify.noPhone')}</p>;
  }
  const links = notifyLinks(number, { patientName, token, clinicName, language });
  return (
    <div className={size === 'sm' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
      <Button variant="secondary" size={size} fullWidth href={links.whatsapp} target="_blank">
        {t('clinic.notify.whatsapp')}
      </Button>
      <Button variant="neutral" size={size} fullWidth href={links.sms}>
        {t('clinic.notify.sms')}
      </Button>
    </div>
  );
}
